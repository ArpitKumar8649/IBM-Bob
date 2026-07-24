"""Structured-output invocation with retry + JSON repair.

The agents all ask the model for structured Pydantic objects. Models
occasionally emit malformed JSON — an OutputParserException must not terminate
the whole debate graph. This helper centralizes:

* up to ``max_attempts`` retries (with a "fix this JSON" re-prompt on parse
  failure),
* a fallback to a caller-supplied default if every attempt fails, so the
  graph keeps moving instead of blanking the demo,
* a single logging point for agent failures (no scattered ``except: return
  error`` blocks).

It is synchronous (``invoke``) because structured-output parsing is simplest
synchronously; the agent graph nodes themselves run inside the async graph
executor and call this via ``run_in_executor`` where needed. See
``agent_graph.py`` for usage.
"""

from __future__ import annotations

import json
import logging
from typing import TypeVar

from langchain_core.exceptions import OutputParserException
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

logger = logging.getLogger("writers_room.structured")

T = TypeVar("T", bound=BaseModel)

# Re-prompt used when a structured-output call fails to parse. Kept short and
# directive so the model focuses on the format, not re-answering.
_REPAIR_PROMPT = (
    "Your previous response was not valid JSON for the required schema. "
    "Return ONLY a single JSON object matching the schema, no prose, no "
    "markdown fences. If a field is unknown, use an empty string or []."
)


def invoke_structured(
    llm: BaseChatModel,
    schema: type[T],
    system_prompt: str,
    user_prompt: str,
    *,
    max_attempts: int = 2,
    fallback: T | None = None,
) -> T:
    """Invoke ``llm`` for a structured ``schema`` object, with retry + repair.

    Args:
        llm: A LangChain chat model.
        schema: The Pydantic model to parse into.
        system_prompt: The agent's system persona.
        user_prompt: The task prompt (already includes delimited user content).
        max_attempts: Total attempts including the first.
        fallback: Returned if all attempts fail. If None and all fail, the last
            exception re-raises — callers that want graceful degradation pass a
            fallback.

    Returns:
        A validated instance of ``schema``.

    Raises:
        OutputParserException: only if ``fallback`` is None and every attempt
            fails to parse.
    """
    try:
        structured_llm = llm.with_structured_output(schema)
    except Exception as exc:  # noqa: BLE001 — provider may not support structured output
        logger.error("could not configure structured output for %s: %s", schema.__name__, exc)
        if fallback is not None:
            return fallback
        raise

    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]

    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            result = structured_llm.invoke(messages)
            if result is None:
                raise OutputParserException("model returned None for structured output")
            return result
        except OutputParserException as exc:
            last_exc = exc
            logger.warning(
                "structured output parse failed (attempt %d/%d): %s",
                attempt,
                max_attempts,
                exc,
            )
            if attempt < max_attempts:
                # Append the repair instruction and retry in-place.
                messages = messages + [
                    HumanMessage(content=_REPAIR_PROMPT),
                ]
            continue
        except Exception as exc:  # noqa: BLE001 — backend, parse, or validation errors
            last_exc = exc
            logger.warning(
                "structured output call failed (attempt %d/%d): %s",
                attempt,
                max_attempts,
                exc,
            )
            if attempt < max_attempts:
                # Providers do not consistently wrap malformed JSON/schema
                # responses in OutputParserException; attach the repair prompt
                # for every retry, including Pydantic validation failures.
                messages = messages + [HumanMessage(content=_REPAIR_PROMPT)]
            else:
                break

    # All attempts exhausted.
    if fallback is not None:
        logger.error(
            "all %d structured attempts failed; returning fallback %s. last error: %s",
            max_attempts,
            schema.__name__,
            last_exc,
        )
        return fallback

    raise (
        last_exc
        if last_exc
        else OutputParserException("structured output failed with no error captured")
    )


def safe_json_dumps(obj: object, *, fallback: str = "[]") -> str:
    """JSON-encode ``obj`` without ever raising — used when feeding model
    output back into another prompt where a crash would break the loop."""
    try:
        return json.dumps(obj, indent=2, default=str)
    except Exception:  # noqa: BLE001 — this helper's contract is never to raise
        logger.warning("safe_json_dumps failed to encode %s; using fallback", type(obj).__name__)
        return fallback
