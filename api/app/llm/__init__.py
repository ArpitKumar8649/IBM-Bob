"""LLM access layer — IBM Granite served by watsonx.ai or a local Ollama backend.

Two interfaces over the same backend switch (``settings.model_backend``):

* ``granite_client.GraniteClient`` — raw async streaming ``generate()`` for the
  ``/generate`` route.
* ``chat_model.get_chat_model`` — a LangChain ``BaseChatModel`` for the agent
  orchestration layer (structured output + event streaming).
"""

from app.llm.chat_model import get_chat_model
from app.llm.granite_client import ChatMessage, GraniteClient, LLMError, get_client

__all__ = [
    "ChatMessage",
    "GraniteClient",
    "LLMError",
    "get_chat_model",
    "get_client",
]
