"""Backend-agnostic LangChain chat model for IBM Granite.

The agent orchestration layer (``app.orchestration.agent_graph``) needs a
LangChain ``BaseChatModel`` so it can use ``.with_structured_output(...)`` and
``astream_events``. It must NOT hard-code watsonx — the documented dev path is
Ollama (free, offline) and the demo path is watsonx.ai, selected by a single
env var (``MODEL_BACKEND``).

This factory returns the right LangChain chat model for the configured backend,
configured for IBM Granite:

* ``watsonx`` -> ``ChatWatsonx`` on ``settings.watsonx_model_id`` (ibm/granite-4-h-small)
* ``ollama``  -> ``ChatOllama``  on ``settings.ollama_model_id``  (granite3.3)

Both expose the same ``.invoke`` / ``.with_structured_output`` /
``.astream_events`` surface, so the agent code is identical across backends.

Why this exists separately from ``granite_client.py``: that module owns the
raw streaming ``generate()`` interface used by the ``/generate`` route. The
agent loop needs the richer LangChain chat-model surface (structured output,
event streaming, message types). They share ``settings`` and the same backend
switch, but serve two different consumers.
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from app.config import settings

logger = logging.getLogger("writers_room.chat_model")


def get_chat_model(
    *,
    temperature: float = 0.7,
    max_tokens: int = 1500,
    streaming: bool = True,
) -> BaseChatModel:
    """Return a LangChain chat model for the configured Granite backend.

    Args:
        temperature: Sampling temperature.
        max_tokens: Max tokens to generate.
        streaming: Whether the model should stream tokens (used by the
            /agent/stream SSE endpoint). watsonx structured-output calls set
            this False internally where streaming isn't supported.

    Raises:
        RuntimeError: if the watsonx backend is selected without credentials.
    """
    backend = settings.model_backend
    logger.debug("building chat model: backend=%s model=%s", backend, settings.active_model_id)

    if backend == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            base_url=str(settings.ollama_url).rstrip("/"),
            model=settings.ollama_model_id,
            temperature=temperature,
            num_predict=max_tokens,
            # Ollama supports native tool/JSON mode; structured output uses it.
            streaming=streaming,
        )

    if backend == "watsonx":
        from langchain_ibm import ChatWatsonx

        if not settings.watsonx_api_key or not settings.watsonx_project_id:
            raise RuntimeError(
                "watsonx backend selected but WATSONX_API_KEY / "
                "WATSONX_PROJECT_ID are not set. Fill them in .env or set "
                "MODEL_BACKEND=ollama for offline development."
            )

        params: dict[str, Any] = {
            "decoding_method": "sample",
            "temperature": temperature,
            "max_new_tokens": max_tokens,
        }
        return ChatWatsonx(
            model_id=settings.watsonx_model_id,
            url=settings.watsonx_url,
            project_id=settings.watsonx_project_id,
            params=params,
            api_key=settings.watsonx_api_key,
        )

    # Unreachable: config types constrain to the two backends above.
    raise RuntimeError(f"Unknown model backend: {backend!r}")
