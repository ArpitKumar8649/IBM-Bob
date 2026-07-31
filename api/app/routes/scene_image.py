"""AI scene image generation via Alibaba DashScope (Qwen / Wan).

``POST /scene-image/generate`` takes a cinematic image prompt (written by
Granite in the scene breakdown) and renders it with DashScope's Wan
text-to-image model.

DashScope's image API is asynchronous: you submit a task, then poll until it
succeeds, then read the image URL from the result. This endpoint handles the
full submit → poll → return cycle and returns the image URL.

The two-step design: Granite writes the prompt (story-aware), Qwen/Wan renders
it. This keeps the LLM (IBM Granite) and the image model (Qwen) cleanly
separated, and the prompt is always surfaced even if image generation is
unavailable.

Region note: DashScope runs two independent regions with different model
catalogs. An international (Singapore) key authenticates only against
``dashscope-intl.aliyuncs.com`` and serves the ``wan2.2-*`` family; a
mainland-China key uses ``dashscope.aliyuncs.com`` with ``wanx2.1-*``. Both
the host and the model id are configurable — see ``DASHSCOPE_BASE_URL`` and
``DASHSCOPE_IMAGE_MODEL_ID``. Pointing a key at the wrong region fails with
``InvalidApiKey`` even when the key is perfectly valid.
"""

from __future__ import annotations

import asyncio
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.security import RateLimiter, daily_budget, require_api_key

logger = logging.getLogger("writers_room.scene_image")

# Image generation is expensive; rate-limit conservatively.
_rate_limiter = RateLimiter(max_calls=10, window_seconds=60)
# One image generation per request. It bills DashScope rather than watsonx, but
# it is still spend, and one shared ceiling is easier to reason about than two.
_budget = daily_budget.cost(1)
router = APIRouter(
    prefix="/scene-image",
    tags=["scene-image"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter), Depends(_budget)],
)

# Polling config for the async DashScope task.
_POLL_INTERVAL_SECONDS = 2.0
_MAX_POLL_ATTEMPTS = 30  # ~60s max wait


class SceneImageRequest(BaseModel):
    prompt: str = Field(..., max_length=2_000, description="The cinematic image prompt.")
    size: str = Field(
        default="1280*720",
        description="Image size, e.g. '1280*720' (16:9) or '1024*1024'.",
    )


class SceneImageResponse(BaseModel):
    image_url: str | None = None
    status: str  # "success" | "failed" | "no_key"
    message: str | None = None


@router.post("/generate", response_model=SceneImageResponse)
async def generate_scene_image(req: SceneImageRequest) -> SceneImageResponse:
    """Render a scene image prompt with DashScope's Wan text-to-image model."""
    if not settings.dashscope_api_key:
        return SceneImageResponse(
            status="no_key",
            message=(
                "DASHSCOPE_API_KEY is not set. The prompt is ready to paste "
                "into any image tool."
            ),
        )

    headers = {
        "Authorization": f"Bearer {settings.dashscope_api_key}",
        "Content-Type": "application/json",
        # Async mode: DashScope returns a task id to poll.
        "X-DashScope-Async": "enable",
    }

    payload = {
        "model": settings.dashscope_image_model_id,
        "input": {"prompt": req.prompt},
        "parameters": {"size": req.size, "n": 1},
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Submit the task.
        try:
            submit = await client.post(
                f"{settings.dashscope_base_url}/services/aigc/text2image/image-synthesis",
                headers=headers,
                json=payload,
            )
        except httpx.HTTPError as exc:
            logger.exception("DashScope submit failed")
            raise HTTPException(status_code=502, detail=f"Image service error: {exc}") from exc

        if submit.status_code != 200:
            logger.error("DashScope submit returned %s: %s", submit.status_code, submit.text)
            return SceneImageResponse(
                status="failed",
                message=f"Image generation failed ({submit.status_code}).",
            )

        task_id = submit.json().get("output", {}).get("task_id")
        if not task_id:
            return SceneImageResponse(status="failed", message="No task id returned.")

        # 2. Poll until the task completes.
        poll_headers = {"Authorization": f"Bearer {settings.dashscope_api_key}"}
        for _ in range(_MAX_POLL_ATTEMPTS):
            await asyncio.sleep(_POLL_INTERVAL_SECONDS)
            try:
                poll = await client.get(
                    f"{settings.dashscope_base_url}/tasks/{task_id}",
                    headers=poll_headers,
                )
            except httpx.HTTPError:
                logger.warning("DashScope poll failed, retrying")
                continue

            if poll.status_code != 200:
                continue

            data = poll.json()
            status = data.get("output", {}).get("task_status")

            if status == "SUCCEEDED":
                results = data.get("output", {}).get("results", [])
                if results and results[0].get("url"):
                    return SceneImageResponse(
                        status="success", image_url=results[0]["url"]
                    )
                return SceneImageResponse(status="failed", message="No image in result.")

            if status == "FAILED":
                msg = data.get("output", {}).get("message", "Image generation failed.")
                return SceneImageResponse(status="failed", message=msg)

            # PENDING / RUNNING — keep polling.

        return SceneImageResponse(status="failed", message="Image generation timed out.")
