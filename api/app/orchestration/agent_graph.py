"""The Writer's Room agent crew — a LangGraph debate loop over IBM Granite.

Architecture (fan-out / fan-in):

    START
      |
      v
   architect ──────────────────────────────────┐ (drafts 2-4 spatial nodes)
      |                                          |
      v                                          v
   critics (PARALLEL fan-out) ──────────>  merge ──> gate ──> REVISER
   ├─ character     (arc / voice)          |       |            |
   ├─ world         (setting / lore)       |       |            |
   ├─ continuity    (vs existing canvas)   |       |            |
   └─ tension       (pacing / stakes)      |       |            |
                                          |       |            |
                                          |       v            |
                                          |   (decision)       |
                                          |       |            |
                                          |   APPROVE ──> END   |
                                          |       |            |
                                          |   REJECT ──> reviser
                                          |                      |
                                          └──────────────────────┘
                                            (loop back to critics, max N)

Why this shape: the creative value lives in the *disagreement* between
specialised critics, not in one omniscient model. Each critic reads the whole
canvas (via ``build_spatial_context``) plus the Architect's draft and returns a
focused critique. ``merge`` combines them; ``gate`` decides APPROVE/REJECT. On
REJECT the Reviser rewrites using the merged feedback and we re-critique, up to
``max_revisions`` times.

The Character Lead is the one critic that is not purely a model opinion. Before
its model call, :func:`measure_draft_voices` compares the draft's dialogue
against the fingerprints the writer locked (``locked_voices`` in state) using
:mod:`app.orchestration.voice` — pure arithmetic, no tokens spent. The findings
enter the prompt as settled fact, and :func:`_apply_voice_floor` floors the
returned verdict at the measured one: the model may judge more harshly (it sees
motive and arc, which no metric does) but it cannot talk a measured blocker down
to an approval. A room with no locks measures nothing and the critic behaves
exactly as it did before.

Everything is backend-agnostic: agents call ``get_chat_model(...)`` which
returns ChatWatsonx (watsonx.ai, IBM Granite) or ChatOllama (local Granite)
based on ``MODEL_BACKEND``. The loop runs async (``ainvoke``) so the
``/agent/stream`` SSE endpoint can stream per-agent events.

Agent cast (canonical, used everywhere — README, dock, code):
    Architect · Devil's Advocate (gate) · Character Lead · World Builder ·
    Continuity Checker · Tension/Pacing · Reviser
"""

from __future__ import annotations

import logging
from typing import Annotated, Literal, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from app.llm import get_chat_model
from app.orchestration.context import (
    build_user_prompt,
    fence_untrusted,
    system_prompt_with_guard,
)
from app.orchestration.structured import invoke_structured, safe_json_dumps
from app.orchestration.voice import (
    VoiceDriftReport,
    aggregate_reports,
    evaluate_voice,
    find_dialogue_for,
    join_dialogue,
    severity_rejects,
    speaking_reports,
    worst_severity,
)

logger = logging.getLogger("writers_room.agents")

MAX_REVISIONS = 2


def _bible_block(state: AgentState) -> str:
    """Format the story bible as a fenced canon block, or '' if empty."""
    bible = state.get("story_bible", "")
    if not bible or not bible.strip():
        return ""
    return (
        "\n\n[story bible — established canon, treat as fact]\n"
        + fence_untrusted(bible)
    )

# --------------------------------------------------------------------------- #
# Structured-output schemas
# --------------------------------------------------------------------------- #


class NodeData(BaseModel):
    label: str = Field(
        min_length=1,
        max_length=120,
        description="Short visible title for the node.",
    )
    content: str = Field(
        min_length=1,
        max_length=1_500,
        description="The paragraph-level plot/scene detail.",
    )
    node_type: Literal["character", "plot_beat", "location", "note"] = Field(
        description="Kind of narrative element this node represents."
    )
    relative_x: float = Field(
        default=0.0,
        ge=-400,
        le=400,
        description="Suggested horizontal offset from the parent node, -400..400.",
    )
    relative_y: float = Field(
        default=300.0,
        ge=200,
        le=500,
        description="Suggested vertical offset from the parent node, 200..500 (below parent).",
    )


class SpatialGeneration(BaseModel):
    nodes: list[NodeData] = Field(
        min_length=1,
        max_length=4,
        description=(
            "1-4 newly generated spatial nodes; normally 2-4, with one permitted for fallback."
        ),
    )


class CritiqueOutput(BaseModel):
    decision: Literal["APPROVE", "REJECT"] = Field(
        description="APPROVE only if the draft has no serious flaws; otherwise REJECT."
    )
    feedback: str = Field(
        min_length=1,
        max_length=2_000,
        description=(
            "If REJECT: concrete, ranked flaws (plot holes, cliches, inconsistencies, "
            "weak voice, pacing). If APPROVE: a one-line affirmation."
        ),
    )
    severity: Literal["blocker", "major", "minor", "ok"] = Field(
        default="minor",
        description="Worst-severity issue found, or 'ok' on APPROVE.",
    )


# --------------------------------------------------------------------------- #
# Graph state
# --------------------------------------------------------------------------- #


class CriticResult(TypedDict):
    critic: str
    decision: Literal["APPROVE", "REJECT"]
    feedback: str
    severity: Literal["blocker", "major", "minor", "ok"]


class LockedVoice(TypedDict):
    """One character's locked fingerprint, as stored by ``/api/voice/fingerprints``.

    A ``TypedDict`` with ``total=False`` semantics in practice: every field is read
    through ``.get`` because these rows arrive from Postgres via the browser and a
    row locked by an older build may be missing keys. ``metrics`` is the 14-axis
    blob; :func:`evaluate_voice` absorbs a malformed one as "insufficient sample"
    rather than raising.
    """

    character: str
    metrics: dict
    never_says: NotRequired[list[str]]
    signature_phrases: NotRequired[list[str]]


def _merge_critic_results(
    existing: list[CriticResult] | None,
    update: list[CriticResult] | None,
) -> list[CriticResult]:
    """Reducer for parallel critic writes.

    LangGraph requires an explicit reducer when the four critic nodes update the
    same state key concurrently. ``None`` is a reset signal emitted by the
    Architect/Reviser between rounds; a list from a critic appends its verdict.
    """
    if update is None:
        return []
    return (existing or []) + update


class AgentState(TypedDict):
    room_id: str
    user_intent: str
    spatial_context: str
    # RAG context: relevant story-bible facts, treated as canon by the agents.
    story_bible: str
    proposed_nodes: list[dict]
    # Fingerprints the writer has locked for this room. Read-only for the graph:
    # the Character Lead measures the draft against them and never writes back.
    # Absent or empty means the room has no locks yet, and the critic falls back
    # to its unaided judgement.
    locked_voices: NotRequired[list[LockedVoice]]
    # Canonical merge of all critics' verdicts for the current draft.
    decision: NotRequired[Literal["APPROVE", "REJECT"] | None]
    # Merged, ranked critique feedback the Reviser acts on.
    critique_feedback: str
    # Per-critic results receive concurrent writes from all critic nodes.
    critic_results: NotRequired[Annotated[list[CriticResult] | None, _merge_critic_results]]
    revision_count: int
    error: str | None


# --------------------------------------------------------------------------- #
# Agent node implementations
# --------------------------------------------------------------------------- #


def _empty_generation() -> SpatialGeneration:
    """Fallback when structured output fails entirely — keep the graph moving."""
    return SpatialGeneration(
        nodes=[NodeData(label="(draft unavailable)", content=".", node_type="note")]
    )


def architect_agent(state: AgentState) -> dict:
    """The Architect: drafts 2-4 structural narrative nodes from the canvas + intent."""
    logger.info("Architect drafting for room=%s", state.get("room_id"))
    llm = get_chat_model(temperature=0.7)

    persona = (
        "You are The Architect in a writer's room. You propose STRUCTURAL story "
        "beats — turning points, inciting incidents, reversals — that branch from "
        "the current canvas. Prioritise story structure and pacing. Prefer fresh, "
        "specific ideas over the first cliché that comes to mind."
    )
    extra = (
        "Beat-sheet reminder: a strong beat changes a character's situation, raises "
        "the stakes, or reveals information. Avoid beats that only describe mood "
        "with no change.\n"
        "Good example beat: 'Mira finds her own name on the terminal's missing-persons "
        "log, dated tomorrow.'\n"
        "Cliché to avoid: 'The character suddenly remembers everything.'"
    )
    system = system_prompt_with_guard(persona, extra)
    task = (
        "Given the canvas and the writer's request, generate 2 to 4 narrative nodes "
        "that advance the story. Each node needs a label, content (2-4 sentences), a "
        "node_type, and a small relative position (below the existing canvas). Return "
        "ONLY the structured nodes."
    )
    user = build_user_prompt(task, state["spatial_context"], state["user_intent"])
    user += _bible_block(state)

    result = invoke_structured(
        llm, SpatialGeneration, system, user, max_attempts=2, fallback=_empty_generation()
    )
    return {
        "proposed_nodes": [n.model_dump() for n in result.nodes],
        "revision_count": 0,
        "critique_feedback": "",
        "decision": None,
        "critic_results": None,
        "error": None,
    }


# --- The measured half of the Character Lead ------------------------------- #
#
# Everything below runs in pure Python, before the Character Lead's model call.
# It is the project's trust thesis applied to the debate: the one verdict in the
# room that does not depend on a model's opinion of its own output.
# --------------------------------------------------------------------------- #

# How much measured evidence to hand the model. Enough to explain a rejection,
# short enough not to crowd the draft out of the prompt.
_MAX_VOICE_EVIDENCE = 4


def _draft_text(nodes: list[dict] | None) -> str:
    """Every word of prose in a draft, where its dialogue lives.

    Reads ``content`` off the node dicts the Architect and Reviser produce
    (``NodeData.model_dump()``), not the React Flow ``data`` envelope that
    ``routes/voice.py`` harvests from — the draft never goes through the browser.
    """
    parts: list[str] = []
    for node in nodes or []:
        if not isinstance(node, dict):
            continue
        content = str(node.get("content") or "").strip()
        if content:
            parts.append(content)
    return "\n\n".join(parts)


def measure_draft_voices(
    proposed_nodes: list[dict] | None,
    locked_voices: list[LockedVoice] | None,
) -> list[VoiceDriftReport]:
    """Judge each locked character's dialogue in the draft against their lock.

    One report per locked character who actually speaks in the draft. A character
    with no attributable lines is skipped entirely rather than reported as
    unjudged: they are not in this scene, which is not a finding.

    Pure and total. ``find_dialogue_for`` prefers missing a line to guessing at
    one, and ``evaluate_voice`` never raises — so the worst case is silence, and
    silence leaves the model's own judgement untouched.
    """
    text = _draft_text(proposed_nodes)
    if not text:
        return []

    reports: list[VoiceDriftReport] = []
    for voice in locked_voices or []:
        if not isinstance(voice, dict):
            continue
        name = str(voice.get("character") or "").strip()
        metrics = voice.get("metrics")
        if not name or not isinstance(metrics, dict):
            continue

        lines = find_dialogue_for(text, name)
        if not lines:
            continue

        reports.append(
            evaluate_voice(
                join_dialogue(lines),
                metrics,
                character=name,
                never_says=[str(t) for t in (voice.get("never_says") or [])],
                signature_phrases=[str(p) for p in (voice.get("signature_phrases") or [])],
            )
        )
    return reports


def _voice_evidence_block(reports: list[VoiceDriftReport]) -> str:
    """The measurement, as trusted prompt text for the Character Lead.

    Not fenced as untrusted data: unlike the canvas, these strings are built by
    :func:`summarize_drift` from numbers this process computed, so they are ours.
    The model is told the verdict is already decided and asked to explain and
    extend it — never to overturn it, which it cannot do anyway (see
    :func:`_apply_voice_floor`).
    """
    speaking = speaking_reports(reports)
    if not speaking:
        return ""

    lines = [
        f"- {r.summary}" + ("" if r.judged else f" (not measured: {r.reason})")
        for r in speaking[:_MAX_VOICE_EVIDENCE]
    ]
    return (
        "\n\n[measured voice drift — computed in code from the writer's locked "
        "fingerprints, not a model opinion. These findings are already final and "
        "are part of your verdict; cite them, add what they cannot see (motive, "
        "arc, subtext), and never contradict or dismiss them]\n" + "\n".join(lines)
    )


def _apply_voice_floor(result: CriticResult, reports: list[VoiceDriftReport]) -> CriticResult:
    """Floor the Character Lead's verdict at the measured one.

    The model may make the verdict *worse* — it sees motive and arc, which no
    metric does — but it cannot make it better than the measurement. A blocker or
    major drift therefore rejects the round through ``merge_agent``'s existing
    ``has_blocking`` rule even when the model wrote APPROVE, and the measured
    evidence is prepended to the feedback so the Reviser reads the reason for the
    rejection first.

    A minor measurement does not reject, matching :func:`severity_rejects`: voice
    has legitimate range, and a panel that rejects every slightly-off line trains
    the writer to ignore it. The finding still rides along in the feedback.
    """
    severity, note = aggregate_reports(reports)
    if not speaking_reports(reports):
        return result

    floored = worst_severity(result["severity"], severity)
    decision = result["decision"]
    if severity_rejects(severity):
        decision = "REJECT"
        logger.info("Character Lead: measured voice drift (%s) forces REJECT", severity)

    return {
        "critic": result["critic"],
        "decision": decision,
        "feedback": f"Measured voice drift: {note}\n{result['feedback']}",
        "severity": floored,
    }


# --- The four specialist critics (run in parallel) ------------------------- #

_CRITIC_DEFS: dict[str, tuple[str, str]] = {
    "character": (
        "You are The Character Lead. You judge ONLY character voice, motivation, "
        "and arc consistency. Does each character act from a believable motive? Is "
        "the voice distinct, or generic? Flag characters acting out of convenience.",
        "Reject if a protagonist's action contradicts an established motive with no "
        "setup. Minor: voice drift. Approve if character logic holds.\n"
        "When a measured voice-drift block is present it is arithmetic from the "
        "writer's own locked fingerprints, computed before you were called. Treat it "
        "as established fact: quote it as your evidence, and judge the things it "
        "cannot measure — motive, arc, subtext, whether a character is acting out of "
        "authorial convenience. Do not re-litigate a measurement or claim a drifted "
        "line sounds fine.",
    ),
    "world": (
        "You are The World Builder. You judge ONLY setting, lore, and internal rules. "
        "Does the beat respect established world rules? Are locations concrete and "
        "consistent? Flag invented rules that contradict earlier ones.",
        "Reject if a beat breaks an established world rule. Minor: thin setting. "
        "Approve if world logic holds.",
    ),
    "continuity": (
        "You are The Continuity Checker. You judge ONLY timeline and causal logic "
        "AGAINST THE EXISTING CANVAS. Does this beat follow from what came before? "
        "Are there plot holes, contradictions, or impossible sequencing?",
        "Reject on any plot hole or contradiction with the canvas. Minor: loose "
        "causality. Approve if it fits the existing story.",
    ),
    "tension": (
        "You are The Tension/Pacing critic. You judge ONLY stakes, momentum, and "
        "emotional rhythm. Does the beat raise or release tension deliberately? Is "
        "the pacing flat, rushed, or repetitive? Flag low-stakes beats.",
        "Reject if the beat kills momentum or repeats a prior beat's effect. Minor: "
        "flat pacing. Approve if tension moves purposefully.",
    ),
}


def _make_critic(name: str, persona: str, extra: str, *, measures_voice: bool = False):
    """Build a critic node function. Each critic reads the full canvas + draft.

    ``measures_voice`` turns on the Character Lead's measured half: the draft's
    dialogue is compared against the room's locked fingerprints *before* the model
    call, the findings ride into the prompt as settled fact, and the model's
    verdict is floored at the measured one on the way out. The other three critics
    have nothing to measure, so this is a flag rather than an unconditional step —
    and with it off the node behaves exactly as it did before voice lock existed.
    """

    def critic(state: AgentState) -> dict:
        logger.info("Critic [%s] reviewing draft round=%d", name, state.get("revision_count", 0))
        llm = get_chat_model(temperature=0.2)  # cool, consistent judgement

        # Measure first: the arithmetic is evidence the model reads, not a second
        # opinion it weighs. An empty list here (no locks, or nobody speaks) makes
        # every step below a no-op.
        reports = (
            measure_draft_voices(state["proposed_nodes"], state.get("locked_voices"))
            if measures_voice
            else []
        )

        system = system_prompt_with_guard(persona, extra)
        draft = safe_json_dumps(state["proposed_nodes"])
        task = (
            f"Review the Architect's proposed nodes against the canvas. You are the "
            f"{name.replace('_', ' ').title()} critic — stay in your lane. Return a "
            f"decision (APPROVE/REJECT), your focused feedback, and a severity. Be "
            f"fierce but fair; do not APPROVE just to be polite."
        )
        user = build_user_prompt(task, state["spatial_context"], state["user_intent"], draft)
        user += _bible_block(state)
        user += _voice_evidence_block(reports)

        # A malformed/failed critic response should not blank a valuable draft.
        # Fail closed instead: tell the Reviser to be conservative and surface
        # the unavailable critic in the merged feedback.
        fallback = CritiqueOutput(
            decision="REJECT",
            feedback=(
                f"{name.replace('_', ' ').title()} could not produce a reliable "
                "critique. Revise conservatively and preserve continuity."
            ),
            severity="major",
        )
        result = invoke_structured(
            llm, CritiqueOutput, system, user, max_attempts=2, fallback=fallback
        )
        verdict: CriticResult = {
            "critic": name,
            "decision": result.decision,
            "feedback": result.feedback,
            "severity": result.severity,
        }
        # The floor survives even the fallback path above: a measured blocker is
        # reported whether or not the model managed to answer at all.
        return {"critic_results": [_apply_voice_floor(verdict, reports)]}

    critic.__name__ = f"critic_{name}"
    return critic


# Construct the four critic callables. Only the Character Lead measures.
critic_character = _make_critic("character", *_CRITIC_DEFS["character"], measures_voice=True)
critic_world = _make_critic("world", *_CRITIC_DEFS["world"])
critic_continuity = _make_critic("continuity", *_CRITIC_DEFS["continuity"])
critic_tension = _make_critic("tension", *_CRITIC_DEFS["tension"])


def merge_agent(state: AgentState) -> dict:
    """Merge the parallel critics' results into one ranked feedback bundle + decision.

    Decision rule: any blocker/major REJECT, or a majority of REJECTs, => REJECT.
    Severity escalates to the worst across critics.
    """
    results: list[CriticResult] = state.get("critic_results") or []
    if not results:
        return {"decision": "APPROVE", "critique_feedback": "No critic feedback."}

    rejects = [r for r in results if r["decision"] == "REJECT"]
    has_blocking = any(r["severity"] in ("blocker", "major") for r in rejects)
    # A 2-2 split is meaningful disagreement, not consensus. The room should
    # revise rather than silently accept an evenly contested beat.
    reject_tie_or_majority = len(rejects) * 2 >= len(results)

    decision: Literal["APPROVE", "REJECT"] = (
        "REJECT" if (has_blocking or reject_tie_or_majority) else "APPROVE"
    )

    ranked = sorted(results, key=lambda r: ["blocker", "major", "minor", "ok"].index(r["severity"]))
    lines = []
    for r in ranked:
        tag = r["decision"]
        lines.append(f"[{r['critic']}] ({r['severity']}/{tag}) {r['feedback']}")
    feedback = "\n".join(lines)

    logger.info("Merged %d critics -> %s (%d rejects)", len(results), decision, len(rejects))
    return {"decision": decision, "critique_feedback": feedback}


def reviser_agent(state: AgentState) -> dict:
    """The Reviser: rewrites the draft to resolve the merged critique."""
    logger.info("Reviser rewriting round=%d", state.get("revision_count", 0))
    llm = get_chat_model(temperature=0.6)

    persona = (
        "You are The Reviser. You rewrite the Architect's draft to resolve the "
        "critics' feedback WITHOUT losing the good parts. Address every REJECT and "
        "every blocker/major issue concretely. Output the full revised node set."
    )
    extra = (
        "Rewriting rules: keep node ids stable in spirit; fix the named flaws; do not "
        "introduce new contradictions with the canvas. If a critic is wrong, satisfy "
        "the underlying concern another way rather than ignoring it."
    )
    system = system_prompt_with_guard(persona, extra)
    draft = safe_json_dumps(state["proposed_nodes"])
    task = (
        "The critics REJECTED the current draft. Rewrite the nodes to resolve the "
        "feedback below. Return ONLY the revised structured nodes."
    )
    user = build_user_prompt(
        task, state["spatial_context"], state["user_intent"], draft, state["critique_feedback"]
    )
    user += _bible_block(state)

    result = invoke_structured(
        llm, SpatialGeneration, system, user, max_attempts=2, fallback=_empty_generation()
    )
    return {
        "proposed_nodes": [n.model_dump() for n in result.nodes],
        "revision_count": state.get("revision_count", 0) + 1,
        # Clear stale critic results so the next round re-evaluates fresh.
        "critic_results": None,
    }


# --------------------------------------------------------------------------- #
# Routing
# --------------------------------------------------------------------------- #


def gate_router(state: AgentState) -> str:
    """After the gate decides, route to END (approve/timeout) or the reviser."""
    if state.get("error"):
        return "end"

    decision = state.get("decision")
    revisions = state.get("revision_count", 0)

    if decision == "APPROVE":
        logger.info("Debate resolved: APPROVED.")
        return "end"
    if revisions >= MAX_REVISIONS:
        logger.warning("Debate timeout at %d revisions; forcing end.", revisions)
        return "end"
    logger.info("Debate continues -> reviser (round %d)", revisions + 1)
    return "revise"


# --------------------------------------------------------------------------- #
# Graph construction
# --------------------------------------------------------------------------- #


def build_writers_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("architect", architect_agent)
    # Fan-out: four specialist critics. LangGraph runs them in parallel because
    # they all follow `architect` and none depend on each other.
    workflow.add_node("critic_character", critic_character)
    workflow.add_node("critic_world", critic_world)
    workflow.add_node("critic_continuity", critic_continuity)
    workflow.add_node("critic_tension", critic_tension)
    workflow.add_node("merge", merge_agent)
    workflow.add_node("reviser", reviser_agent)

    workflow.add_edge(START, "architect")

    # Architect -> each critic (parallel fan-out).
    for c in ("critic_character", "critic_world", "critic_continuity", "critic_tension"):
        workflow.add_edge("architect", c)
        workflow.add_edge(c, "merge")  # fan-in to merge

    # Merge decides, then the conditional edge routes.
    workflow.add_conditional_edges(
        "merge",
        gate_router,
        {"end": END, "revise": "reviser"},
    )
    # Reviser loops back through the critics for a fresh evaluation.
    for c in ("critic_character", "critic_world", "critic_continuity", "critic_tension"):
        workflow.add_edge("reviser", c)

    return workflow.compile()


writers_graph = build_writers_graph()
