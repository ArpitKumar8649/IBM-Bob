"""Agent orchestration routes.

Two endpoints over the LangGraph debate loop:

* ``POST /agent/invoke``  — async, returns the final approved nodes + debate
  feedback as JSON. Used by the canvas when streaming isn't needed.
* ``POST /agent/stream``  — Server-Sent Events streaming the live debate:
  per-agent ``agent_start`` / ``agent_finish`` / ``critique`` / ``decision``
  / ``node`` / ``done`` events, so the canvas can light up each agent in turn.

Both accept the full canvas (nodes + edges) so the agents see the big picture,
and both bound their inputs to protect the watsonx token budget.
"""

from __future__ import annotations

import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.orchestration.agent_graph import MAX_REVISIONS, writers_graph
from app.security import RateLimiter, Reservation, daily_budget, require_api_key

logger = logging.getLogger("writers_room.agent")

# Share a single in-memory limiter across both agent endpoints. Declaring
# dependencies on the router keeps route signatures clean and lets FastAPI
# enforce the guard before deserializing a potentially expensive graph request.
_rate_limiter = RateLimiter(max_calls=20, window_seconds=60)
router = APIRouter(
    prefix="/agent",
    tags=["orchestration"],
    dependencies=[Depends(require_api_key), Depends(_rate_limiter)],
)

# What one debate can cost the shared daily budget. A deliberation is the
# Architect (or the Reviser) plus the four critics, and the gate can send a draft
# back MAX_REVISIONS times — so the worst case is derived from the loop's own
# bound rather than hard-coded, and raising MAX_REVISIONS raises the reservation
# with it. Each endpoint reserves the worst case and refunds the rounds the gate
# turned out not to need.
_CALLS_PER_ROUND = 5
_MAX_DEBATE_CALLS = _CALLS_PER_ROUND * (MAX_REVISIONS + 1)
_debate_budget = daily_budget.cost(_MAX_DEBATE_CALLS)


# --------------------------------------------------------------------------- #
# Request / response models
# --------------------------------------------------------------------------- #


class CanvasNode(BaseModel):
    id: str = Field(..., max_length=80)
    data: dict[str, Any] = Field(default_factory=dict)

    def model_post_init(self, __context: Any) -> None:
        # ``data`` is flexible to accommodate React Flow's custom node types,
        # but cannot be unbounded: it becomes model context downstream.
        if len(json.dumps(self.data, default=str)) > 4_096:
            raise ValueError("node data must be at most 4096 serialized bytes")


class CanvasEdge(BaseModel):
    id: str = Field(..., max_length=80)
    source: str = Field(..., max_length=80)
    target: str = Field(..., max_length=80)
    data: dict[str, Any] = Field(default_factory=dict)

    def model_post_init(self, __context: Any) -> None:
        if len(json.dumps(self.data, default=str)) > 1_024:
            raise ValueError("edge data must be at most 1024 serialized bytes")


class StoryFact(BaseModel):
    category: str = Field(default="lore", max_length=40)
    content: str = Field(..., max_length=2_000)


class LockedVoice(BaseModel):
    """One character's locked voice fingerprint, sent along with the canvas.

    Persistence lives in Next.js (Postgres owns the ``VoiceFingerprint`` rows), so
    the browser posts the locks it wants enforced on this round. FastAPI stores
    nothing and trusts nothing here: the Character Lead only ever *measures*
    against these numbers.

    ``metrics`` is deliberately untyped, mirroring ``VoiceCheckRequest.metrics``.
    It is the Postgres Json column handed back verbatim, and ``evaluate_voice``
    absorbs missing, extra, and garbage keys as "insufficient sample". Typing it
    strictly would let one fingerprint locked by an older build 422 an entire
    debate round.
    """

    character: str = Field(..., max_length=80)
    metrics: dict[str, Any] = Field(default_factory=dict)
    never_says: list[str] = Field(default_factory=list, max_length=40)
    signature_phrases: list[str] = Field(default_factory=list, max_length=40)

    def model_post_init(self, __context: Any) -> None:
        if len(json.dumps(self.metrics, default=str)) > 4_096:
            raise ValueError("voice metrics must be at most 4096 serialized bytes")


class OrchestrateRequest(BaseModel):
    """Shared request body for invoke + stream.

    ``spatial_context`` may be sent pre-serialized; if absent, the backend
    builds it from ``nodes``/``edges`` so the agents see the whole canvas.
    ``story_facts`` is the RAG context gathered by the Next.js layer.
    """

    room_id: str = Field(..., max_length=80)
    user_intent: str = Field("draft", max_length=1_000)
    # Direct context is a legacy escape hatch; the normal route is nodes/edges.
    # Keep it inside the same approximate budget as build_spatial_context().
    spatial_context: str | None = Field(None, max_length=8_000)
    nodes: list[CanvasNode] = Field(default_factory=list, max_length=60)
    edges: list[CanvasEdge] = Field(default_factory=list, max_length=120)
    # RAG context: relevant story-bible facts retrieved by the Next.js layer.
    story_facts: list[StoryFact] = Field(default_factory=list, max_length=20)
    # Locked fingerprints to measure this draft's dialogue against. Optional: an
    # empty list is the pre-voice-lock behaviour, and every existing caller that
    # omits it gets exactly the debate it got before.
    locked_voices: list[LockedVoice] = Field(default_factory=list, max_length=12)


class OrchestrateResponse(BaseModel):
    status: str
    nodes: list[dict[str, Any]]
    decision: str | None = None
    critic_results: list[dict[str, Any]] = Field(default_factory=list)
    debate_feedback: str | None = None
    error: str | None = None


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _initial_state(req: OrchestrateRequest) -> dict[str, Any]:
    """Build the LangGraph initial state, deriving spatial_context if needed."""
    # Lazy import to avoid a circular import at module load.
    from app.orchestration.context import build_spatial_context

    if req.spatial_context:
        ctx = req.spatial_context
    else:
        ctx = build_spatial_context(
            [n.model_dump() for n in req.nodes],
            [e.model_dump() for e in req.edges],
        )

    # Format RAG story facts as a canon block for the agents.
    bible = ""
    if req.story_facts:
        lines = [f"- [{f.category}] {f.content}" for f in req.story_facts]
        bible = "\n".join(lines)

    return {
        "room_id": req.room_id,
        "user_intent": req.user_intent,
        "spatial_context": ctx,
        "story_bible": bible,
        "proposed_nodes": [],
        # Read-only for the graph; the Character Lead measures against these.
        "locked_voices": [v.model_dump() for v in req.locked_voices],
        "decision": None,
        "critique_feedback": "",
        "critic_results": [],
        "revision_count": 0,
        "error": None,
    }


def _sse(event: str, data: Any) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, default=str)}


# LangGraph node name -> human label for the streaming UI.
_NODE_LABELS = {
    "architect": "Architect",
    "critic_character": "Character Lead",
    "critic_world": "World Builder",
    "critic_continuity": "Continuity Checker",
    "critic_tension": "Tension/Pacing",
    "merge": "Devil's Advocate",
    "reviser": "Reviser",
}


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


@router.post("/invoke", response_model=OrchestrateResponse)
async def invoke_agent(
    request: OrchestrateRequest,
    budget: Annotated[Reservation, Depends(_debate_budget)],
) -> OrchestrateResponse:
    """Run the debate loop async and return the final approved nodes."""
    initial = _initial_state(request)
    try:
        final_state = await writers_graph.ainvoke(initial)
    except Exception:  # noqa: BLE001 — log provider detail, never expose it
        logger.exception("agent invoke failed")
        # No refund: a failure mid-graph has already made an unknown number of
        # calls, and over-counting a broken request is safer than under-counting.
        raise HTTPException(
            status_code=502,
            detail="The writer's room is temporarily unavailable. Please retry.",
        ) from None

    if final_state.get("error"):
        logger.error("agent graph ended with an error: %s", final_state["error"])
        raise HTTPException(
            status_code=502,
            detail="The writer's room could not complete this request. Please retry.",
        )

    # Give back the rounds the gate didn't need: a draft approved on the first
    # pass costs a third of the worst case that was reserved for it.
    rounds = 1 + int(final_state.get("revision_count") or 0)
    budget.refund(_MAX_DEBATE_CALLS - _CALLS_PER_ROUND * rounds)

    return OrchestrateResponse(
        status="success",
        nodes=final_state.get("proposed_nodes", []),
        decision=final_state.get("decision"),
        critic_results=final_state.get("critic_results", []),
        debate_feedback=final_state.get("critique_feedback") or "Approved immediately.",
    )


@router.post("/stream")
async def stream_agent(
    request: OrchestrateRequest,
    budget: Annotated[Reservation, Depends(_debate_budget)],
) -> EventSourceResponse:
    """Stream the live debate as SSE events.

    Event vocabulary:
      agent_start  {agent}              — a persona began thinking
      agent_finish {agent}              — a persona finished
      critique     {critic, feedback, severity, decision}
      decision     {decision}           — merged gate verdict this round
      nodes        {nodes}              — proposed/revised nodes
      error        {message}
      done         {nodes, decision, critic_results, debate_feedback}
    """
    initial = _initial_state(request)

    async def event_stream():
        try:
            # Single pass: stream events AND accumulate the final state from the
            # per-node outputs, so we never run the graph twice (which would
            # double model cost and produce a divergent result).
            acc_nodes: list[dict[str, Any]] = []
            acc_critics: list[dict[str, Any]] = []
            acc_decision: str | None = None
            acc_feedback: str = ""
            rounds = 0  # merged verdicts seen == deliberations actually paid for

            async for ev in writers_graph.astream_events(initial, version="v2"):
                etype = ev.get("event", "")
                name = ev.get("name", "")

                # Emit a lifecycle event on *every* execution. The critics run
                # again after each Reviser pass, and the UI needs to show that
                # second deliberation rather than treating each persona as a
                # one-shot status indicator.
                if etype == "on_chain_start" and name in _NODE_LABELS:
                    yield _sse("agent_start", {"agent": name, "label": _NODE_LABELS[name]})

                elif etype == "on_chain_end" and name in _NODE_LABELS:
                    label = _NODE_LABELS[name]
                    out = ev.get("data", {}).get("output", {}) or {}

                    if name.startswith("critic_") and out.get("critic_results"):
                        cr = out["critic_results"][0]
                        acc_critics.append(cr)
                        yield _sse("critique", cr)
                    elif name == "merge":
                        decision = out.get("decision")
                        if decision:
                            acc_decision = decision
                            rounds += 1
                            yield _sse("decision", {"decision": decision})
                        if out.get("critique_feedback"):
                            acc_feedback = out["critique_feedback"]
                    elif name in ("architect", "reviser"):
                        nodes = out.get("proposed_nodes", [])
                        if nodes:
                            acc_nodes = nodes  # latest draft wins
                            yield _sse("nodes", {"nodes": nodes, "by": label})
                    yield _sse("agent_finish", {"agent": name, "label": label})

            # Same refund as /invoke, counted from the merged verdicts that were
            # actually streamed. A stream that dies mid-debate keeps its charge.
            budget.refund(_MAX_DEBATE_CALLS - _CALLS_PER_ROUND * max(rounds, 1))

            yield _sse(
                "done",
                {
                    "nodes": acc_nodes,
                    "decision": acc_decision,
                    "critic_results": acc_critics,
                    "debate_feedback": acc_feedback,
                },
            )
        except Exception:  # noqa: BLE001 — provider detail stays server-side
            logger.exception("agent stream failed")
            yield _sse(
                "error",
                {"message": "The writer's room is temporarily unavailable. Please retry."},
            )

    return EventSourceResponse(event_stream())
