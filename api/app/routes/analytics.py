"""Pacing / tension analytics — a per-beat tension curve with code-derived insights.

``POST /analytics/tension`` orders the canvas beats topologically, asks IBM
Granite (structured output) for a per-beat dramatic-tension score *in that
exact order*, then computes the structural insights (climax placement, flat
stretches, overall shape) **in application code** from those numbers.

Design principle (same as the debate gate): the model supplies the *numbers*;
the *judgment about structure* is computed here, never asked of the model. The
model is told the beats in a numbered list and instructed to return one entry
per beat in order, never reordering or skipping — and the route aligns the
model's list back to the ordered beats by index, padding neutrally if the model
returns too few, so a sloppy model can't desync the curve from the canvas.

Pure, network-free logic lives in ``app.orchestration.ordering`` and is unit
tested directly.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.llm import get_chat_model
from app.orchestration.context import (
    build_spatial_context,
    build_user_prompt,
    fence_untrusted,
    system_prompt_with_guard,
)
from app.orchestration.ordering import compute_insights, order_nodes
from app.orchestration.structured import invoke_structured
from app.security import RateLimiter, require_api_key

logger = logging.getLogger("writers_room.analytics")

_rate_limiter = RateLimiter(max_calls=15, window_seconds=60)
router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter)],
)

Pacing = Literal["quiet", "slow", "building", "peak", "falling"]

# A node counts as a "beat" for the tension curve if its type is beat-like.
# character / location / note nodes carry no dramatic-tension reading of their
# own, so they are excluded from the curve (but still inform the model's view
# of the story via the spatial context).
_BEAT_TYPES = {"", "plot_beat", "beat"}


# --------------------------------------------------------------------------- #
# Models — what the model returns (per-beat numbers only)
# --------------------------------------------------------------------------- #


class _BeatTension(BaseModel):
    tension: int = Field(ge=1, le=10, description="Dramatic tension, 1 (flat) to 10 (peak).")
    pacing: Pacing = Field(description="Pacing tag for this beat.")
    note: str = Field(max_length=240, description="One-line reason for the score.")


class _ModelTensionReading(BaseModel):
    beats: list[_BeatTension] = Field(
        description="One entry per numbered beat, in the exact order given. Do not reorder or skip."
    )


# --------------------------------------------------------------------------- #
# Models — what the route returns (numbers + code-derived insights)
# --------------------------------------------------------------------------- #


class Peak(BaseModel):
    index: int
    title: str
    tension: float


class FlatStretch(BaseModel):
    start_index: int
    length: int
    beat_titles: list[str]


class PacingInsights(BaseModel):
    avg_tension: float
    peak: Peak | None
    climax_position: float | None
    climax_in_back_third: bool | None
    shape: str
    flat_stretch: FlatStretch | None


class TensionBeatOut(BaseModel):
    title: str
    tension: int
    pacing: Pacing
    note: str


class TensionAnalysis(BaseModel):
    beats: list[TensionBeatOut]
    insights: PacingInsights


# --------------------------------------------------------------------------- #
# Request
# --------------------------------------------------------------------------- #


class TensionRequest(BaseModel):
    room_id: str = Field(..., max_length=80)
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=60)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=120)
    story_facts: list[dict[str, Any]] = Field(default_factory=list, max_length=30)


# --------------------------------------------------------------------------- #
# Endpoint
# --------------------------------------------------------------------------- #


_SYSTEM = (
    "You are a story-structure analyst scoring dramatic tension. You read beats "
    "in the order given and assign each a tension score from 1 (flat, no stakes) "
    "to 10 (peak dramatic intensity), a pacing tag, and a one-line reason. You "
    "score relative to the surrounding beats so the curve has shape. You return "
    "exactly one entry per numbered beat, in order — never reorder, never skip, "
    "never add."
)


def _beat_title(node: dict[str, Any]) -> str:
    data = node.get("data", {}) or {}
    return str(data.get("title") or data.get("label") or "untitled beat").strip() or "untitled beat"


def _beat_content(node: dict[str, Any]) -> str:
    data = node.get("data", {}) or {}
    return str(data.get("content") or "").strip()


def _neutral_reading(title: str) -> _BeatTension:
    return _BeatTension(
        tension=5, pacing="building", note="(no reading — model returned too few entries)"
    )


@router.post("/tension", response_model=TensionAnalysis)
async def tension_analysis(req: TensionRequest) -> TensionAnalysis:
    """Score per-beat tension and return code-derived pacing insights."""
    ordered = order_nodes(req.nodes, req.edges)
    beats = [
        n for n in ordered
        if str((n.get("data", {}) or {}).get("node_type") or "").strip() in _BEAT_TYPES
    ]

    # No beats -> nothing to score; return empty curve + empty insights, no model call.
    if not beats:
        return TensionAnalysis(
            beats=[], insights=PacingInsights.model_validate(compute_insights([]))
        )

    # Build the numbered, fenced list the model scores against (in order).
    numbered = "\n".join(
        f"{i + 1}. {_beat_title(b)}: {_beat_content(b) or '(no detail)'}"
        for i, b in enumerate(beats)
    )
    spatial = build_spatial_context(req.nodes, req.edges)
    facts_block = ""
    if req.story_facts:
        facts_block = "\n\n[story bible]\n" + fence_untrusted(
            "\n".join(
                f"- [{f.get('category', 'lore')}] {f.get('content', '')}"
                for f in req.story_facts
            )
        )

    user = build_user_prompt(
        f"Score the dramatic tension of these {len(beats)} beats. Return exactly "
        f"{len(beats)} entries, one per numbered beat, in this exact order.",
        numbered,
        spatial,
    ) + facts_block

    fallback = _ModelTensionReading(beats=[_neutral_reading(_beat_title(b)) for b in beats])

    llm = get_chat_model(temperature=0.3, max_tokens=1200)
    try:
        reading = invoke_structured(
            llm, _ModelTensionReading, system_prompt_with_guard(_SYSTEM), user,
            max_attempts=2, fallback=fallback,
        )
    except Exception:  # noqa: BLE001 — keep provider detail server-side
        logger.exception("tension analysis failed")
        raise HTTPException(
            status_code=502, detail="Could not score tension. Please retry."
        ) from None

    # Align model output to ordered beats BY INDEX (never trust model order/length).
    model_beats = reading.beats
    out_beats: list[TensionBeatOut] = []
    scored: list[dict[str, Any]] = []
    for i, b in enumerate(beats):
        mb = model_beats[i] if i < len(model_beats) else _neutral_reading(_beat_title(b))
        t = max(1, min(10, int(mb.tension)))  # belt-and-braces clamp
        out_beats.append(
            TensionBeatOut(title=_beat_title(b), tension=t, pacing=mb.pacing, note=mb.note)
        )
        scored.append({"title": _beat_title(b), "tension": t})

    insights = PacingInsights.model_validate(compute_insights(scored))
    return TensionAnalysis(beats=out_beats, insights=insights)
