"""Coverage report — a professional script-reader's report on the story.

``POST /coverage/generate`` reads the current canvas (nodes + edges) and the
story-bible facts, then uses IBM Granite to produce industry-standard
**coverage**: the artifact a studio reader or coverage service sells for
$50–$150 per script. It contains a logline, a premise, a verdict
(Recommend / Consider / Pass), a 1–10 overall score, strengths, weaknesses,
plot holes, per-character notes, a structure note, and a marketability read.

This is the Real-World-Impact headline of the project: an indie screenwriter
or game narrative designer who cannot afford a writers' room or a coverage
reader gets professional coverage from their canvas, free.

The verdict and score are produced by Granite *as a reader evaluating the
work* (its job), but they are surfaced as discrete, structured fields the UI
renders as a badge + meter — never buried in prose — so the writer can act on
them. (Note: this is distinct from the debate *gate*, whose APPROVE/REJECT is
computed deterministically in application code from the critics' structured
scores; see ``merge_agent`` in ``agent_graph.py``.)
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.llm import get_chat_model
from app.orchestration.context import build_spatial_context, fence_untrusted
from app.orchestration.structured import invoke_structured
from app.security import RateLimiter, daily_budget, require_api_key

logger = logging.getLogger("writers_room.coverage")

_rate_limiter = RateLimiter(max_calls=10, window_seconds=60)
# One model call per report, charged to the process-wide daily ceiling.
_budget = daily_budget.cost(1)
router = APIRouter(
    prefix="/coverage",
    tags=["coverage"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter), Depends(_budget)],
)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #


class CharacterNote(BaseModel):
    name: str = Field(description="Character name.")
    note: str = Field(
        description="A 1-2 sentence reader's note on this character (clarity, arc, voice)."
    )


class CoverageReport(BaseModel):
    logline: str = Field(
        description="A single-sentence logline as a reader would write it."
    )
    premise: str = Field(
        description="A 2-3 sentence statement of the dramatic premise and central conflict."
    )
    verdict: Literal["Recommend", "Consider", "Pass"] = Field(
        description=(
            "The reader's verdict. Recommend = strong, ready to advance; "
            "Consider = promising with real work needed; Pass = not viable as-is."
        )
    )
    overall_score: int = Field(
        ge=1,
        le=10,
        description="Overall score from 1 (weak) to 10 (exceptional).",
    )
    strengths: list[str] = Field(
        description="2-4 concrete strengths, each citing what works and why."
    )
    weaknesses: list[str] = Field(
        description="2-4 concrete weaknesses, each specific and actionable."
    )
    plot_holes: list[str] = Field(
        description=(
            "0-3 continuity/logic problems or contradictions found in the material "
            "(empty list if none)."
        )
    )
    character_notes: list[CharacterNote] = Field(
        description="A short reader's note for each significant character present."
    )
    structure_note: str = Field(
        description=(
            "A 2-3 sentence note on dramatic structure: pacing, act shape, "
            "turning points, and where the story sags or rushes."
        )
    )
    marketability: str = Field(
        description=(
            "A 1-2 sentence read on audience, comparables, and commercial appeal."
        )
    )


class CoverageRequest(BaseModel):
    room_id: str = Field(..., max_length=80)
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=60)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=120)
    story_facts: list[dict[str, Any]] = Field(default_factory=list, max_length=30)


# --------------------------------------------------------------------------- #
# Endpoint
# --------------------------------------------------------------------------- #


_SYSTEM_PROMPT = (
    "You are a seasoned professional script reader writing formal coverage for a "
    "studio. You have read many scripts and you judge honestly and specifically: "
    "coverage that praises everything is worthless, so you name real strengths AND "
    "real weaknesses, and your verdict and score reflect your genuine read of the "
    "material as presented. You never invent plot that isn't in the material; you "
    "evaluate only what is there, and you flag gaps and contradictions plainly. "
    "Keep every field concise, concrete, and professional."
)


def _story_context(req: CoverageRequest) -> str:
    """Assemble the fenced canvas + story-bible context for the reader."""
    spatial = build_spatial_context(req.nodes, req.edges)
    parts = [
        "[story material under review — beats, characters, structure]\n"
        + fence_untrusted(spatial)
    ]
    if req.story_facts:
        fact_lines = [
            f"- [{f.get('category', 'lore')}] {f.get('content', '')}"
            for f in req.story_facts
        ]
        parts.append(
            "\n\n[story bible — established canon the reader should respect]\n"
            + fence_untrusted("\n".join(fact_lines))
        )
    return "".join(parts)


@router.post("/generate", response_model=CoverageReport)
async def generate_coverage(req: CoverageRequest) -> CoverageReport:
    """Generate a professional coverage report from the story graph + bible."""
    user = (
        "Read the story material below and write formal coverage. Assess it on its "
        "merits: give an honest verdict (Recommend / Consider / Pass), a 1-10 score, "
        "specific strengths and weaknesses, any plot holes or contradictions you find, "
        "a note per significant character, a structure note, and a marketability read. "
        "Fill every field.\n\n" + _story_context(req)
    )

    llm = get_chat_model(temperature=0.5, max_tokens=1800)
    try:
        return invoke_structured(
            llm, CoverageReport, _SYSTEM_PROMPT, user, max_attempts=2, fallback=None
        )
    except Exception:  # noqa: BLE001 — keep provider detail server-side
        logger.exception("coverage generation failed")
        raise HTTPException(
            status_code=502,
            detail="Could not generate coverage. Please retry.",
        ) from None
