"""Production breakdowns — character sheets and scene/shot-list breakdowns.

Two endpoints that turn the story graph + story bible into production-ready
artifacts, the way a real writers' room / production office would:

* ``POST /breakdown/characters`` — casting-ready character breakdown sheets:
  name, role, age range, appearance, arc summary, key scenes, and a voice note.

* ``POST /breakdown/scenes`` — a scene-by-scene breakdown with a shot list:
  for each scene, INT/EXT, time of day, location, characters present, props,
  a one-line summary, suggested shots, AND a cinematic image prompt (for the
  AI scene-image feature — Granite writes the prompt; an image model renders it).

Both use IBM Granite structured output, grounded in the canvas + story bible.
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

logger = logging.getLogger("writers_room.breakdown")

_rate_limiter = RateLimiter(max_calls=10, window_seconds=60)
router = APIRouter(
    prefix="/breakdown",
    tags=["breakdown"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter)],
)


# --------------------------------------------------------------------------- #
# Models — character breakdown
# --------------------------------------------------------------------------- #


class CharacterBreakdown(BaseModel):
    name: str = Field(description="Character name.")
    role: str = Field(description="Role, e.g. Protagonist, Antagonist, Supporting.")
    age_range: str = Field(description="Approximate age range, e.g. 'late 20s'.")
    appearance: str = Field(
        description="A concise physical description for casting/wardrobe."
    )
    arc_summary: str = Field(
        description="A 1-2 sentence summary of the character's arc in the story."
    )
    key_scenes: list[str] = Field(
        description="2-4 key scenes/moments this character drives or appears in."
    )
    voice_note: str = Field(
        description="A note on how this character speaks (tone, vocabulary, rhythm)."
    )


class CharacterBreakdownResult(BaseModel):
    characters: list[CharacterBreakdown] = Field(
        description="Breakdown sheets for the story's characters."
    )


# --------------------------------------------------------------------------- #
# Models — scene breakdown + shot list
# --------------------------------------------------------------------------- #


class Shot(BaseModel):
    shot_type: str = Field(
        description="Shot type, e.g. WIDE, CLOSE-UP, INSERT, OVER-THE-SHOULDER, TRACKING."
    )
    description: str = Field(description="What the shot shows.")


class SceneBreakdown(BaseModel):
    scene_number: int = Field(description="Sequential scene number.")
    heading: str = Field(
        description="Slugline, e.g. 'INT. LOCKED ROOM - NIGHT'."
    )
    summary: str = Field(description="A one-line summary of what happens.")
    characters: list[str] = Field(description="Characters present in the scene.")
    props: list[str] = Field(description="Notable props or set dressing.")
    time_of_day: str = Field(description="Time of day, e.g. NIGHT, DAY, DAWN.")
    shots: list[Shot] = Field(description="2-4 suggested shots for the scene.")
    image_prompt: str = Field(
        description=(
            "A detailed cinematic image prompt for an AI image model: subject, "
            "setting, lighting, composition, mood, and style. No camera/lens jargon "
            "that an image model can't use; focus on what's visible."
        )
    )


class SceneBreakdownResult(BaseModel):
    scenes: list[SceneBreakdown] = Field(
        description="The scene-by-scene breakdown with shot lists."
    )


# --------------------------------------------------------------------------- #
# Shared request + context builder
# --------------------------------------------------------------------------- #


class BreakdownRequest(BaseModel):
    room_id: str = Field(..., max_length=80)
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=60)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=120)
    story_facts: list[dict[str, Any]] = Field(default_factory=list, max_length=30)


def _story_context(req: BreakdownRequest) -> str:
    """Assemble the fenced canvas + story-bible context for the prompt."""
    spatial = build_spatial_context(req.nodes, req.edges)
    parts = ["[story canvas — beats and structure]\n" + fence_untrusted(spatial)]
    if req.story_facts:
        fact_lines = [
            f"- [{f.get('category', 'lore')}] {f.get('content', '')}"
            for f in req.story_facts
        ]
        parts.append(
            "\n\n[story bible — established canon]\n" + fence_untrusted("\n".join(fact_lines))
        )
    return "".join(parts)


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


@router.post("/characters", response_model=CharacterBreakdownResult)
async def breakdown_characters(req: BreakdownRequest) -> CharacterBreakdownResult:
    """Generate casting-ready character breakdown sheets."""
    system = (
        "You are a casting director and script supervisor. You produce precise, "
        "production-ready character breakdown sheets from a story's materials. You "
        "never invent characters that aren't supported by the material; you "
        "synthesize and detail the ones that are. Keep every field concise and "
        "useful for casting, wardrobe, and the actors."
    )
    user = (
        "Produce character breakdown sheets for every significant character in the "
        "story below. Fill every field for each character.\n\n" + _story_context(req)
    )

    llm = get_chat_model(temperature=0.6, max_tokens=1800)
    try:
        return invoke_structured(
            llm, CharacterBreakdownResult, system, user, max_attempts=2, fallback=None
        )
    except Exception:  # noqa: BLE001 — keep provider detail server-side
        logger.exception("character breakdown failed")
        raise HTTPException(
            status_code=502, detail="Could not generate the character breakdown. Please retry."
        ) from None


@router.post("/scenes", response_model=SceneBreakdownResult)
async def breakdown_scenes(req: BreakdownRequest) -> SceneBreakdownResult:
    """Generate a scene-by-scene breakdown with shot lists + image prompts."""
    system = (
        "You are a 1st Assistant Director and storyboard artist. You break a story "
        "down scene by scene into a production-ready shot list. For each scene you "
        "give the slugline, characters, props, time of day, a tight summary, the "
        "suggested shots, and a vivid cinematic image prompt an AI image model could "
        "render. You stay faithful to the provided material and keep everything "
        "concise and shootable."
    )
    user = (
        "Break the story below into an ordered scene-by-scene breakdown with a shot "
        "list. For each scene, fill every field including a detailed cinematic image "
        "prompt.\n\n" + _story_context(req)
    )

    llm = get_chat_model(temperature=0.6, max_tokens=2500)
    try:
        return invoke_structured(
            llm, SceneBreakdownResult, system, user, max_attempts=2, fallback=None
        )
    except Exception:  # noqa: BLE001 — keep provider detail server-side
        logger.exception("scene breakdown failed")
        raise HTTPException(
            status_code=502, detail="Could not generate the scene breakdown. Please retry."
        ) from None
