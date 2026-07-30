"""Route-level tests for the character voice lock (``/voice/lock``, ``/voice/check``).

Fully offline. ``get_chat_model`` is replaced with a counting fake, which lets
these tests pin the two properties the endpoints promise but the pure-logic
tests cannot see:

* **the refusal paths spend nothing.** A blank character name or a sample below
  ``MIN_LOCK_TOKENS`` must return a well-formed ``insufficient_sample`` result
  with ``fake.calls == 0``. The gate exists to protect the watsonx budget, so a
  test that only checked the status would miss the point entirely.
* **the wire shape survives ``response_model``.** FastAPI drops undeclared
  fields silently, so these go through ``TestClient`` and assert on the parsed
  JSON body rather than on the handler's return value.

``/voice/check`` gets no model patch at all: if it ever grows a model call, the
tests that exercise it will reach for the real backend and fail loudly.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.orchestration.voice import MIN_LOCK_TOKENS, metrics_from_lines
from app.routes import voice as voice_route
from app.routes.voice import VoiceRegister, _harvest
from tests.fakes import CountingChatModel, patch_route_model

# A canvas with two speakers, where Marcus clears the lock threshold (57 words
# over three lines) and Dana does not. The blank line in "Deck" is load-bearing:
# it is the wall that keeps Dana's line out of Marcus's sample.
NODES = [
    {
        "id": "n1",
        "data": {
            "node_type": "plot_beat",
            "title": "Docks",
            "content": (
                'Marcus said, "The crate stays shut. I signed for it, so it is mine '
                'until the harbour master says otherwise."'
            ),
        },
    },
    {
        "id": "n2",
        "data": {
            "node_type": "character",
            "title": "Marcus Vane",
            "content": "Ex-quartermaster. Short declaratives, no hedging.",
        },
    },
    {
        "id": "n3",
        "data": {
            "node_type": "plot_beat",
            "title": "Hold",
            "content": (
                'Marcus set the lamp down. "You want the truth. Fine. The manifest is '
                'short by four crates and I counted them myself."'
            ),
        },
    },
    {
        "id": "n4",
        "data": {
            "node_type": "plot_beat",
            "title": "Deck",
            "content": (
                'Dana laughed. "Then we starve politely."\n\n'
                'Marcus did not look up. "We do it my way or we do not do it. I have '
                'buried better men than the ones on that pier."'
            ),
        },
    },
]


def _named() -> VoiceRegister:
    """What a healthy Granite naming call returns."""
    return VoiceRegister(
        register_label="clipped dockside deadpan",
        description="Short declaratives, no hedging, ledger vocabulary.",
        signature_phrases=["stays shut", "my way"],
        vocabulary_domain="cargo, manifests and debt",
        never_says=["synergy", "circle back", "honestly"],
    )


def _lock_body(character: str = "Marcus", nodes: list | None = None) -> dict:
    return {
        "room_id": "demo",
        "nodes": NODES if nodes is None else nodes,
        "edges": [],
        "story_facts": [{"category": "character", "content": "Marcus never swears."}],
        "character": character,
    }


@pytest.fixture(autouse=True)
def _fresh_limiters():
    """Empty both sliding windows before each test.

    The limiters are module-level singletons keyed by client IP, and every
    ``TestClient`` request arrives from the same one — so without this the
    eleventh lock test in the file would get a 429 from the first ten and fail
    for a reason that has nothing to do with what it asserts.
    """
    voice_route._lock_limiter._hits.clear()
    voice_route._check_limiter._hits.clear()
    yield


def _client() -> TestClient:
    from app.main import app

    return TestClient(app)


def _locked_payload() -> dict:
    """The stored fingerprint a real ``/voice/check`` request carries."""
    return metrics_from_lines(_harvest(NODES, "Marcus")).as_dict()


# Candidates for /voice/check. Both clear MIN_COMPARE_TOKENS (12) — a shorter
# line comes back judged=False for its own length, which would make these tests
# pass without ever exercising the comparison they are named for.
IN_CHARACTER = (
    "The manifest stays shut. I signed for it, so it is mine until the harbour "
    "master says otherwise. I counted them myself."
)
OUT_OF_CHARACTER = (
    "Honestly, I just think maybe we could all possibly be a little bit kinder "
    "about the whole crate situation, don't you think? Maybe?"
)


# --------------------------------------------------------------------------- #
# /voice/lock — the happy path
# --------------------------------------------------------------------------- #


class TestLockSucceeds:
    def test_a_lockable_sample_returns_both_layers(self, monkeypatch):
        fake = patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        response = _client().post("/voice/lock", json=_lock_body())

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] == "locked"
        assert body["character"] == "Marcus"
        assert body["voice_register"]["register_label"] == "clipped dockside deadpan"
        assert body["metrics"]["token_count"] >= MIN_LOCK_TOKENS
        assert fake.calls == 1

    def test_all_fourteen_measured_fields_reach_the_wire(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        metrics = _client().post("/voice/lock", json=_lock_body()).json()["metrics"]

        # response_model drops undeclared fields silently, so the count is the
        # assertion: a field renamed in StyleMetrics must fail here, not vanish.
        assert set(metrics) == set(_locked_payload())
        assert len(metrics) == 14

    def test_the_measured_metrics_are_the_harvested_ones(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        metrics = _client().post("/voice/lock", json=_lock_body()).json()["metrics"]

        # The route must measure the same sample the pure helper harvests —
        # not the whole canvas, and not both speakers averaged together.
        assert metrics == pytest.approx(_locked_payload())

    def test_the_sample_report_counts_lines_nodes_and_the_threshold(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        sample = _client().post("/voice/lock", json=_lock_body()).json()["sample"]

        assert sample["nodes_scanned"] == len(NODES)
        assert sample["lines_found"] == 3
        assert sample["min_tokens_required"] == MIN_LOCK_TOKENS
        assert sample["confidence"] == "low"  # 57 words: over the floor, under 80

    def test_a_second_speaker_in_the_same_canvas_is_not_averaged_in(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        body = _client().post("/voice/lock", json=_lock_body()).json()

        # Dana speaks 4 words; if her line leaked into Marcus's sample the token
        # count would exceed his own harvest. This is the "mix, not miss" guard
        # at the route level.
        assert body["metrics"]["token_count"] == _locked_payload()["token_count"]

    def test_duplicate_never_says_terms_are_collapsed(self, monkeypatch):
        noisy = _named()
        noisy.never_says = ["Synergy", "synergy", "SYNERGY", "  ", "circle back"]
        noisy.signature_phrases = ["stays shut", "Stays Shut"]
        patch_route_model(monkeypatch, voice_route, CountingChatModel(noisy))

        register = _client().post("/voice/lock", json=_lock_body()).json()["voice_register"]
        # One term, one blocker. check_violations has no dedupe of its own, so a
        # repetitive model would otherwise make one slip look like a pattern.
        assert register["never_says"] == ["Synergy", "circle back"]
        assert register["signature_phrases"] == ["stays shut"]

    def test_the_never_says_list_is_capped_at_six(self, monkeypatch):
        greedy = _named()
        greedy.never_says = [f"term{i}" for i in range(20)]
        patch_route_model(monkeypatch, voice_route, CountingChatModel(greedy))

        register = _client().post("/voice/lock", json=_lock_body()).json()["voice_register"]
        assert len(register["never_says"]) == 6

    def test_a_name_that_only_matches_by_first_name_still_locks(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        body = _client().post("/voice/lock", json=_lock_body("Marcus Vane")).json()

        # find_dialogue_for aliases the first name, so the writer can type either.
        assert body["status"] == "locked"
        assert body["sample"]["lines_found"] == 3

    def test_the_character_name_is_trimmed(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        body = _client().post("/voice/lock", json=_lock_body("  Marcus  ")).json()
        assert body["character"] == "Marcus"
        assert body["status"] == "locked"


# --------------------------------------------------------------------------- #
# /voice/lock — the refusals, which must cost nothing
# --------------------------------------------------------------------------- #


class TestLockRefusesBeforeSpending:
    def test_a_blank_name_refuses_without_a_model_call(self, monkeypatch):
        fake = patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        body = _client().post("/voice/lock", json=_lock_body("   ")).json()

        assert body["status"] == "insufficient_sample"
        assert body["character"] == ""
        assert "Name the character" in body["message"]
        assert fake.calls == 0
        assert fake.factory_calls == 0

    def test_a_blank_name_is_distinguishable_from_a_silent_character(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        blank = _client().post("/voice/lock", json=_lock_body("  ")).json()
        silent = _client().post("/voice/lock", json=_lock_body("Nobody")).json()

        # Both are refusals, but they say different things — the whole reason the
        # blank-name check exists ahead of the harvest.
        assert blank["message"] != silent["message"]
        assert "0 words" in silent["message"]

    def test_a_thin_sample_refuses_without_a_model_call(self, monkeypatch):
        fake = patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        body = _client().post("/voice/lock", json=_lock_body(nodes=NODES[:1])).json()

        assert body["status"] == "insufficient_sample"
        assert body["metrics"] is None
        assert body["voice_register"] is None
        assert fake.calls == 0

    def test_the_refusal_message_names_the_shortfall_in_words(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        body = _client().post("/voice/lock", json=_lock_body(nodes=NODES[:1])).json()

        # Rendered verbatim from can_lock, which single-sources the threshold.
        assert str(MIN_LOCK_TOKENS) in body["message"]
        assert f"{body['sample']['tokens']} words" in body["message"]

    def test_a_refusal_still_reports_how_far_short_the_sample_fell(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        sample = _client().post("/voice/lock", json=_lock_body(nodes=NODES[:1])).json()["sample"]

        assert sample["lines_found"] == 1
        assert 0 < sample["tokens"] < MIN_LOCK_TOKENS
        assert sample["confidence"] == "none"
        assert sample["min_tokens_required"] == MIN_LOCK_TOKENS

    def test_an_empty_canvas_refuses_without_a_model_call(self, monkeypatch):
        fake = patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        body = _client().post("/voice/lock", json=_lock_body(nodes=[])).json()

        assert body["status"] == "insufficient_sample"
        assert body["sample"] == {
            "nodes_scanned": 0,
            "lines_found": 0,
            "tokens": 0,
            "min_tokens_required": MIN_LOCK_TOKENS,
            "confidence": "none",
        }
        assert fake.calls == 0


# --------------------------------------------------------------------------- #
# /voice/lock — degradation when layer 2 is lost
# --------------------------------------------------------------------------- #


class TestLockDegrades:
    """Layer 2 can fail four ways. All four keep layer 1.

    The fingerprint is measured in code before the model is ever constructed, so
    once ``can_lock`` opens the gate the writer is owed their numbers no matter
    what the provider does. ``status="unnamed"`` is how that is reported.
    """

    def test_a_provider_failure_keeps_the_measured_fingerprint(self, monkeypatch):
        fake = patch_route_model(
            monkeypatch, voice_route, CountingChatModel(error=RuntimeError("provider secret"))
        )
        response = _client().post("/voice/lock", json=_lock_body())

        # invoke_structured exhausts its retries and returns the neutral
        # fallback, so layer 1 — the deterministic half — survives.
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] == "unnamed"
        assert body["metrics"] == pytest.approx(_locked_payload())
        assert fake.calls == 2  # max_attempts=2, so the retry really is attempted

    def test_an_unnamed_lock_says_so_and_carries_no_hard_rules(self, monkeypatch):
        patch_route_model(monkeypatch, voice_route, CountingChatModel(error=RuntimeError("boom")))
        body = _client().post("/voice/lock", json=_lock_body()).json()

        assert "could not be named" in body["message"]
        # No invented rules: an empty never_says means /voice/check falls back to
        # pure arithmetic rather than judging against a guess.
        assert body["voice_register"]["never_says"] == []
        assert body["voice_register"]["signature_phrases"] == []
        assert body["sample"]["confidence"] == "low"

    def test_provider_detail_never_reaches_the_client(self, monkeypatch):
        patch_route_model(
            monkeypatch,
            voice_route,
            CountingChatModel(error=RuntimeError("watsonx apikey abc123 rejected")),
        )
        response = _client().post("/voice/lock", json=_lock_body())
        assert "abc123" not in response.text
        assert "watsonx" not in response.text.lower()

    def test_a_backend_that_cannot_do_structured_output_degrades(self, monkeypatch):
        class NoStructuredOutput:
            def with_structured_output(self, _schema):
                raise NotImplementedError("unsupported provider feature")

        monkeypatch.setattr(voice_route, "get_chat_model", lambda **_kw: NoStructuredOutput())
        response = _client().post("/voice/lock", json=_lock_body())

        assert response.status_code == 200, response.text
        assert response.json()["status"] == "unnamed"
        assert "unsupported provider" not in response.text

    def test_an_unbuildable_model_degrades_rather_than_500ing(self, monkeypatch):
        def _no_credentials(**_kw):
            raise RuntimeError("WATSONX_API_KEY is not set")

        monkeypatch.setattr(voice_route, "get_chat_model", _no_credentials)
        response = _client().post("/voice/lock", json=_lock_body())

        # The factory raises before invoke_structured can apply its fallback, so
        # this is the one degradation path the route has to catch itself.
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "unnamed"
        assert "WATSONX_API_KEY" not in response.text

    def test_a_register_label_matching_the_fallback_reads_as_unnamed(self, monkeypatch):
        echo = _named()
        echo.register_label = "unnamed voice"
        patch_route_model(monkeypatch, voice_route, CountingChatModel(echo))

        # The status discriminator is derived from the label, so a model that
        # happens to return the fallback's wording must not read as "locked".
        assert _client().post("/voice/lock", json=_lock_body()).json()["status"] == "unnamed"


# --------------------------------------------------------------------------- #
# /voice/lock — input bounds
# --------------------------------------------------------------------------- #


class TestLockRequestBounds:
    def test_an_oversized_character_name_is_rejected(self):
        assert _client().post("/voice/lock", json=_lock_body("x" * 81)).status_code == 422

    def test_a_missing_character_field_is_rejected(self):
        body = _lock_body()
        del body["character"]
        assert _client().post("/voice/lock", json=body).status_code == 422

    def test_too_many_nodes_are_rejected(self):
        body = _lock_body(nodes=[{"id": str(i), "data": {"content": "x"}} for i in range(61)])
        assert _client().post("/voice/lock", json=body).status_code == 422


# --------------------------------------------------------------------------- #
# /voice/check — free, deterministic, no model
# --------------------------------------------------------------------------- #


class TestCheck:
    def test_an_in_character_line_passes(self):
        response = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": IN_CHARACTER,
                "metrics": _locked_payload(),
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["judged"] is True
        assert body["severity"] in ("ok", "minor")

    def test_a_register_flip_is_flagged(self):
        body = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": OUT_OF_CHARACTER,
                "metrics": _locked_payload(),
            },
        ).json()
        assert body["judged"] is True
        assert body["severity"] in ("major", "blocker")
        assert body["score"] > 0

    def test_the_out_of_character_line_scores_higher_than_the_in_character_one(self):
        client = _client()
        base = {"character": "Marcus", "metrics": _locked_payload()}
        held = client.post("/voice/check", json={**base, "candidate_text": IN_CHARACTER}).json()
        drifted = client.post(
            "/voice/check", json={**base, "candidate_text": OUT_OF_CHARACTER}
        ).json()

        # Both are judged, so the comparison is of two real scores — the ordering
        # is the claim the panel makes to the writer.
        assert held["judged"] and drifted["judged"]
        assert drifted["score"] > held["score"]

    def test_the_summary_names_the_axes_that_moved(self):
        body = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": OUT_OF_CHARACTER,
                "metrics": _locked_payload(),
            },
        ).json()
        # The writer gets told which way the line drifted, not just a number.
        assert body["summary"].startswith("Marcus:")
        assert "hedging" in body["summary"]

    def test_the_verdict_is_identical_across_repeated_calls(self):
        payload = {
            "character": "Marcus",
            "candidate_text": OUT_OF_CHARACTER,
            "metrics": _locked_payload(),
        }
        client = _client()
        first = client.post("/voice/check", json=payload).json()
        second = client.post("/voice/check", json=payload).json()
        # No model, no sampling: the same input must give a byte-identical answer.
        assert first == second

    def test_a_never_says_hit_is_a_blocker_even_on_a_short_line(self):
        body = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": "Pure synergy.",
                "metrics": _locked_payload(),
                "never_says": ["synergy"],
            },
        ).json()
        # Categorical, so it holds with no measurement behind it.
        assert body["judged"] is False
        assert body["severity"] == "blocker"
        assert body["violations"][0]["kind"] == "never_says"
        assert "synergy" in body["summary"]

    def test_duplicate_never_says_terms_produce_one_violation(self):
        body = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": "Pure synergy, team.",
                "metrics": _locked_payload(),
                "never_says": ["synergy", "Synergy", "SYNERGY"],
            },
        ).json()
        assert len(body["violations"]) == 1

    def test_a_missing_signature_is_advisory_only(self):
        body = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": (
                    "The manifest is short by four crates and I counted every one of them myself."
                ),
                "metrics": _locked_payload(),
                "signature_phrases": ["stays shut"],
            },
        ).json()
        kinds = [v["kind"] for v in body["violations"]]
        assert "missing_signature" in kinds
        assert body["violations"][kinds.index("missing_signature")]["escalates"] is False
        # An in-register line that simply omits the catchphrase must not be
        # escalated: a character does not say their tic in every sentence.
        assert body["judged"] is True
        assert body["severity"] in ("ok", "minor")

    def test_a_short_candidate_is_unjudged_not_a_false_positive(self):
        body = _client().post(
            "/voice/check",
            json={"character": "Marcus", "candidate_text": "No.", "metrics": _locked_payload()},
        ).json()
        assert body["judged"] is False
        assert body["score"] == 0
        assert body["severity"] == "ok"
        assert "candidate has" in body["reason"]

    def test_an_empty_candidate_is_unjudged(self):
        body = _client().post(
            "/voice/check",
            json={"character": "Marcus", "candidate_text": "", "metrics": _locked_payload()},
        ).json()
        assert body["judged"] is False
        assert body["deltas"] == []

    def test_a_garbage_fingerprint_degrades_instead_of_erroring(self):
        response = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": IN_CHARACTER,
                "metrics": {"token_count": "not a number", "bogus_key": 3},
            },
        )
        # The stored fingerprint is a Json column passed through verbatim, so a
        # row from an older build must not 422 the writer's line. The candidate
        # is long enough to be judged, so judged=False can only be the locked
        # side failing — which is what this test is about.
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["judged"] is False
        assert "locked sample" in body["reason"]

    def test_a_missing_fingerprint_degrades_instead_of_erroring(self):
        response = _client().post(
            "/voice/check",
            json={"character": "Marcus", "candidate_text": IN_CHARACTER},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["judged"] is False
        assert "locked sample" in body["reason"]

    def test_every_delta_field_survives_the_response_model(self):
        body = _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": OUT_OF_CHARACTER,
                "metrics": _locked_payload(),
            },
        ).json()

        assert body["deltas"], "a judged report must carry its axis table"
        expected = {
            "axis",
            "label",
            "locked",
            "candidate",
            "delta",
            "units",
            "weight",
            "tolerance",
            "direction",
            "skipped",
            "skip_reason",
        }
        assert set(body["deltas"][0]) == expected
        # Skipped axes are kept so the panel can explain a non-count.
        assert all(set(d) == expected for d in body["deltas"])

    def test_check_makes_no_model_call(self, monkeypatch):
        fake = patch_route_model(monkeypatch, voice_route, CountingChatModel(_named()))
        _client().post(
            "/voice/check",
            json={
                "character": "Marcus",
                "candidate_text": IN_CHARACTER,
                "metrics": _locked_payload(),
            },
        )
        # The whole point of the endpoint: free to run, so it can run per line.
        assert fake.calls == 0
        assert fake.factory_calls == 0

    def test_an_oversized_candidate_is_rejected(self):
        response = _client().post(
            "/voice/check",
            json={"candidate_text": "x " * 3_000, "metrics": _locked_payload()},
        )
        assert response.status_code == 422

    def test_a_non_string_phrase_is_rejected_by_the_schema(self):
        response = _client().post(
            "/voice/check",
            json={
                "candidate_text": "The crate stays shut.",
                "metrics": _locked_payload(),
                "never_says": [{"nope": 1}],
            },
        )
        assert response.status_code == 422


# --------------------------------------------------------------------------- #
# Wiring — the endpoints exist, are gated, and are documented
# --------------------------------------------------------------------------- #


class TestWiring:
    def test_both_endpoints_are_registered(self):
        from app.main import app

        paths = {route.path for route in app.routes if hasattr(route, "path")}
        spec_paths = set(app.openapi()["paths"])
        assert {"/voice/lock", "/voice/check"} <= paths | spec_paths

    def test_both_endpoints_honour_the_api_key_gate(self, monkeypatch):
        from app import security

        monkeypatch.setattr(security.settings, "writers_room_api_key", "demo-key")
        client = _client()

        assert client.post("/voice/lock", json=_lock_body()).status_code == 401
        assert (
            client.post(
                "/voice/check",
                json={"candidate_text": "x", "metrics": _locked_payload()},
            ).status_code
            == 401
        )

    def test_the_check_limiter_is_looser_than_the_lock_limiter(self):
        # Checking is free and meant to run per line; locking costs a model
        # call. One shared bucket would throttle the free path to protect the
        # expensive one.
        assert voice_route._check_limiter.max_calls > voice_route._lock_limiter.max_calls
