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

Models are tried in order — ``DASHSCOPE_IMAGE_MODEL_ID`` first, then each id in
``DASHSCOPE_IMAGE_FALLBACK_MODEL_IDS``. DashScope grants free quota per model,
so when the primary model's allowance runs out a different model still renders.
Only failures another model could plausibly survive advance the chain (quota
spent, throttled, unpaid balance, an id this account cannot reach); a bad key or
a moderated prompt fails identically everywhere and stops on the first attempt.
A poll timeout also stops: the writer is waiting, and three sixty-second waits
in a row is worse than one honest failure.

Region note: DashScope runs two independent regions with different model
catalogs. An international (Singapore) key authenticates only against
``dashscope-intl.aliyuncs.com`` and serves the ``wan2.2-*`` family; a
mainland-China key uses ``dashscope.aliyuncs.com`` with ``wanx2.1-*``. Both
the host and the model ids are configurable — see ``DASHSCOPE_BASE_URL``,
``DASHSCOPE_IMAGE_MODEL_ID`` and ``DASHSCOPE_IMAGE_FALLBACK_MODEL_IDS``.
Pointing a key at the wrong region fails with ``InvalidApiKey`` even when the
key is perfectly valid.
"""

from __future__ import annotations

import asyncio
import logging
from typing import NamedTuple

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
# Still 1 with the fallback chain in place: a fallback only runs after the model
# before it failed, and a failed task renders nothing, so a request costs one
# image however many ids it walks through.
_budget = daily_budget.cost(1)
router = APIRouter(
    prefix="/scene-image",
    tags=["scene-image"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter), Depends(_budget)],
)

# Polling config for the async DashScope task.
_POLL_INTERVAL_SECONDS = 2.0
_MAX_POLL_ATTEMPTS = 30  # ~60s max wait

# Failures that will repeat on every model in the chain, so the chain stops.
# A rejected key is rejected the same way by every model, and a prompt the
# content filter refused is refused by all of them too.
_FATAL_FRAGMENTS = (
    "invalidapikey",
    "invalidaccesskey",
    "unauthorized",
    "datainspectionfailed",
)

# Failures that are specific to one model, so another model may still work:
# allowance spent, throttled, unpaid balance, a model this account is not
# entitled to, or an id that does not exist in this region. Matched as
# lowercase substrings of "<code> <message>" because DashScope namespaces its
# codes inconsistently (`Throttling.RateQuota`, `Model.AccessDenied`) and puts
# "Model not exist." in the message under a generic `InvalidParameter` code.
_TRY_NEXT_FRAGMENTS = (
    "throttling",
    "quota",
    "arrearage",
    "accessdenied",
    "model not exist",
    "modelnotfound",
    "unsupportedmodel",
    "limitrequests",
)


def _should_try_next_model(status_code: int | None, code: str, message: str) -> bool:
    """Whether a failure on one model is worth retrying on the next one.

    ``status_code`` is the HTTP status when the submit call itself failed, or
    ``None`` when the task was accepted and then reported FAILED while polling
    (that response is a 200 carrying a failure inside it).
    """
    haystack = f"{code} {message}".lower()

    if any(fragment in haystack for fragment in _FATAL_FRAGMENTS):
        return False
    # Checked before the bare 401/403 rule below: `Model.AccessDenied` arrives
    # as a 403 but means "not this model", not "not this key".
    if any(fragment in haystack for fragment in _TRY_NEXT_FRAGMENTS):
        return True
    if status_code in {401, 403}:
        return False
    # Rate limits and transient server faults are per-model on DashScope.
    return status_code is not None and (status_code == 429 or status_code >= 500)


def _error_fields(response: httpx.Response) -> tuple[str, str]:
    """Best-effort ``(code, message)`` from a DashScope error body."""
    try:
        body = response.json()
    except ValueError:
        return "", ""
    if not isinstance(body, dict):
        return "", ""
    return str(body.get("code") or ""), str(body.get("message") or "")


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
    # Which model actually rendered the image — or, on failure, the last one
    # tried. Surfaced so a fallback render is visible rather than silent.
    model_id: str | None = None


class _Attempt(NamedTuple):
    """The outcome of trying one model.

    A set ``response`` is decisive: return it. ``response is None`` means move
    on to the next model, with ``reason`` recording why this one was skipped.
    """

    response: SceneImageResponse | None
    reason: str = ""


async def _render_with_model(
    client: httpx.AsyncClient, model_id: str, req: SceneImageRequest
) -> _Attempt:
    """Submit and poll one DashScope model, start to finish."""
    headers = {
        "Authorization": f"Bearer {settings.dashscope_api_key}",
        "Content-Type": "application/json",
        # Async mode: DashScope returns a task id to poll.
        "X-DashScope-Async": "enable",
    }
    payload = {
        "model": model_id,
        "input": {"prompt": req.prompt},
        "parameters": {"size": req.size, "n": 1},
    }

    # 1. Submit the task.
    try:
        submit = await client.post(
            f"{settings.dashscope_base_url}/services/aigc/text2image/image-synthesis",
            headers=headers,
            json=payload,
        )
    except httpx.HTTPError as exc:
        # Every model in the chain lives behind this one host, so a transport
        # failure is not something the next id can route around.
        logger.exception("DashScope submit failed")
        raise HTTPException(status_code=502, detail=f"Image service error: {exc}") from exc

    if submit.status_code != 200:
        code, message = _error_fields(submit)
        logger.error(
            "DashScope submit for %s returned %s: %s",
            model_id,
            submit.status_code,
            submit.text[:500],
        )
        if _should_try_next_model(submit.status_code, code, message):
            return _Attempt(None, f"{model_id}: {message or submit.status_code}")
        detail = f": {message}" if message else "."
        return _Attempt(
            SceneImageResponse(
                status="failed",
                model_id=model_id,
                message=f"Image generation failed ({submit.status_code}){detail}",
            )
        )

    task_id = submit.json().get("output", {}).get("task_id")
    if not task_id:
        return _Attempt(
            SceneImageResponse(status="failed", model_id=model_id, message="No task id returned.")
        )

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

        output = poll.json().get("output", {})
        status = output.get("task_status")

        if status == "SUCCEEDED":
            results = output.get("results", [])
            if results and results[0].get("url"):
                return _Attempt(
                    SceneImageResponse(
                        status="success", image_url=results[0]["url"], model_id=model_id
                    )
                )
            return _Attempt(
                SceneImageResponse(
                    status="failed", model_id=model_id, message="No image in result."
                )
            )

        if status in {"FAILED", "CANCELED", "UNKNOWN"}:
            # A rejection can arrive here rather than at submit: DashScope
            # accepts the task with a 200, then validates while running it.
            code = str(output.get("code") or "")
            message = str(output.get("message") or "Image generation failed.").strip()
            logger.error("DashScope task for %s ended %s: %s %s", model_id, status, code, message)
            if _should_try_next_model(None, code, message):
                return _Attempt(None, f"{model_id}: {message}")
            return _Attempt(
                SceneImageResponse(status="failed", model_id=model_id, message=message)
            )

        # PENDING / RUNNING — keep polling.

    # Deliberately terminal rather than a fallback: the writer has already
    # waited a minute, and walking the rest of the chain would make them wait
    # that minute again per model.
    return _Attempt(
        SceneImageResponse(
            status="failed", model_id=model_id, message="Image generation timed out."
        )
    )


@router.post("/generate", response_model=SceneImageResponse)
async def generate_scene_image(req: SceneImageRequest) -> SceneImageResponse:
    """Render a scene image prompt, falling back through the configured models."""
    if not settings.dashscope_api_key:
        return SceneImageResponse(
            status="no_key",
            message=(
                "DASHSCOPE_API_KEY is not set. The prompt is ready to paste "
                "into any image tool."
            ),
        )

    chain = settings.dashscope_image_model_chain
    if not chain:
        return SceneImageResponse(
            status="failed",
            message="No image model configured (DASHSCOPE_IMAGE_MODEL_ID is empty).",
        )

    skipped: list[str] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model_id in chain:
            attempt = await _render_with_model(client, model_id, req)
            if attempt.response is not None:
                return attempt.response
            logger.warning("Image model unavailable, trying the next one — %s", attempt.reason)
            skipped.append(attempt.reason)

    return SceneImageResponse(
        status="failed",
        model_id=chain[-1],
        message=f"All {len(chain)} image models are unavailable. Last error — {skipped[-1]}",
    )
