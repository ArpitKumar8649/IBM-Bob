"""Granite model client — one streaming interface, two backends.

The rest of the app (agents, routes) depends only on `GraniteClient.generate(...)`,
an async generator that yields text chunks. Which backend actually runs is chosen
by `settings.model_backend`:

* ``watsonx`` — IBM watsonx.ai hosted Granite (demo / production).
* ``ollama``  — a local Granite model via Ollama (free, offline development).

This abstraction is deliberate: the team develops against Ollama and flips to
watsonx.ai for the demo by changing a single env var — no code changes.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence
from typing import Literal, TypedDict

import httpx

from app.config import settings

Role = Literal["system", "user", "assistant"]


class ChatMessage(TypedDict):
    """A single chat message in the OpenAI-style role/content shape."""

    role: Role
    content: str


class LLMError(RuntimeError):
    """Raised when the underlying model backend fails."""


class GraniteClient:
    """Backend-agnostic streaming client for IBM Granite."""

    def __init__(self, backend: Literal["watsonx", "ollama"] | None = None) -> None:
        self.backend = backend or settings.model_backend
        self.model_id = settings.active_model_id
        # watsonx model handle is created lazily so importing this module never
        # requires cloud credentials (important for local Ollama development).
        self._watsonx_model = None

    # ------------------------------------------------------------------ #
    # Public interface
    # ------------------------------------------------------------------ #
    async def generate(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        """Stream a chat completion as text chunks.

        Args:
            messages: Ordered chat messages (system/user/assistant).
            temperature: Sampling temperature.
            max_tokens: Max tokens to generate.

        Yields:
            Text chunks in generation order.
        """
        if self.backend == "watsonx":
            async for chunk in self._generate_watsonx(messages, temperature, max_tokens):
                yield chunk
        elif self.backend == "ollama":
            async for chunk in self._generate_ollama(messages, temperature, max_tokens):
                yield chunk
        else:  # pragma: no cover - guarded by config typing
            raise LLMError(f"Unknown model backend: {self.backend!r}")

    async def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> str:
        """Non-streaming convenience wrapper — collects the full completion."""
        parts = [
            chunk
            async for chunk in self.generate(
                messages, temperature=temperature, max_tokens=max_tokens
            )
        ]
        return "".join(parts)

    # ------------------------------------------------------------------ #
    # watsonx.ai backend
    # ------------------------------------------------------------------ #
    def _get_watsonx_model(self):
        """Lazily construct the watsonx ModelInference handle."""
        if self._watsonx_model is not None:
            return self._watsonx_model

        if not settings.watsonx_api_key or not settings.watsonx_project_id:
            raise LLMError(
                "watsonx backend selected but WATSONX_API_KEY / WATSONX_PROJECT_ID "
                "are not set. Fill them in .env or set MODEL_BACKEND=ollama."
            )

        # Imported lazily so Ollama-only dev doesn't require the SDK at import time.
        from ibm_watsonx_ai import Credentials  # type: ignore
        from ibm_watsonx_ai.foundation_models import ModelInference  # type: ignore

        credentials = Credentials(url=settings.watsonx_url, api_key=settings.watsonx_api_key)
        self._watsonx_model = ModelInference(
            model_id=self.model_id,
            credentials=credentials,
            project_id=settings.watsonx_project_id,
        )
        return self._watsonx_model

    async def _generate_watsonx(
        self,
        messages: Sequence[ChatMessage],
        temperature: float,
        max_tokens: int,
    ) -> AsyncIterator[str]:
        model = self._get_watsonx_model()
        params = {
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # The watsonx SDK exposes a synchronous streaming generator. We iterate it
        # directly; chunks are small and the network is the bottleneck, so this keeps
        # the code simple while still yielding incrementally to the SSE layer.
        try:
            stream = model.chat_stream(messages=list(messages), params=params)
            for event in stream:
                text = _extract_watsonx_delta(event)
                if text:
                    yield text
        except Exception as exc:  # noqa: BLE001 - surface backend errors uniformly
            raise LLMError(f"watsonx.ai generation failed: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Ollama backend
    # ------------------------------------------------------------------ #
    async def _generate_ollama(
        self,
        messages: Sequence[ChatMessage],
        temperature: float,
        max_tokens: int,
    ) -> AsyncIterator[str]:
        payload = {
            "model": self.model_id,
            "messages": list(messages),
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        url = f"{settings.ollama_url.rstrip('/')}/api/chat"
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
                async with client.stream("POST", url, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                        if data.get("done"):
                            break
        except httpx.HTTPError as exc:
            raise LLMError(
                f"Ollama generation failed ({url}): {exc}. "
                "Is Ollama running and the model pulled (`ollama pull "
                f"{self.model_id}`)?"
            ) from exc


def _extract_watsonx_delta(event) -> str:
    """Pull the incremental text out of a watsonx chat_stream event.

    The SDK may yield either a dict (OpenAI-ish shape) or a plain string depending
    on version, so we handle both defensively.
    """
    if isinstance(event, str):
        return event
    if isinstance(event, dict):
        choices = event.get("choices") or []
        if choices:
            delta = choices[0].get("delta") or {}
            return delta.get("content") or ""
    return ""


# Single shared client instance for the process.
_client: GraniteClient | None = None


def get_client() -> GraniteClient:
    """Return the process-wide Granite client."""
    global _client
    if _client is None:
        _client = GraniteClient()
    return _client
