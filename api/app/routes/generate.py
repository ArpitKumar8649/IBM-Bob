"""Phase 1 endpoints: model info + single-shot streaming generation.

This is the "Hello, Granite" vertical slice — it proves the full pipe
(browser -> API -> Granite -> streamed tokens back) works before any agent
complexity is added in Phase 2.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.llm import ChatMessage, get_client
from app.llm.granite_client import LLMError
from app.schemas import GenerateRequest, ModelInfo
from app.security import RateLimiter, require_api_key

logger = logging.getLogger("writers_room.generate")

router = APIRouter(prefix="/api", tags=["generate"])

# Share the same limiter policy as the agent endpoints.
_rate_limiter = RateLimiter(max_calls=30, window_seconds=60)


@router.get("/model-info", response_model=ModelInfo)
async def model_info() -> ModelInfo:
    """Report the active model backend and model id.

    Handy in the demo to prove IBM Granite is actually in the loop.
    """
    backend = settings.model_backend
    if backend == "watsonx":
        ready = bool(settings.watsonx_api_key and settings.watsonx_project_id)
        detail = "" if ready else "Missing WATSONX_API_KEY / WATSONX_PROJECT_ID."
    else:
        ready = True
        detail = f"Expecting Ollama at {settings.ollama_url}"
    return ModelInfo(
        backend=backend,
        model_id=settings.active_model_id,
        ready=ready,
        detail=detail,
    )


@router.post(
    "/generate",
    dependencies=[Depends(require_api_key), Depends(_rate_limiter)],
)
async def generate(req: GenerateRequest) -> EventSourceResponse:
    """Stream a Granite completion for a single prompt as Server-Sent Events.

    Emits ``token`` events with incremental text and a final ``done`` event.
    On failure, emits an ``error`` event so the client can surface it.
    """
    client = get_client()
    messages: list[ChatMessage] = [
        {
            "role": "system",
            "content": (
                "You are a helpful creative assistant inside The Writers' Room, "
                "an AI collaborator for creative work."
            ),
        },
        {"role": "user", "content": req.prompt},
    ]

    async def event_stream():
        try:
            async for chunk in client.generate(
                messages, temperature=req.temperature, max_tokens=req.max_tokens
            ):
                yield {"event": "token", "data": chunk}
            yield {"event": "done", "data": ""}
        except LLMError as exc:
            logger.error("generation failed: %s", exc)
            yield {"event": "error", "data": str(exc)}

    return EventSourceResponse(event_stream())
