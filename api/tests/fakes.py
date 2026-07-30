"""Test doubles for the agent graph — deterministic structured-output fakes.

The production graph needs only the small LangChain surface below:
``model.with_structured_output(Schema).invoke(messages)``. Using a bespoke
fake instead of LangChain's generic test models keeps the tests offline and
lets us return already-validated Pydantic values without relying on provider
specific tool-calling implementations.

``CountingChatModel`` serves the route tests, where the interesting assertion is
often that the model was *not* called at all.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Sequence
from threading import Lock

from pydantic import BaseModel

from app.orchestration.agent_graph import CritiqueOutput, SpatialGeneration
from app.orchestration.voice import extract_style_metrics


class _StructuredRunnable:
    """The object returned by ``FakeChatModel.with_structured_output``."""

    def __init__(self, model: FakeChatModel, schema: type[BaseModel]) -> None:
        self._model = model
        self._schema = schema

    def invoke(self, _messages: object) -> BaseModel:
        return self._model.next_for(self._schema)


class FakeChatModel:
    """Thread-safe fake of the chat-model structured-output surface.

    LangGraph fans the four critics out concurrently, so each schema receives
    its own protected queue. Test fixtures can therefore express a debate in
    natural order: generation outputs first, then critic verdicts, regardless
    of which critic thread happens to execute first.
    """

    def __init__(self, responses: Sequence[BaseModel | str]) -> None:
        self._generations = deque(
            response for response in responses if isinstance(response, SpatialGeneration)
        )
        self._critiques = deque(
            response for response in responses if isinstance(response, CritiqueOutput)
        )
        self._lock = Lock()

    def with_structured_output(self, schema: type[BaseModel]) -> _StructuredRunnable:
        return _StructuredRunnable(self, schema)

    def next_for(self, schema: type[BaseModel]) -> BaseModel:
        with self._lock:
            if schema is SpatialGeneration:
                if not self._generations:
                    raise AssertionError("test fake ran out of SpatialGeneration responses")
                return self._generations.popleft()
            if schema is CritiqueOutput:
                if not self._critiques:
                    raise AssertionError("test fake ran out of CritiqueOutput responses")
                return self._critiques.popleft()
        raise AssertionError(f"unexpected structured-output schema: {schema!r}")


def architect_ok() -> SpatialGeneration:
    return SpatialGeneration(
        nodes=[
            {
                "label": "The Knock",
                "content": "A stranger knocks at midnight; Mira hesitates to answer.",
                "node_type": "plot_beat",
                "relative_x": 0.0,
                "relative_y": 300.0,
            }
        ]
    )


def critic_result(
    _name: str,
    decision: str,
    severity: str = "minor",
    feedback: str = "ok",
) -> CritiqueOutput:
    return CritiqueOutput(decision=decision, feedback=feedback, severity=severity)  # type: ignore[arg-type]


# --- Voice-lock fixtures --------------------------------------------------- #
#
# The Character Lead's measured half needs two things nothing else here does: a
# draft whose node content carries *attributed* dialogue, and a locked
# fingerprint to measure it against. The lock is measured from the sample rather
# than hand-written, so these stay honest if the metric set ever changes.
# --------------------------------------------------------------------------- #

# A dock smuggler: clipped, contraction-heavy, first person. The same voice
# ``test_voice_logic`` calibrates against, duplicated here so a graph test never
# has to import from a sibling test module.
MARCUS_SAMPLE = """\
Cargo's cargo. I don't ask what's in the crates and they don't ask where I've been.
That's the deal. You want it moved, I move it. You want questions answered, find a priest.
Ain't no cop out here past the third ring. Just me, and the debt I'm workin' off.
"""

# Marcus, still Marcus. Prose attribution ("Marcus ... says,") is what
# ``find_dialogue_for`` needs to claim the quote for him.
MARCUS_IN_VOICE_BEAT = (
    "The freighter's ramp hisses open. Marcus spits into the dark and says, "
    "\"I don't ask what's in the crates. You want it moved, I move it. That's "
    "the deal, and it ain't changin' tonight.\" Dana counts the manifest twice."
)

# The same beat after a model forgot who was speaking — a wholesale register
# change, and it reaches for a word the writer marked as one he never says. This
# is the exact regression voice lock exists to catch.
MARCUS_DRIFTED_BEAT = (
    "The freighter's ramp hisses open. Marcus straightens his jacket and says, "
    '"I would like to propose that we leverage our collective synergy in order to '
    "facilitate a comprehensive reassessment of the logistical framework, assuming "
    'the documentation is available for review." Dana counts the manifest twice.'
)


def locked_marcus(**overrides: object) -> dict:
    """Marcus's locked fingerprint, in the wire shape the graph reads.

    Keyword overrides let a test add ``never_says`` / ``signature_phrases`` or
    corrupt ``metrics`` without rebuilding the dict.
    """
    voice: dict = {
        "character": "Marcus",
        # ``as_dict`` is the same serializer persistence uses, so the fixture is
        # the shape a real Prisma row holds rather than a hand-made lookalike.
        "metrics": extract_style_metrics(MARCUS_SAMPLE).as_dict(),
        "never_says": [],
        "signature_phrases": [],
    }
    voice.update(overrides)
    return voice


def architect_speaking(content: str, label: str = "The Handoff") -> SpatialGeneration:
    """An Architect draft whose one node contains the given prose verbatim."""
    return SpatialGeneration(
        nodes=[
            {
                "label": label,
                "content": content,
                "node_type": "plot_beat",
                "relative_x": 0.0,
                "relative_y": 300.0,
            }
        ]
    )


def patch_chat_model(monkeypatch, responses: Sequence[BaseModel | str]) -> None:
    """Monkeypatch the graph's model factory with canned structured responses.

    The provided response sequence contains generation and critic outputs. The
    fake routes them by schema (rather than thread execution order), making
    fan-out tests deterministic.
    """
    import app.llm as llm_pkg
    import app.orchestration.agent_graph as graph

    fake = FakeChatModel(responses)
    monkeypatch.setattr(llm_pkg, "get_chat_model", lambda **_kw: fake)
    monkeypatch.setattr(graph, "get_chat_model", lambda **_kw: fake)


class CountingChatModel:
    """A single-schema fake that records how many times it was invoked.

    ``FakeChatModel`` routes by schema and is tied to the debate graph's two
    output types. This one is schema-agnostic and, more importantly, *counts* —
    which is the only way to prove a route's refusal path spends no model call.
    A raised ``error`` stands in for a provider failure.

    It also keeps the last message list it was handed, so a test can assert on
    what the route actually sent — the prompt-fencing boundary is only visible
    from here.
    """

    def __init__(
        self, response: BaseModel | None = None, *, error: Exception | None = None
    ) -> None:
        self.response = response
        self.error = error
        self.calls = 0
        self.factory_calls = 0
        self.messages: object | None = None

    def with_structured_output(self, _schema: type[BaseModel]) -> CountingChatModel:
        return self

    def invoke(self, messages: object) -> BaseModel:
        self.calls += 1
        self.messages = messages
        if self.error is not None:
            raise self.error
        assert self.response is not None, "CountingChatModel needs a response or an error"
        return self.response

    def prompt_text(self) -> str:
        """Every message's content joined — what the model effectively read."""
        parts = [str(getattr(m, "content", m)) for m in (self.messages or [])]
        return "\n".join(parts)


def patch_route_model(monkeypatch, module, fake: CountingChatModel) -> CountingChatModel:
    """Point one route module's ``get_chat_model`` at ``fake``.

    Routes import the factory by name, so the patch has to land on the route
    module rather than ``app.llm``. Returns the fake so a test can assert on
    ``fake.calls`` / ``fake.factory_calls``.
    """

    def _factory(**_kw: object) -> CountingChatModel:
        fake.factory_calls += 1
        return fake

    monkeypatch.setattr(module, "get_chat_model", _factory)
    return fake
