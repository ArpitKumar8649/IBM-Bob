"""Tests for the DashScope scene-image route and its model fallback chain.

Fully offline: every DashScope call is served by ``pytest-httpx``. What these
pin down is the *fallback policy*, because that is where the judgement lives. A
model that has run out of quota must hand off to the next one; a rejected key or
a moderated prompt must not, because the next model rejects them identically and
the only thing the retry buys the writer is another wait.

The error shapes below are copied from live responses on
``dashscope-intl.aliyuncs.com`` (July 2026), including the one that is easy to
get wrong: DashScope accepts a task with **200 OK** and then reports the
rejection while you poll it, so classification has to happen in both places.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, settings
from app.main import app
from app.routes import scene_image
from app.routes.scene_image import (
    SceneImageRequest,
    _should_try_next_model,
    generate_scene_image,
)

BASE = "https://dashscope-test.invalid/api/v1"
SUBMIT_URL = f"{BASE}/services/aigc/text2image/image-synthesis"
TASK_URL = f"{BASE}/tasks/task-1"
TASK_2_URL = f"{BASE}/tasks/task-2"
IMAGE_URL = "https://example.invalid/rendered.png"
QUOTA_SPENT = {
    "code": "Throttling.AllocationQuota",
    "message": "Free allocated quota exceeded.",
}


@pytest.fixture(autouse=True)
def _dashscope_config(monkeypatch):
    """Pin the DashScope settings so no test depends on the local ``.env``.

    Also collapses the poll interval, which is 2s in production and would make
    this file take a minute to add nothing.
    """
    monkeypatch.setattr(settings, "dashscope_api_key", "test-key")
    monkeypatch.setattr(settings, "dashscope_base_url", BASE)
    monkeypatch.setattr(settings, "dashscope_image_model_id", "model-a")
    monkeypatch.setattr(settings, "dashscope_image_fallback_model_ids", "model-b,model-c")
    monkeypatch.setattr(scene_image, "_POLL_INTERVAL_SECONDS", 0.0)
    # This file makes more scene-image requests than the route's 10-per-minute
    # ceiling allows, and the limiter instance is shared for the whole session.
    scene_image._rate_limiter._hits.clear()


def _submit_ok(task_id: str = "task-1") -> dict:
    return {"request_id": "r", "output": {"task_id": task_id, "task_status": "PENDING"}}


def _task_succeeded(url: str = IMAGE_URL) -> dict:
    return {"output": {"task_status": "SUCCEEDED", "results": [{"url": url}]}}


def _task_failed(code: str, message: str) -> dict:
    return {"output": {"task_status": "FAILED", "code": code, "message": message}}


def _submitted_models(httpx_mock) -> list[str]:
    """The model ids that were actually submitted, in order."""
    return [
        json.loads(request.content)["model"]
        for request in httpx_mock.get_requests()
        if request.method == "POST"
    ]


# --------------------------------------------------------------------------- #
# The failure classifier (pure — no HTTP)
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("status_code", "code", "message"),
    [
        (429, "Throttling.RateQuota", "Requests rate limit exceeded."),
        (400, "Throttling.AllocationQuota", "Free allocated quota exceeded."),
        (400, "Arrearage", "Account is in arrears, please top up."),
        # A 403 that means "not this model", not "not this key" — the reason the
        # code fragments are checked before the bare 401/403 rule.
        (403, "Model.AccessDenied", "Model access denied."),
        # The live shape when an id exists in the other region but not this one.
        (400, "InvalidParameter", "Model not exist."),
        (500, "InternalError", "An internal error has occurred."),
        (503, "", ""),
    ],
)
def test_per_model_failures_advance_the_chain(status_code, code, message):
    assert _should_try_next_model(status_code, code, message) is True


@pytest.mark.parametrize(
    ("status_code", "code", "message"),
    [
        (401, "InvalidApiKey", "Invalid API-key provided."),
        (400, "DataInspectionFailed", "Input data may contain inappropriate content."),
        # Verified live: this is what a bad `size` returns, and it is bad for
        # every model, so walking the chain would waste the writer's time.
        (400, "InvalidParameter", "Either width or height should be between 512 and 1440. "),
        (404, "Unknown", "Not found"),
    ],
)
def test_shared_failures_stop_the_chain(status_code, code, message):
    assert _should_try_next_model(status_code, code, message) is False


def test_poll_failures_are_classified_without_an_http_status():
    """A task rejected during polling arrived over a 200, so there is no status."""
    assert _should_try_next_model(None, "Throttling.AllocationQuota", "quota exceeded") is True
    assert _should_try_next_model(None, "InvalidParameter", "Model not exist.") is True
    assert _should_try_next_model(None, "DataInspectionFailed", "flagged") is False
    # Unrecognised, with nothing to go on: stop rather than pay three waits to
    # rediscover the same failure.
    assert _should_try_next_model(None, "", "Image generation failed.") is False


# --------------------------------------------------------------------------- #
# The configured chain
# --------------------------------------------------------------------------- #


def test_chain_is_the_primary_then_each_fallback_in_order():
    config = Settings(dashscope_image_model_id="a", dashscope_image_fallback_model_ids="b, c")
    assert config.dashscope_image_model_chain == ["a", "b", "c"]


def test_chain_deduplicates_so_a_repeated_id_is_not_rendered_twice():
    config = Settings(dashscope_image_model_id="a", dashscope_image_fallback_model_ids="b,a,,b")
    assert config.dashscope_image_model_chain == ["a", "b"]


def test_a_blank_fallback_list_leaves_a_single_model():
    config = Settings(dashscope_image_model_id="a", dashscope_image_fallback_model_ids="")
    assert config.dashscope_image_model_chain == ["a"]


def test_shipped_defaults_are_a_real_chain():
    """The defaults must actually provide a fallback, not just the primary.

    All three were verified live on the -intl host: they take the same request
    shape and return the same ``output.results[0].url``.
    """
    config = Settings()
    assert config.dashscope_image_model_chain == [
        "wan2.2-t2i-flash",
        "wan2.2-t2i-plus",
        "qwen-image",
    ]


# --------------------------------------------------------------------------- #
# The route
# --------------------------------------------------------------------------- #


async def test_primary_renders_and_names_itself(httpx_mock):
    httpx_mock.add_response(url=SUBMIT_URL, json=_submit_ok())
    httpx_mock.add_response(url=TASK_URL, json=_task_succeeded())

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "success"
    assert result.image_url == IMAGE_URL
    assert result.model_id == "model-a"
    assert _submitted_models(httpx_mock) == ["model-a"]


async def test_quota_spent_at_submit_falls_back_to_the_next_model(httpx_mock):
    httpx_mock.add_response(url=SUBMIT_URL, status_code=429, json=QUOTA_SPENT)
    httpx_mock.add_response(url=SUBMIT_URL, json=_submit_ok())
    httpx_mock.add_response(url=TASK_URL, json=_task_succeeded())

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "success"
    assert result.image_url == IMAGE_URL
    assert result.model_id == "model-b"
    assert _submitted_models(httpx_mock) == ["model-a", "model-b"]


async def test_quota_spent_during_polling_falls_back_to_the_next_model(httpx_mock):
    """The submit succeeded; the refusal only showed up in the task status."""
    httpx_mock.add_response(url=SUBMIT_URL, json=_submit_ok("task-1"))
    httpx_mock.add_response(url=TASK_URL, json=_task_failed(**QUOTA_SPENT))
    httpx_mock.add_response(url=SUBMIT_URL, json=_submit_ok("task-2"))
    httpx_mock.add_response(url=TASK_2_URL, json=_task_succeeded())

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "success"
    assert result.model_id == "model-b"
    assert _submitted_models(httpx_mock) == ["model-a", "model-b"]


async def test_a_rejected_key_stops_the_chain_after_one_attempt(httpx_mock):
    httpx_mock.add_response(
        url=SUBMIT_URL,
        status_code=401,
        json={"code": "InvalidApiKey", "message": "Invalid API-key provided."},
    )

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "failed"
    assert result.model_id == "model-a"
    assert "Invalid API-key" in (result.message or "")
    assert _submitted_models(httpx_mock) == ["model-a"]


async def test_a_moderated_prompt_stops_the_chain(httpx_mock):
    httpx_mock.add_response(url=SUBMIT_URL, json=_submit_ok())
    httpx_mock.add_response(
        url=TASK_URL,
        json=_task_failed("DataInspectionFailed", "Input data may contain inappropriate content."),
    )

    result = await generate_scene_image(SceneImageRequest(prompt="something the filter hates"))

    assert result.status == "failed"
    assert result.message == "Input data may contain inappropriate content."
    assert _submitted_models(httpx_mock) == ["model-a"]


async def test_every_model_out_of_quota_reports_the_whole_chain(httpx_mock):
    for _ in range(3):
        httpx_mock.add_response(url=SUBMIT_URL, status_code=429, json=QUOTA_SPENT)

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "failed"
    assert result.image_url is None
    assert result.model_id == "model-c"
    assert "All 3 image models are unavailable" in (result.message or "")
    assert "model-c" in (result.message or "")
    assert _submitted_models(httpx_mock) == ["model-a", "model-b", "model-c"]


async def test_a_timeout_does_not_walk_the_rest_of_the_chain(httpx_mock, monkeypatch):
    monkeypatch.setattr(scene_image, "_MAX_POLL_ATTEMPTS", 2)
    httpx_mock.add_response(url=SUBMIT_URL, json=_submit_ok())
    for _ in range(2):
        httpx_mock.add_response(url=TASK_URL, json={"output": {"task_status": "RUNNING"}})

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "failed"
    assert result.message == "Image generation timed out."
    # Deliberate: the writer has already waited out one full poll cycle, and
    # three of those in a row is worse than one honest failure.
    assert _submitted_models(httpx_mock) == ["model-a"]


async def test_a_missing_key_is_reported_without_calling_dashscope(httpx_mock, monkeypatch):
    monkeypatch.setattr(settings, "dashscope_api_key", "")

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "no_key"
    assert "DASHSCOPE_API_KEY" in (result.message or "")
    assert httpx_mock.get_requests() == []


async def test_an_empty_model_chain_fails_without_calling_dashscope(httpx_mock, monkeypatch):
    monkeypatch.setattr(settings, "dashscope_image_model_id", "")
    monkeypatch.setattr(settings, "dashscope_image_fallback_model_ids", "")

    result = await generate_scene_image(SceneImageRequest(prompt="a lighthouse at dusk"))

    assert result.status == "failed"
    assert "DASHSCOPE_IMAGE_MODEL_ID" in (result.message or "")
    assert httpx_mock.get_requests() == []


def test_the_wire_response_carries_the_model_that_rendered(httpx_mock):
    """``response_model`` has to declare ``model_id`` or FastAPI drops it."""
    httpx_mock.add_response(url=SUBMIT_URL, status_code=429, json=QUOTA_SPENT)
    httpx_mock.add_response(url=SUBMIT_URL, json=_submit_ok())
    httpx_mock.add_response(url=TASK_URL, json=_task_succeeded())

    response = TestClient(app).post(
        "/scene-image/generate", json={"prompt": "a lighthouse at dusk"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["image_url"] == IMAGE_URL
    assert body["model_id"] == "model-b"




