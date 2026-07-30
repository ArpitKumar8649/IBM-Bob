"""The seam between the voice fingerprint and the debate: the Character Lead.

``test_voice_logic`` proves the drift math; this file proves the *wiring*. The
claim under test is the project's trust thesis reduced to one sentence: a draft
that breaks a character's locked voice is rejected by arithmetic, and no amount
of model approval can talk that rejection down.

So the interesting tests here all point the same way — four critics APPROVE, the
measurement disagrees, and the room still revises. The mirror cases matter just
as much: a room with no locks, and a draft that stays in voice, must behave
exactly as they did before any of this existed.
"""

from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

import app.orchestration.agent_graph as graph
from app.orchestration.agent_graph import (
    _MAX_VOICE_EVIDENCE,
    MAX_REVISIONS,
    _apply_voice_floor,
    _draft_text,
    _voice_evidence_block,
    build_writers_graph,
    measure_draft_voices,
)
from app.orchestration.voice import VoiceDriftReport
from tests.fakes import (
    MARCUS_DRIFTED_BEAT,
    MARCUS_IN_VOICE_BEAT,
    CountingChatModel,
    architect_speaking,
    critic_result,
    locked_marcus,
    patch_chat_model,
    patch_route_model,
)

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _report(**overrides) -> VoiceDriftReport:
    """A well-formed drift report; override only the field under test."""
    base = VoiceDriftReport(
        character="Marcus",
        judged=True,
        score=8,
        severity="ok",
        summary="Marcus: voice holds (drift 8/100).",
        deltas=[],
        violations=[],
        candidate_tokens=30,
        locked_tokens=50,
        reason=None,
    )
    return replace(base, **overrides)


def _verdict(decision="APPROVE", severity="ok", feedback="Character logic holds.") -> dict:
    return {
        "critic": "character",
        "decision": decision,
        "feedback": feedback,
        "severity": severity,
    }


def _state(content: str, voices: list[dict] | None = None) -> dict:
    """A minimal graph state carrying one drafted node and some locks."""
    state = {
        "room_id": "r",
        "user_intent": "draft the handoff",
        "spatial_context": "ctx",
        "story_bible": "",
        "proposed_nodes": [{"label": "The Handoff", "content": content, "node_type": "plot_beat"}],
        "decision": None,
        "critique_feedback": "",
        "critic_results": [],
        "revision_count": 0,
        "error": None,
    }
    if voices is not None:
        state["locked_voices"] = voices
    return state


# --------------------------------------------------------------------------- #
# _draft_text — where a draft's dialogue actually lives
# --------------------------------------------------------------------------- #


class TestDraftText:
    def test_joins_every_nodes_content(self):
        text = _draft_text([{"content": "First beat."}, {"content": "Second beat."}])
        assert "First beat." in text
        assert "Second beat." in text

    def test_separates_nodes_by_a_blank_line(self):
        """A blank line is the attribution wall in ``_attribution_context``.

        Without it, narration ending one node could be read as the lead-in to a
        quote opening the next, and one character would be credited with
        another's line.
        """
        assert _draft_text([{"content": "A."}, {"content": "B."}]) == "A.\n\nB."

    def test_reads_flat_content_not_the_react_flow_envelope(self):
        """``proposed_nodes`` are ``NodeData.model_dump()``, not canvas nodes."""
        assert _draft_text([{"data": {"content": "hidden"}}]) == ""

    @pytest.mark.parametrize("nodes", [None, [], [{}], [{"content": ""}], [{"content": "   "}]])
    def test_nothing_to_read_yields_empty_string(self, nodes):
        assert _draft_text(nodes) == ""

    def test_survives_junk_in_the_node_list(self):
        assert _draft_text(["not a dict", None, 7, {"content": "real"}]) == "real"


# --------------------------------------------------------------------------- #
# measure_draft_voices — the measurement itself
# --------------------------------------------------------------------------- #


class TestMeasureDraftVoices:
    def test_no_locks_measures_nothing(self):
        assert measure_draft_voices([{"content": MARCUS_DRIFTED_BEAT}], []) == []
        assert measure_draft_voices([{"content": MARCUS_DRIFTED_BEAT}], None) == []

    def test_no_draft_measures_nothing(self):
        assert measure_draft_voices([], [locked_marcus()]) == []

    def test_a_locked_character_who_does_not_speak_is_skipped_entirely(self):
        """Absence is not a finding.

        Reporting an unjudged verdict for every silent character would bury the
        one report that matters under three that say "no dialogue".
        """
        beat = "The dock is empty. Dana counts crates alone and says nothing at all."
        assert measure_draft_voices([{"content": beat}], [locked_marcus()]) == []

    def test_in_voice_dialogue_measures_clean(self):
        (report,) = measure_draft_voices([{"content": MARCUS_IN_VOICE_BEAT}], [locked_marcus()])
        assert report.character == "Marcus"
        assert report.judged is True
        assert report.severity == "ok"

    def test_a_register_change_measures_as_a_rejecting_severity(self):
        """No hard rule needed: the statistics alone catch a wholesale rewrite."""
        (report,) = measure_draft_voices([{"content": MARCUS_DRIFTED_BEAT}], [locked_marcus()])
        assert report.judged is True
        assert report.severity in ("major", "blocker")
        assert report.score > 35

    def test_a_never_says_term_measures_as_a_blocker(self):
        voice = locked_marcus(never_says=["synergy"])
        (report,) = measure_draft_voices([{"content": MARCUS_DRIFTED_BEAT}], [voice])
        assert report.severity == "blocker"
        assert "synergy" in report.summary

    def test_only_the_characters_who_speak_are_reported(self):
        voices = [locked_marcus(), locked_marcus(character="Dana")]
        reports = measure_draft_voices([{"content": MARCUS_IN_VOICE_BEAT}], voices)
        assert [r.character for r in reports] == ["Marcus"]

    @pytest.mark.parametrize(
        "voice",
        [
            "not a dict",
            None,
            {"metrics": {}},  # no character name
            {"character": "  ", "metrics": {}},  # blank name
            {"character": "Marcus"},  # no metrics at all
            {"character": "Marcus", "metrics": "corrupt"},  # metrics not a dict
        ],
    )
    def test_an_unusable_lock_is_skipped_not_raised(self, voice):
        """A bad row must never take down a debate round."""
        assert measure_draft_voices([{"content": MARCUS_DRIFTED_BEAT}], [voice]) == []

    def test_garbage_metrics_report_honestly_instead_of_guessing(self):
        """An empty metrics blob is a readable dict, so the character is measured —
        and comes back unjudged, because there is nothing to compare against."""
        (report,) = measure_draft_voices(
            [{"content": MARCUS_DRIFTED_BEAT}], [locked_marcus(metrics={})]
        )
        assert report.judged is False
        assert report.score == 0
        assert report.reason

    def test_a_hard_rule_still_fires_against_an_unmeasurable_lock(self):
        """``never_says`` is categorical — it needs no sample size to be true."""
        voice = locked_marcus(metrics={}, never_says=["synergy"])
        (report,) = measure_draft_voices([{"content": MARCUS_DRIFTED_BEAT}], [voice])
        assert report.judged is False
        assert report.severity == "blocker"

    def test_non_string_rule_entries_do_not_raise(self):
        voice = locked_marcus(never_says=[None, 7, "synergy"], signature_phrases=[None])
        (report,) = measure_draft_voices([{"content": MARCUS_DRIFTED_BEAT}], [voice])
        assert report.severity == "blocker"


# --------------------------------------------------------------------------- #
# _voice_evidence_block — the measurement as prompt text
# --------------------------------------------------------------------------- #


class TestVoiceEvidenceBlock:
    def test_silence_adds_nothing_to_the_prompt(self):
        assert _voice_evidence_block([]) == ""
        assert _voice_evidence_block([_report(judged=False, severity="ok")]) == ""

    def test_a_finding_carries_its_summary_and_its_standing(self):
        block = _voice_evidence_block([_report(severity="major", summary="Marcus: drift 62/100.")])
        assert "Marcus: drift 62/100." in block
        assert "already final" in block
        assert "not a model opinion" in block

    def test_the_measurement_is_not_fenced_as_untrusted(self):
        """These strings are built from numbers this process computed, so they are
        ours. Fencing them would tell the model to distrust its own evidence."""
        block = _voice_evidence_block([_report(severity="major")])
        assert "WRITERS_ROOM_CANVAS_CONTENT" not in block

    def test_an_unmeasured_but_blocking_report_says_why_it_was_not_measured(self):
        block = _voice_evidence_block(
            [_report(judged=False, severity="blocker", reason="candidate has 4 words")]
        )
        assert "not measured: candidate has 4 words" in block

    def test_evidence_is_capped_so_the_draft_still_fits(self):
        reports = [_report(severity="major", summary=f"Voice {i} drifted.") for i in range(9)]
        block = _voice_evidence_block(reports)
        assert block.count("- Voice") == _MAX_VOICE_EVIDENCE


# --------------------------------------------------------------------------- #
# _apply_voice_floor — one-way: the model may worsen a verdict, never soften it
# --------------------------------------------------------------------------- #


class TestVoiceFloor:
    def test_no_measurement_leaves_the_verdict_untouched(self):
        verdict = _verdict()
        assert _apply_voice_floor(verdict, []) is verdict

    def test_a_measurement_that_says_nothing_leaves_the_verdict_untouched(self):
        verdict = _verdict()
        assert _apply_voice_floor(verdict, [_report(judged=False, severity="ok")]) is verdict

    def test_a_measured_blocker_rejects_an_approving_model(self):
        out = _apply_voice_floor(
            _verdict(),
            [_report(severity="blocker", summary='Marcus: uses "synergy".')],
        )
        assert out["decision"] == "REJECT"
        assert out["severity"] == "blocker"
        assert 'uses "synergy"' in out["feedback"]

    def test_a_measured_major_rejects_an_approving_model(self):
        out = _apply_voice_floor(_verdict(), [_report(severity="major")])
        assert out["decision"] == "REJECT"
        assert out["severity"] == "major"

    def test_a_measured_minor_is_reported_without_rejecting(self):
        """Voice has legitimate range. A panel that rejects every slightly-off
        line teaches the writer to ignore the panel."""
        out = _apply_voice_floor(_verdict(), [_report(severity="minor", summary="slight drift")])
        assert out["decision"] == "APPROVE"
        assert out["severity"] == "minor"
        assert "slight drift" in out["feedback"]

    def test_a_clean_measurement_never_softens_the_models_rejection(self):
        """The model sees motive and arc; no metric does. It may still reject."""
        out = _apply_voice_floor(
            _verdict("REJECT", "blocker", "Mira has no reason to be here."), [_report()]
        )
        assert out["decision"] == "REJECT"
        assert out["severity"] == "blocker"
        assert "Mira has no reason to be here." in out["feedback"]

    def test_the_measured_reason_is_read_first(self):
        out = _apply_voice_floor(_verdict(feedback="model prose"), [_report(severity="major")])
        assert out["feedback"].startswith("Measured voice drift:")
        assert out["feedback"].index("Measured") < out["feedback"].index("model prose")

    def test_the_critic_identity_survives_the_floor(self):
        out = _apply_voice_floor(_verdict(), [_report(severity="blocker")])
        assert out["critic"] == "character"
        assert set(out) == set(graph.CriticResult.__annotations__)


# --------------------------------------------------------------------------- #
# The critic node — who sees the measurement, and who does not
# --------------------------------------------------------------------------- #


class TestCriticNode:
    def test_the_character_lead_reads_the_measurement_before_judging(self, monkeypatch):
        fake = patch_route_model(
            monkeypatch, graph, CountingChatModel(critic_result("c", "APPROVE", "ok", "fine"))
        )
        out = graph.critic_character(
            _state(MARCUS_DRIFTED_BEAT, [locked_marcus(never_says=["synergy"])])
        )
        assert "measured voice drift" in fake.prompt_text()
        assert "synergy" in fake.prompt_text()
        assert out["critic_results"][0]["decision"] == "REJECT"

    def test_the_other_critics_are_never_handed_a_measurement(self, monkeypatch):
        """Only one critic measures. The rest must be byte-identical to before —
        a world-rule verdict has no business inheriting a voice rejection."""
        fake = patch_route_model(
            monkeypatch, graph, CountingChatModel(critic_result("w", "APPROVE", "ok", "fine"))
        )
        state = _state(MARCUS_DRIFTED_BEAT, [locked_marcus(never_says=["synergy"])])
        out = graph.critic_world(state)
        assert "measured voice drift" not in fake.prompt_text()
        assert out["critic_results"][0] == {
            "critic": "world",
            "decision": "APPROVE",
            "feedback": "fine",
            "severity": "ok",
        }

    def test_a_room_with_no_locks_prompts_exactly_as_it_did_before(self, monkeypatch):
        fake = patch_route_model(
            monkeypatch, graph, CountingChatModel(critic_result("c", "APPROVE", "ok", "fine"))
        )
        out = graph.critic_character(_state(MARCUS_DRIFTED_BEAT))
        assert "measured voice drift" not in fake.prompt_text()
        assert out["critic_results"][0]["decision"] == "APPROVE"
        assert out["critic_results"][0]["severity"] == "ok"

    def test_a_measured_blocker_survives_a_provider_failure(self, monkeypatch):
        """The floor is applied after the fallback, so the finding is reported
        even when the model could not answer at all."""
        patch_route_model(
            monkeypatch, graph, CountingChatModel(error=RuntimeError("provider down"))
        )
        out = graph.critic_character(
            _state(MARCUS_DRIFTED_BEAT, [locked_marcus(never_says=["synergy"])])
        )
        verdict = out["critic_results"][0]
        assert verdict["decision"] == "REJECT"
        assert verdict["severity"] == "blocker"
        assert "synergy" in verdict["feedback"]

    def test_the_measurement_costs_no_model_call(self, monkeypatch):
        fake = patch_route_model(
            monkeypatch, graph, CountingChatModel(critic_result("c", "APPROVE", "ok", "fine"))
        )
        graph.critic_character(_state(MARCUS_DRIFTED_BEAT, [locked_marcus()]))
        assert fake.calls == 1  # the critique itself, and nothing more


# --------------------------------------------------------------------------- #
# Full graph — the claim, end to end
# --------------------------------------------------------------------------- #


def _all_critics_approve(rounds: int) -> list:
    """Every model in the room approving, for ``rounds`` deliberations."""
    responses: list = []
    for _ in range(rounds):
        responses.append(architect_speaking(MARCUS_DRIFTED_BEAT))
        responses.extend(critic_result(c, "APPROVE", "ok", "no notes") for c in range(4))
    return responses


class TestFullGraph:
    def test_a_voice_blocker_rejects_a_draft_all_four_critics_approved(self, monkeypatch):
        """The headline claim: the verdict is in the code, not the room."""
        patch_chat_model(monkeypatch, _all_critics_approve(MAX_REVISIONS + 1))
        final = build_writers_graph().invoke(
            _state("", [locked_marcus(never_says=["synergy"])]) | {"proposed_nodes": []}
        )
        assert final["decision"] == "REJECT"
        assert "synergy" in final["critique_feedback"]
        # Every model approved, so nothing but the measurement drove the loop.
        assert final["revision_count"] == MAX_REVISIONS

    def test_a_measured_major_alone_rejects_with_no_rule_broken(self, monkeypatch):
        """The threshold itself, pinned: drift ≥ 35 rejects on the numbers only.

        The headline test above leans on ``never_says``, which is a categorical
        rule break — easy to defend, and not the interesting case. Here the lock
        carries no rules at all, so the *only* thing that can reject the round is
        the measured band: this draft scores 48, which is ``major``, which
        :func:`severity_rejects` treats as blocking (bands: 0–17 ok, 18–34 minor,
        35–59 major, 60+ blocker).

        That makes the aggressiveness of the threshold a deliberate, tested claim
        rather than an accident. Narrowing ``_REJECTING_SEVERITIES`` to
        ``{"blocker"}`` would flip this test, which is the point — it is the one
        place that would have to be re-argued.
        """
        patch_chat_model(monkeypatch, _all_critics_approve(MAX_REVISIONS + 1))
        final = build_writers_graph().invoke(_state("", [locked_marcus()]) | {"proposed_nodes": []})
        assert final["decision"] == "REJECT"
        rejects = [r for r in final["critic_results"] if r["decision"] == "REJECT"]
        assert [r["critic"] for r in rejects] == ["character"]
        # A band, not a rule: ``major`` is what a wholesale register change
        # measures. A blocker here would mean a hard rule fired instead.
        assert rejects[0]["severity"] == "major"
        assert "drift" in final["critique_feedback"]
        assert final["revision_count"] == MAX_REVISIONS

    def test_the_same_draft_is_approved_when_the_room_has_no_locks(self, monkeypatch):
        """Backward compatibility, proved at the top: without a lock there is
        nothing to measure and the debate is the one that shipped before."""
        patch_chat_model(monkeypatch, _all_critics_approve(1))
        final = build_writers_graph().invoke(_state("", []) | {"proposed_nodes": []})
        assert final["decision"] == "APPROVE"
        assert final["revision_count"] == 0

    def test_a_draft_that_stays_in_voice_is_approved(self, monkeypatch):
        """The measurement must not fire on good writing, or it is noise."""
        responses: list = [architect_speaking(MARCUS_IN_VOICE_BEAT)]
        responses.extend(critic_result(c, "APPROVE", "ok", "no notes") for c in range(4))
        patch_chat_model(monkeypatch, responses)
        final = build_writers_graph().invoke(
            _state("", [locked_marcus(never_says=["synergy"])]) | {"proposed_nodes": []}
        )
        assert final["decision"] == "APPROVE"

    def test_the_rejection_is_attributed_to_the_character_lead(self, monkeypatch):
        patch_chat_model(monkeypatch, _all_critics_approve(MAX_REVISIONS + 1))
        final = build_writers_graph().invoke(
            _state("", [locked_marcus(never_says=["synergy"])]) | {"proposed_nodes": []}
        )
        rejects = [r for r in final["critic_results"] if r["decision"] == "REJECT"]
        assert rejects, "the measured verdict never reached the merged results"
        assert {r["critic"] for r in rejects} == {"character"}


# --------------------------------------------------------------------------- #
# The wire — locked_voices through /agent/invoke
# --------------------------------------------------------------------------- #


def _request(**overrides) -> dict:
    body = {
        "room_id": "r",
        "user_intent": "draft the handoff",
        "nodes": [{"id": "n1", "data": {"title": "S1", "content": "c"}}],
        "edges": [],
    }
    body.update(overrides)
    return body


class TestLockedVoicesOverTheWire:
    def _client(self) -> TestClient:
        from app.main import app

        return TestClient(app)

    def test_posted_locks_reject_a_draft_the_whole_room_approved(self, monkeypatch):
        patch_chat_model(monkeypatch, _all_critics_approve(MAX_REVISIONS + 1))
        response = self._client().post(
            "/agent/invoke",
            json=_request(locked_voices=[locked_marcus(never_says=["synergy"])]),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["decision"] == "REJECT"
        assert "synergy" in body["debate_feedback"]

    def test_omitting_locked_voices_is_the_previous_behaviour(self, monkeypatch):
        patch_chat_model(monkeypatch, _all_critics_approve(1))
        response = self._client().post("/agent/invoke", json=_request())
        assert response.status_code == 200, response.text
        assert response.json()["decision"] == "APPROVE"

    def test_a_fingerprint_from_an_older_build_does_not_422_the_round(self, monkeypatch):
        """Strict typing here would let one stale row kill a whole debate."""
        patch_chat_model(monkeypatch, _all_critics_approve(1))
        response = self._client().post(
            "/agent/invoke",
            json=_request(
                locked_voices=[{"character": "Marcus", "metrics": {"unknown_axis": "banana"}}]
            ),
        )
        assert response.status_code == 200, response.text

    def test_too_many_locks_is_refused(self):
        response = self._client().post(
            "/agent/invoke", json=_request(locked_voices=[locked_marcus()] * 13)
        )
        assert response.status_code == 422

    def test_an_oversized_metrics_blob_is_refused(self):
        response = self._client().post(
            "/agent/invoke",
            json=_request(
                locked_voices=[{"character": "Marcus", "metrics": {"pad": "x" * 4_097}}]
            ),
        )
        assert response.status_code == 422

    def test_the_stream_reports_the_measured_rejection(self, monkeypatch):
        patch_chat_model(monkeypatch, _all_critics_approve(MAX_REVISIONS + 1))
        with self._client().stream(
            "POST",
            "/agent/stream",
            json=_request(locked_voices=[locked_marcus(never_says=["synergy"])]),
        ) as response:
            assert response.status_code == 200
            payload = response.read().decode()
        assert '"decision": "REJECT"' in payload
        assert "synergy" in payload
