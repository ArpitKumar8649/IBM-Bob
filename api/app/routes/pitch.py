"""Pitch deck generator — turn a story graph into a producer-ready pitch.

``POST /pitch/generate`` takes the current canvas (nodes + edges) and the
story-bible facts, then uses IBM Granite to produce a structured pitch:

* logline        — one sentence that sells the story
* title          — a working title
* synopsis       — a tight 1-paragraph summary
* genre / tone — where it sits and how it feels
* comparable_titles — "It's X meets Y" positioning
* characters     — short bios for the leads
* themes         — the ideas the story explores
* hook           — why this, why now

The output is structured JSON so the frontend can render it as a polished
multi-slide deck. This is the artifact a real writers' room produces to sell
a show — directly answering the brief's "bridge imagination and execution."
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.llm import get_chat_model
from app.orchestration.context import build_spatial_context, fence_untrusted
from app.orchestration.structured import invoke_structured
from app.security import RateLimiter, require_api_key

logger = logging.getLogger("writers_room.pitch")

_rate_limiter = RateLimiter(max_calls=10, window_seconds=60)
router = APIRouter(
    prefix="/pitch",
    tags=["pitch"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter)],
)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #


class PitchCharacter(BaseModel):
    name: str = Field(description="Character name.")
    role: str = Field(description="Their role, e.g. Protagonist, Antagonist.")
    bio: str = Field(description="A 1-2 sentence bio: who they are and what they want.")


class PitchDeck(BaseModel):
    title: str = Field(description="A compelling working title for the story.")
    logline: str = Field(
        description="A single, gripping sentence that sells the whole story."
    )
    synopsis: str = Field(
        description="A tight 3-5 sentence summary of the story's premise and arc."
    )
    genre: str = Field(description="Primary genre, e.g. Sci-Fi Thriller.")
    tone: str = Field(description="The tone/mood, e.g. tense, hopeful, noir.")
    comparable_titles: list[str] = Field(
        description='2-3 "It\'s X meets Y" style comparable titles for positioning.'
    )
    characters: list[PitchCharacter] = Field(
        description="Short bios for the 2-4 lead characters."
    )
    themes: list[str] = Field(
        description="2-4 central themes the story explores."
    )
    hook: str = Field(
        description="One sentence on why this story, why now — its unique hook."
    )


class PitchRequest(BaseModel):
    room_id: str = Field(..., max_length=80)
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=60)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=120)
    story_facts: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    # Optional writer guidance to steer the pitch.
    notes: str | None = Field(None, max_length=2_000)


# --------------------------------------------------------------------------- #
# Endpoint
# --------------------------------------------------------------------------- #


_SYSTEM_PROMPT = (
    "You are a seasoned showrunner and pitch consultant. You turn a story's raw "
    "materials — its beats, characters, locations, and lore — into a sharp, "
    "sellable pitch deck. You write with confidence and clarity, the way a "
    "professional pitches to a studio. You never invent major plot points that "
    "contradict the provided material; you synthesize and elevate what's there. "
    "Keep every field concise and punchy."
)


@router.post("/generate", response_model=PitchDeck)
async def generate_pitch(req: PitchRequest) -> PitchDeck:
    """Generate a structured pitch deck from the story graph + bible."""
    spatial = build_spatial_context(req.nodes, req.edges)

    parts = [
        "Create a compelling pitch deck for the story described by the materials "
        "below. Synthesize the beats, characters, and lore into a professional, "
        "sellable pitch. Fill every field."
    ]

    if req.notes and req.notes.strip():
        parts.append("\n\n[writer's guidance]\n" + fence_untrusted(req.notes))

    parts.append("\n\n[story canvas — beats and structure]\n" + fence_untrusted(spatial))

    if req.story_facts:
        fact_lines = []
        for f in req.story_facts:
            cat = f.get("category", "lore")
            content = f.get("content", "")
            fact_lines.append(f"- [{cat}] {content}")
        parts.append(
            "\n\n[story bible — established canon]\n" + fence_untrusted("\n".join(fact_lines))
        )

    user_prompt = "".join(parts)

    llm = get_chat_model(temperature=0.7, max_tokens=1500)
    try:
        deck = invoke_structured(
            llm,
            PitchDeck,
            _SYSTEM_PROMPT,
            user_prompt,
            max_attempts=2,
            fallback=None,
        )
    except Exception:  # noqa: BLE001 — keep provider detail server-side
        logger.exception("pitch generation failed")
        raise HTTPException(
            status_code=502,
            detail="Could not generate the pitch. Please retry.",
        ) from None

    return deck
