"""Character voice lock — measure a voice, name it, check a line against it.

Two endpoints, and the split between them is the whole design:

* ``POST /voice/lock`` — harvest every line a named character speaks on the
  canvas, measure the fingerprint **in code** (layer 1,
  :mod:`app.orchestration.voice`), then make one IBM Granite call to *name*
  what was measured (layer 2: register label, signature phrases, vocabulary
  domain, and the words this character would never say). Granite describes a
  voice; it never scores one.

* ``POST /voice/check`` — judge a candidate line against a stored fingerprint.
  **No model call at all.** The verdict is arithmetic plus two hard rules, so it
  is free to run, fast enough to run per line, and identical every time. This is
  the project's trust thesis applied to dialogue: the verdict lives in
  application code, not in a model's opinion of its own output.

Both halves refuse rather than guess. A sample below ``MIN_LOCK_TOKENS`` words
comes back ``status="insufficient_sample"`` *before* the model call is spent, and
any layer-2 failure — a parse error, a dead provider, a backend with no
structured-output support, missing credentials — still returns the measured
fingerprint as ``status="unnamed"``. Neither endpoint has an error status of its
own: the numbers are the deterministic artifact and are worth keeping even when
the prose naming is not.

Nothing persists here: this service has no database handle, and the canvas graph
lives in the browser. The browser locks a voice, then POSTs the result to the
Next.js route that owns Postgres. See ``web/lib/voice.ts``.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.llm import get_chat_model
from app.orchestration.context import build_user_prompt, system_prompt_with_guard
from app.orchestration.structured import invoke_structured
from app.orchestration.voice import (
    MIN_LOCK_TOKENS,
    Severity,
    can_lock,
    evaluate_voice,
    find_dialogue_for,
    metrics_from_lines,
)
from app.security import RateLimiter, require_api_key

logger = logging.getLogger("writers_room.voice")

# Two limiters, not one. Locking costs a model call; checking is pure arithmetic
# and is meant to run on every line the writer types. A single shared bucket
# would throttle the free path to protect the expensive one.
_lock_limiter = RateLimiter(max_calls=10, window_seconds=60)
_check_limiter = RateLimiter(max_calls=60, window_seconds=60)
router = APIRouter(prefix="/voice", tags=["voice"])

# Sample sizes above the lock floor at which the fingerprint stops being a
# rough read. Advisory only — the *gate* is MIN_LOCK_TOKENS; these bands just
# let the UI say how much to trust a lock instead of showing a bare number.
_CONFIDENCE_LOW = 80
_CONFIDENCE_MEDIUM = 200

_SYSTEM = (
    "You are a dialogue coach and script editor. You NAME a voice you are shown: "
    "you describe its register, quote the phrases it actually uses, and identify the "
    "words that would sound wrong coming out of this character's mouth. "
    "You never score a voice, rate it, or judge whether it is good writing — every "
    "number in this system is measured elsewhere, in code, from the text itself. "
    "You quote only from the lines you are given; you never invent a phrase the "
    "character has not said. If a field has no honest answer from this sample, "
    "return an empty string or an empty list rather than filling it in."
)

# --------------------------------------------------------------------------- #
# Models — layer 1 (measured in code, never produced by the model)
# --------------------------------------------------------------------------- #


class StyleMetricsOut(BaseModel):
    """Wire form of ``StyleMetrics`` — the 14 measured fields, same order.

    No field descriptions: the model never produces this object, so a
    description here would be documentation pretending to be a prompt.
    """

    token_count: int
    sentence_count: int
    mean_sentence_length: float
    sentence_length_stdev: float
    mean_word_length: float
    contraction_rate: float
    hedge_rate: float
    intensifier_rate: float
    first_person_rate: float
    lexical_diversity: float
    question_rate: float
    exclamation_rate: float
    interruption_rate: float
    ellipsis_rate: float


class SampleReport(BaseModel):
    """How much evidence the lock was built from — all code-derived.

    Surfaced on every response, including the refusals, so a writer whose lock
    failed can see exactly how far short the sample fell.
    """

    nodes_scanned: int
    lines_found: int
    tokens: int
    min_tokens_required: int
    confidence: Literal["none", "low", "medium", "high"]


# --------------------------------------------------------------------------- #
# Models — layer 2 (named by Granite)
#
# This class is both the ``invoke_structured`` schema and the nested response
# field, so the descriptions below are live prompt engineering: they are what
# the model actually reads. Edit them as prompt text, not as docs.
# --------------------------------------------------------------------------- #


class VoiceRegister(BaseModel):
    register_label: str = Field(
        max_length=60,
        description="A 2-5 word name for this voice's register, e.g. 'clipped military deadpan'.",
    )
    description: str = Field(
        max_length=400,
        description="1-2 sentences on how this character sounds and why.",
    )
    signature_phrases: list[str] = Field(
        description=(
            "2-5 exact phrases or verbal tics this character actually uses, quoted from "
            "the sample. Empty list if nothing recurs."
        )
    )
    vocabulary_domain: str = Field(
        max_length=120,
        description="The lexical world they draw on, e.g. 'seafaring and debt'.",
    )
    never_says: list[str] = Field(
        description=(
            "3-6 short words or phrases that would read as out of character for this "
            "voice. Single words or two-word phrases, never sentences."
        )
    )


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #


class VoiceLockRequest(BaseModel):
    room_id: str = Field(..., max_length=80)
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=60)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=120)
    story_facts: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    character: str = Field(..., max_length=80)


class VoiceCheckRequest(BaseModel):
    character: str = Field(default="", max_length=80)
    candidate_text: str = Field(..., max_length=4_000)
    # Deliberately untyped: this is the Postgres Json column handed back
    # verbatim. ``evaluate_voice`` absorbs missing, extra, and garbage keys, so
    # a fingerprint locked by an older build degrades to "insufficient sample"
    # instead of 422-ing the writer's line.
    metrics: dict[str, Any] = Field(default_factory=dict)
    never_says: list[str] = Field(default_factory=list, max_length=40)
    signature_phrases: list[str] = Field(default_factory=list, max_length=40)


# --------------------------------------------------------------------------- #
# Responses
# --------------------------------------------------------------------------- #


class VoiceLockResult(BaseModel):
    """The outcome of a lock attempt.

    ``status`` is the discriminator the UI branches on:

    * ``locked`` — both layers present, ready to persist and check against.
    * ``insufficient_sample`` — the gate refused before any model call;
      ``message`` explains what is missing, ``metrics`` is None.
    * ``unnamed`` — layer 1 measured, layer 2 unavailable. Still persistable:
      drift scoring works on metrics alone, and only the hard rules are lost.

    Layer 2 is ``voice_register`` rather than the more natural ``register``
    because a field of that name shadows ``BaseModel.register`` and Pydantic
    warns on import. Do not rename it back.
    """

    status: Literal["locked", "insufficient_sample", "unnamed"]
    character: str
    message: str | None = None
    metrics: StyleMetricsOut | None = None
    voice_register: VoiceRegister | None = None
    sample: SampleReport


class AxisDeltaOut(BaseModel):
    """One measured axis of difference. Mirrors ``AxisDelta.as_dict()``."""

    axis: str
    label: str
    locked: float
    candidate: float
    delta: float
    units: float
    weight: float
    tolerance: float = 0.0
    direction: str = ""
    skipped: bool = False
    skip_reason: str | None = None


class VoiceViolationOut(BaseModel):
    """A hard rule break. Mirrors ``VoiceViolation.as_dict()``."""

    kind: Literal["never_says", "missing_signature"]
    detail: str
    severity: Severity
    escalates: bool = True


class VoiceCheckResult(BaseModel):
    """Mirrors ``VoiceDriftReport.as_dict()`` key-for-key.

    It has to: ``response_model`` silently drops fields it has not declared, so
    a field missing here would vanish from the wire while every backend test
    still passed. Skipped deltas are kept deliberately — the panel needs
    ``tolerance`` and ``skip_reason`` to explain why a visible-looking
    difference did not count, instead of appearing to ignore it.
    """

    character: str
    judged: bool
    score: int
    severity: Severity
    summary: str
    deltas: list[AxisDeltaOut]
    violations: list[VoiceViolationOut]
    candidate_tokens: int
    locked_tokens: int
    reason: str | None = None


# --------------------------------------------------------------------------- #
# Helpers — pure, no model, no I/O (unit tested in tests/test_pure_logic.py)
# --------------------------------------------------------------------------- #


def _node_text(node: dict[str, Any]) -> str:
    """The prose body of a canvas node, where dialogue lives."""
    data = node.get("data", {}) or {}
    return str(data.get("content") or "").strip()


def _harvest(nodes: list[dict[str, Any]], character: str) -> list[str]:
    """Every line ``character`` speaks across the canvas, in node order.

    Node order does not affect any fingerprint field — each one is a rate or a
    mean over the joined sample — so this deliberately skips the topological
    sort that the tension curve needs.
    """
    lines: list[str] = []
    for node in nodes:
        lines.extend(find_dialogue_for(_node_text(node), character))
    return lines


def _confidence_band(tokens: int) -> Literal["none", "low", "medium", "high"]:
    """How much to trust a lock built from ``tokens`` words of dialogue."""
    if tokens < MIN_LOCK_TOKENS:
        return "none"
    if tokens < _CONFIDENCE_LOW:
        return "low"
    if tokens < _CONFIDENCE_MEDIUM:
        return "medium"
    return "high"


def _clean_phrases(items: list[str] | None, *, limit: int, max_len: int) -> list[str]:
    """Normalise a phrase list: drop blanks, dedupe case-insensitively, cap.

    Not cosmetic. ``check_violations`` has no dedupe, so ``["Synergy",
    "synergy"]`` would raise two blockers for one word and make a single slip
    look like a pattern; and a blank entry reaches ``phrase.strip()`` on a
    non-``str`` and raises. Applied to model output on ``/lock`` and to request
    input on ``/check``, because neither source is trustworthy.
    """
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in items or []:
        phrase = str(item or "").strip()[:max_len].strip()
        key = phrase.lower()
        if not phrase or key in seen:
            continue
        seen.add(key)
        cleaned.append(phrase)
        if len(cleaned) >= limit:
            break
    return cleaned


def _character_bio(nodes: list[dict[str, Any]], name: str) -> str:
    """The character node's own description, if the canvas has one.

    Gives layer 2 the writer's stated intent alongside the measured evidence —
    "ex-soldier, ashamed of it" explains a clipped register that the numbers can
    only report.
    """
    needle = name.lower()
    for node in nodes:
        data = node.get("data", {}) or {}
        if str(data.get("node_type") or "").strip() != "character":
            continue
        title = str(data.get("title") or data.get("label") or "").lower()
        if needle in title:
            return _node_text(node)
    return ""


def _character_facts(story_facts: list[dict[str, Any]]) -> str:
    """Story-bible canon about characters, as prompt lines."""
    lines = [
        f"- {f.get('content', '')}"
        for f in story_facts
        if str(f.get("category", "")).strip() == "character" and f.get("content")
    ]
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


@router.post(
    "/lock",
    response_model=VoiceLockResult,
    dependencies=[Depends(require_api_key), Depends(_lock_limiter)],
)
async def lock_voice(req: VoiceLockRequest) -> VoiceLockResult:
    """Measure a character's voice from the canvas, then ask Granite to name it."""
    name = req.character.strip()

    # A blank name makes ``find_dialogue_for`` return [] for every node, which is
    # indistinguishable from "this character never speaks". Say what actually
    # went wrong instead, and spend nothing doing it.
    if not name:
        return VoiceLockResult(
            status="insufficient_sample",
            character="",
            message="Name the character whose voice you want to lock.",
            sample=SampleReport(
                nodes_scanned=len(req.nodes),
                lines_found=0,
                tokens=0,
                min_tokens_required=MIN_LOCK_TOKENS,
                confidence="none",
            ),
        )

    lines = _harvest(req.nodes, name)
    ok, refusal = can_lock(lines)
    if not ok:
        # The gate closes *before* the model call — a thin sample costs nothing.
        # ``refusal`` is user-facing prose that already interpolates the
        # threshold, so it is rendered verbatim and never pattern-matched.
        return VoiceLockResult(
            status="insufficient_sample",
            character=name,
            message=refusal,
            sample=SampleReport(
                nodes_scanned=len(req.nodes),
                lines_found=len(lines),
                tokens=metrics_from_lines(lines).token_count,
                min_tokens_required=MIN_LOCK_TOKENS,
                confidence="none",
            ),
        )

    metrics = metrics_from_lines(lines)
    sample = SampleReport(
        nodes_scanned=len(req.nodes),
        lines_found=len(lines),
        tokens=metrics.token_count,
        min_tokens_required=MIN_LOCK_TOKENS,
        confidence=_confidence_band(metrics.token_count),
    )

    # The dialogue itself is the signal here, so the prompt carries the numbered
    # lines plus what the canvas says *about* this character — not the whole
    # spatial dump, which would bury the sample in plot summary.
    numbered = "\n".join(f"{i + 1}. {line}" for i, line in enumerate(lines))
    user = build_user_prompt(
        f"Name the voice of {name} from these {len(lines)} lines of their own dialogue. "
        "Quote signature phrases only from these lines. For never_says, give short "
        "words or phrases that would clash with this register.",
        numbered,
        _character_bio(req.nodes, name),
        _character_facts(req.story_facts),
    )

    # A real fallback rather than the usual ``fallback=None``: layer 1 is
    # deterministic and already earned, so a provider hiccup should cost the
    # naming, not the fingerprint. ``status="unnamed"`` tells the UI which
    # happened.
    unnamed = VoiceRegister(
        register_label="unnamed voice",
        description="",
        signature_phrases=[],
        vocabulary_domain="",
        never_says=[],
    )

    # ``invoke_structured`` already returns the fallback for parse failures,
    # provider errors, and a backend that cannot do structured output at all.
    # The except catches what happens *before* it: ``get_chat_model`` raises if
    # watsonx is selected without credentials, and the sibling routes let that
    # become a 500 because they have nothing to return. This one does, so it
    # degrades the same way every other layer-2 failure does — the operator gets
    # the traceback in the log, the writer gets their fingerprint.
    try:
        register = invoke_structured(
            get_chat_model(temperature=0.4, max_tokens=900),
            VoiceRegister,
            system_prompt_with_guard(_SYSTEM),
            user,
            max_attempts=2,
            fallback=unnamed,
        )
    except Exception:  # noqa: BLE001 — keep provider detail server-side
        logger.exception("voice lock naming failed; returning the measured fingerprint")
        register = unnamed

    register.signature_phrases = _clean_phrases(register.signature_phrases, limit=5, max_len=80)
    register.never_says = _clean_phrases(register.never_says, limit=6, max_len=60)

    named = register.register_label.strip() != unnamed.register_label
    return VoiceLockResult(
        status="locked" if named else "unnamed",
        character=name,
        message=None if named else "Voice measured, but the register could not be named.",
        metrics=StyleMetricsOut.model_validate(metrics.as_dict()),
        voice_register=register,
        sample=sample,
    )


@router.post(
    "/check",
    response_model=VoiceCheckResult,
    dependencies=[Depends(require_api_key), Depends(_check_limiter)],
)
async def check_voice(req: VoiceCheckRequest) -> VoiceCheckResult:
    """Judge a candidate line against a locked fingerprint. No model call.

    There is no try/except and no early return because there is nothing here to
    fail: ``evaluate_voice`` is total by design — empty text, an empty metrics
    dict, and a below-threshold locked sample all come back as a well-formed
    report with ``judged=False`` and a reason. Pydantic rejects the one input it
    cannot absorb (a non-string in a phrase list) as a 422 before this runs.
    """
    report = evaluate_voice(
        req.candidate_text,
        req.metrics,
        character=req.character.strip(),
        never_says=_clean_phrases(req.never_says, limit=40, max_len=60),
        signature_phrases=_clean_phrases(req.signature_phrases, limit=40, max_len=80),
    )
    return VoiceCheckResult.model_validate(report.as_dict())
