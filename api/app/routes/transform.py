"""Tone/genre transfer — rewrite a story node in a new style.

``POST /transform/tone`` takes a node's content and a target tone/genre, then
streams a rewritten version that preserves the plot facts while transforming
the voice, mood, and register. This is the most direct "AI as creative partner"
feature: the writer stays in control, picks the style, and the AI executes.

Available tones: noir, comedy, horror, epic, minimalist, literary, thriller,
romance, sci-fi, fantasy.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.llm import get_chat_model
from app.orchestration.context import fence_untrusted
from app.security import RateLimiter, daily_budget, require_api_key

logger = logging.getLogger("writers_room.transform")

_rate_limiter = RateLimiter(max_calls=30, window_seconds=60)
# One model call per rewrite, charged to the process-wide daily ceiling.
_budget = daily_budget.cost(1)
router = APIRouter(
    prefix="/transform",
    tags=["transform"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter), Depends(_budget)],
)

TONE_PROMPTS: dict[str, str] = {
    "noir": (
        "Rewrite in hard-boiled noir style: short punchy sentences, cynical "
        "first-person voice, rain-slicked metaphors, moral ambiguity. Think "
        "Raymond Chandler meets Blade Runner."
    ),
    "comedy": (
        "Rewrite as comedy: absurd observations, comedic timing, unexpected "
        "juxtapositions, dry wit. Keep the plot intact but make it funny."
    ),
    "horror": (
        "Rewrite as horror: creeping dread, sensory unease, what's unseen is "
        "worse than what's seen. Build tension through implication, not gore."
    ),
    "epic": (
        "Rewrite in epic fantasy register: grand scope, mythic language, "
        "weighty prose, a sense of fate and consequence. Think Tolkien meets "
        "Ursula K. Le Guin."
    ),
    "minimalist": (
        "Rewrite in minimalist style: Hemingway's iceberg theory. Short "
        "sentences. Concrete nouns. Let the reader feel what isn't said."
    ),
    "literary": (
        "Rewrite in literary fiction style: precise, lyrical prose, interior "
        "depth, layered metaphor, attention to the weight of small moments."
    ),
    "thriller": (
        "Rewrite as a thriller: propulsive pacing, cliffhanger tension, "
        "short chapters, every paragraph ends on a hook. Keep the reader "
        "turning pages."
    ),
    "romance": (
        "Rewrite with romantic tension: emotional intimacy, longing, the "
        "electricity of proximity, the ache of what's unsaid between characters."
    ),
    "sci-fi": (
        "Rewrite in hard sci-fi register: precise technical language, "
        "speculative wonder, the uncanny made plausible through detail."
    ),
    "fantasy": (
        "Rewrite in high fantasy register: archaic cadence, elemental imagery, "
        "a sense of ancient power stirring beneath the ordinary."
    ),
}


class TransformRequest(BaseModel):
    content: str = Field(..., max_length=4_000, description="The node content to rewrite.")
    title: str = Field(default="", max_length=200, description="The node title (for context).")
    tone: str = Field(..., description="Target tone/genre. One of: " + ", ".join(TONE_PROMPTS))
    story_facts: list[dict[str, Any]] = Field(
        default_factory=list, max_length=20, description="Relevant story-bible facts."
    )


def _sse(event: str, data: Any) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, default=str)}


@router.post("/tone")
async def transform_tone(req: TransformRequest) -> EventSourceResponse:
    """Stream a tone/genre rewrite of a story node."""
    tone_key = req.tone.lower().strip()
    if tone_key not in TONE_PROMPTS:
        return EventSourceResponse(
            _sse(
                "error",
                {"message": f"Unknown tone '{req.tone}'. Available: {', '.join(TONE_PROMPTS)}"},
            )
            for _ in [None]
        )

    system = (
        "You are a master stylist and genre writer. You rewrite story passages "
        "in a requested tone/genre while preserving ALL plot facts, character "
        "actions, and story logic. You change only the voice, register, and "
        "mood — never the substance. You write vividly and precisely."
    )

    parts = [f"Rewrite the following story passage in this style:\n{TONE_PROMPTS[tone_key]}"]
    if req.title:
        parts.append(f"\n\nNode title: {req.title}")
    parts.append("\n\n[original passage]\n" + fence_untrusted(req.content))
    if req.story_facts:
        fact_lines = [
            f"- [{f.get('category', 'lore')}] {f.get('content', '')}"
            for f in req.story_facts
        ]
        parts.append(
            "\n\n[story bible — preserve these facts]\n"
            + fence_untrusted("\n".join(fact_lines))
        )

    user_prompt = "".join(parts)

    async def event_stream():
        try:
            llm = get_chat_model(temperature=0.8, max_tokens=1200, streaming=True)
            messages = [SystemMessage(content=system), HumanMessage(content=user_prompt)]
            async for chunk in llm.astream(messages):
                text = chunk.content if hasattr(chunk, "content") else str(chunk)
                if text:
                    yield _sse("token", {"text": text})
            yield _sse("done", {"tone": tone_key})
        except Exception:  # noqa: BLE001
            logger.exception("tone transform failed")
            yield _sse("error", {"message": "Transform failed. Please retry."})

    return EventSourceResponse(event_stream())
