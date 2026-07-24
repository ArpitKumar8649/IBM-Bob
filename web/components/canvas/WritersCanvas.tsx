"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Clapperboard, MessageSquare, Presentation, Sparkles } from "lucide-react";

import StoryCardNode from "./nodes/StoryCardNode";
import StoryEdgeComponent from "./edges/StoryEdge";
import AgentDock, { DOCK_AGENTS } from "./AgentDock";
import AgentChatDrawer from "./AgentChatDrawer";
import StoryBiblePanel from "./StoryBiblePanel";
import PitchDeckPanel from "./PitchDeckPanel";
import { useToast } from "@/components/ui/Toast";
import { useStoryRoom } from "@/hooks/useStoryRoom";
import {
  seedFromPremise,
  streamAgentDebate,
  type AgentName,
  type GeneratedStoryNode,
  type StreamEvent,
} from "@/lib/api";
import { searchFacts, type StoryFact } from "@/lib/bible";
import {
  EDGE_STYLES,
  type EdgeSemantics,
  type StoryEdge,
  type StoryNode,
  type StoryNodeType,
} from "@/lib/canvas-types";
import type { StoredEdge, StoredNode } from "@/liveblocks.config";
import { compileScreenplay, downloadScreenplay } from "@/lib/screenplay";

const nodeTypes = {
  plot_beat: StoryCardNode,
  character: StoryCardNode,
  location: StoryCardNode,
  note: StoryCardNode,
};

const edgeTypes = { story: StoryEdgeComponent };

type AgentStatus = "idle" | "active" | "done";
const IDLE_STATUSES = DOCK_AGENTS.reduce(
  (acc, a) => ({ ...acc, [a.name]: "idle" as AgentStatus }),
  {} as Record<AgentName, AgentStatus>
);

/** Fan AI nodes out in a clean row below a parent, honoring relative offsets. */
function layoutChildren(
  parent: StoryNode,
  generated: GeneratedStoryNode[],
  existingCount: number
): StoryNode[] {
  const NODE_WIDTH = 320;
  const GAP = 60;
  const SPACING = NODE_WIDTH + GAP;
  const Y_OFFSET = 340;
  const total = generated.length;
  const startX = parent.position.x - ((total - 1) * SPACING) / 2;

  return generated.map((g, idx) => {
    const type: StoryNodeType = g.node_type ?? "plot_beat";
    return {
      id: `ai-${Date.now()}-${existingCount + idx}`,
      type,
      position: {
        x: startX + idx * SPACING + (g.relative_x || 0),
        y: parent.position.y + Y_OFFSET + (g.relative_y || 0),
      },
      data: {
        title: g.label || "AI Suggestion",
        content: g.content || "",
        sequence: "AI",
        node_type: type,
        proposed: true,
      },
    };
  });
}

/** Convert a StoryNode to the stored format for Liveblocks. */
function toStoredNode(n: StoryNode): StoredNode {
  return {
    id: n.id,
    type: n.type || "plot_beat",
    position: n.position,
    data: {
      title: n.data.title,
      content: n.data.content,
      sequence: n.data.sequence,
      node_type: n.data.node_type || n.type || "plot_beat",
      proposed: n.data.proposed,
    },
  };
}

/** Convert a StoryEdge to the stored format for Liveblocks. */
function toStoredEdge(e: StoryEdge): StoredEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: "story",
    label: e.data?.label || "transitions_to",
  };
}

export default function WritersCanvas({ roomId = "demo-room" }: { roomId?: string }) {
  const { toast } = useToast();
  const {
    nodes,
    edges,
    isLoaded,
    addNodes,
    removeNode,
    updateNode,
    moveNode,
    addEdges,
    resetRoom,
  } = useStoryRoom();

  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<AgentName, AgentStatus>>(IDLE_STATUSES);
  const [latestCritique, setLatestCritique] = useState<string | null>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [showPremise, setShowPremise] = useState(false);
  const [premise, setPremise] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [storyFacts, setStoryFacts] = useState<StoryFact[]>([]);

  // Keep the latest graph in refs so streaming callbacks read fresh state.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const resetDock = useCallback(() => {
    setStatuses({ ...IDLE_STATUSES });
    setLatestCritique(null);
    setDecision(null);
  }, []);

  const acceptNode = useCallback(
    (id: string) => {
      updateNode(id, { proposed: false, sequence: "★" });
      toast("Beat accepted onto the canvas.", "success");
    },
    [updateNode, toast]
  );

  const rejectNode = useCallback(
    (id: string) => {
      removeNode(id);
      toast("Suggestion rejected.", "info");
    },
    [removeNode, toast]
  );

  const editNode = useCallback(
    (id: string, title: string, content: string) => {
      updateNode(id, { title, content });
    },
    [updateNode]
  );

  /** Serialize the current graph for the backend (no functions/styles). */
  const serializeGraph = useCallback(() => {
    return {
      nodes: nodesRef.current.map((n) => ({
        id: n.id,
        data: {
          title: n.data.title,
          content: n.data.content,
          sequence: n.data.sequence,
          node_type: n.data.node_type || n.type,
        },
      })),
      edges: edgesRef.current.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data?.label ? { label: e.data.label } : undefined,
      })),
    };
  }, []);

  /** Compact text summary of the canvas for agent-chat context. */
  const serializeGraphText = useCallback(() => {
    const nodeLines = nodesRef.current.map((n) => {
      const type = n.data.node_type || n.type || "plot_beat";
      return `- [${type}] ${n.data.title}: ${n.data.content}`;
    });
    const edgeLines = edgesRef.current.map((e) => {
      const label = e.data?.label || "connects";
      return `  ${e.source} --${label}--> ${e.target}`;
    });
    const parts = ["CANVAS NODES:", ...nodeLines];
    if (edgeLines.length) parts.push("", "RELATIONSHIPS:", ...edgeLines);
    return parts.join("\n");
  }, []);

  /** Run the full streaming debate branching from a node. */
  const runDebate = useCallback(
    async (parentId: string) => {
      if (running) return;
      const parent = nodesRef.current.find((n) => n.id === parentId);
      if (!parent) return;

      setRunning(true);
      resetDock();
      updateNode(parentId, { loading: true });

      const { nodes: gNodes, edges: gEdges } = serializeGraph();
      const proposed: StoryNode[] = [];

      // RAG: retrieve the story-bible facts most relevant to this branch so
      // every agent grounds its work in the established world.
      let ragFacts: { category: string; content: string }[] = [];
      try {
        const results = await searchFacts(roomId, parent.data.title + " " + parent.data.content, 6);
        ragFacts = results.map((r) => ({ category: r.category, content: r.content }));
      } catch {
        // Story bible is best-effort; the debate still works without it.
      }

      try {
        await streamAgentDebate(
          {
            roomId,
            userIntent: `Draft a consequential next beat branching from "${parent.data.title}". Preserve its established context while advancing the larger story.`,
            nodes: gNodes,
            edges: gEdges,
            storyFacts: ragFacts,
          },
          (event: StreamEvent) => {
            console.log("[SSE Event]", event.event, event);
            switch (event.event) {
              case "agent_start":
                setStatuses((s) => ({ ...s, [event.agent]: "active" }));
                break;
              case "agent_finish":
                setStatuses((s) => ({ ...s, [event.agent]: "done" }));
                break;
              case "critique":
                setLatestCritique(`${event.critic}: ${event.feedback}`);
                break;
              case "decision":
                setDecision(event.decision);
                break;
              case "nodes":
                console.log("[SSE] Got nodes event:", event.nodes);
                proposed.length = 0;
                proposed.push(...layoutChildren(parent, event.nodes, gNodes.length));
                console.log("[SSE] After layoutChildren, proposed:", proposed);
                break;
              case "done":
                console.log("[SSE] Got done event, nodes:", event.nodes);
                if (event.nodes?.length) {
                  proposed.length = 0;
                  proposed.push(...layoutChildren(parent, event.nodes, gNodes.length));
                }
                break;
              case "error":
                toast(event.message, "error");
                break;
            }
          }
        );

        // Materialize the final proposed nodes + edges onto the canvas.
        if (proposed.length) {
          const newEdges: StoryEdge[] = proposed.map((pn) => ({
            id: `e-${parentId}-${pn.id}`,
            source: parentId,
            target: pn.id,
            type: "story",
            animated: true,
            data: { label: "causes" as EdgeSemantics },
            style: { stroke: EDGE_STYLES.causes.stroke, strokeWidth: 1.75 },
          }));
          addNodes(proposed.map(toStoredNode));
          addEdges(newEdges.map(toStoredEdge));
          toast(`The room pitched ${proposed.length} new beat(s).`, "success");
        } else {
          toast("The room didn't produce new beats. Try again.", "info");
        }
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "The debate failed to start.",
          "error"
        );
      } finally {
        updateNode(parentId, { loading: false });
        setRunning(false);
      }
    },
    [running, roomId, resetDock, serializeGraph, toast, addNodes, addEdges, updateNode]
  );

  /** Seed a brand-new story from a premise. */
  const seedStory = useCallback(async () => {
    if (!premise.trim() || seeding) return;
    setSeeding(true);
    resetDock();
    try {
      const result = await seedFromPremise({ roomId, premise: premise.trim() });
      if (result.nodes?.length) {
        const seeded: StoryNode[] = result.nodes.map((g, idx) => {
          const type: StoryNodeType = g.node_type ?? "plot_beat";
          return {
            id: `seed-${Date.now()}-${idx}`,
            type,
            position: { x: 200 + idx * 380, y: 200 },
            data: {
              title: g.label || `Beat ${idx + 1}`,
              content: g.content || "",
              sequence: `${idx + 1}`,
              node_type: type,
              proposed: true,
            },
          };
        });
        resetRoom(seeded.map(toStoredNode), []);
        setShowPremise(false);
        setPremise("");
        toast("Opening beats drafted. Accept the ones you love.", "success");
      } else {
        toast("The room couldn't seed from that premise yet.", "info");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Seeding failed.", "error");
    } finally {
      setSeeding(false);
    }
  }, [premise, seeding, roomId, resetDock, resetRoom, toast]);

  /** Compile + download the screenplay (Director's Cut). */
  const directorsCut = useCallback(() => {
    if (nodes.length === 0) {
      toast("Nothing to compile yet — add some beats first.", "info");
      return;
    }
    const fountain = compileScreenplay(nodes, edges, "The Writers' Room Draft");
    downloadScreenplay(fountain, "writers-room-draft.fountain");
    toast("Screenplay compiled — check your downloads.", "success");
  }, [nodes, edges, toast]);

  // Inject per-node callbacks without recreating node identity needlessly.
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onGenerate: () => runDebate(node.id),
          onAccept: () => acceptNode(node.id),
          onReject: () => rejectNode(node.id),
          onEdit: (title: string, content: string) => editNode(node.id, title, content),
        },
      })),
    [nodes, runDebate, acceptNode, rejectNode, editNode]
  );

  // Handle node changes: only process removals here; positions commit on drag-end.
  const onNodesChange = useCallback(
    (changes: NodeChange<StoryNode>[]) => {
      for (const change of changes) {
        if (change.type === "remove") {
          removeNode(change.id);
        }
      }
    },
    [removeNode]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<StoryEdge>[]) => {
      for (const change of changes) {
        if (change.type === "remove") {
          // Edge removal is handled by removeNode for connected edges.
          // For standalone edge deletion, we'd need a removeEdge mutation.
          // For now, edges are removed when their source/target node is removed.
        }
      }
    },
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: StoryEdge = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        type: "story",
        animated: true,
        data: { label: "transitions_to" as EdgeSemantics },
        style: { stroke: EDGE_STYLES.transitions_to.stroke, strokeWidth: 1.75 },
      };
      addEdges([toStoredEdge(newEdge)]);
    },
    [addEdges]
  );

  // Commit position on drag end (not during drag, to avoid chatty storage writes).
  const onNodeDragStop = useCallback(
    (_event: unknown, node: StoryNode) => {
      moveNode(node.id, node.position);
    },
    [moveNode]
  );

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-rose-100/50 animate-pulse font-mono text-sm tracking-widest uppercase">
          Loading room…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Top action bar (sits below the room header) */}
      <div className="absolute top-[76px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
        <button
          onClick={() => setShowPremise((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wine-900/80 backdrop-blur-md border border-rose-400/15 text-[12px] font-medium text-rose-50 hover:border-rose-400/50 transition-colors"
        >
          <Sparkles size={14} className="text-rose-300" /> New premise
        </button>
        <button
          onClick={directorsCut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-400/10 backdrop-blur-md border border-rose-400/50 text-[12px] font-semibold text-rose-300 hover:bg-rose-400/20 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.15)]"
        >
          <Clapperboard size={14} /> Director&apos;s Cut
        </button>
        <button
          onClick={() => setBibleOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wine-900/80 backdrop-blur-md border border-rose-400/15 text-[12px] font-medium text-rose-50 hover:border-rose-400/50 transition-colors"
        >
          <BookOpen size={14} className="text-rose-300" /> Story Bible
        </button>
        <button
          onClick={() => setChatOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wine-900/80 backdrop-blur-md border border-rose-400/15 text-[12px] font-medium text-rose-50 hover:border-rose-400/50 transition-colors"
        >
          <MessageSquare size={14} className="text-rose-300" /> Talk to an agent
        </button>
        <button
          onClick={() => setPitchOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wine-900/80 backdrop-blur-md border border-rose-400/15 text-[12px] font-medium text-rose-50 hover:border-rose-400/50 transition-colors"
        >
          <Presentation size={14} className="text-rose-300" /> Pitch Deck
        </button>
      </div>

      {/* Premise entry popover */}
      <AnimatePresence>
        {showPremise && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[128px] left-1/2 -translate-x-1/2 z-40 w-[440px] max-w-[90vw] p-4 rounded-2xl bg-wine-900/95 backdrop-blur-xl border border-rose-400/15 shadow-2xl"
          >
            <label className="block text-[11px] uppercase tracking-widest text-rose-100/50 mb-2">
              Describe your story premise
            </label>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              rows={3}
              autoFocus
              placeholder="A lighthouse keeper discovers the sea is rising because something beneath it is waking up…"
              className="w-full bg-wine-950/60 border border-rose-400/15 rounded-lg px-3 py-2 text-[13px] text-rose-50 placeholder:text-rose-100/30 outline-none focus:border-rose-400/50 resize-none custom-scrollbar"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowPremise(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] text-rose-100/50 hover:text-rose-50"
              >
                Cancel
              </button>
              <button
                onClick={seedStory}
                disabled={seeding || !premise.trim()}
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-rose-400/15 text-rose-300 border border-rose-400/40 hover:bg-rose-400/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {seeding ? "Drafting…" : "Seed the room"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {nodes.length === 0 && !showPremise && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
          <p className="font-display text-2xl text-rose-50/80 mb-2">
            The room is empty.
          </p>
          <p className="text-[13px] text-rose-100/50 mb-4">
            Give the crew a premise and watch them build the opening.
          </p>
          <button
            onClick={() => setShowPremise(true)}
            className="pointer-events-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-400/10 border border-rose-400/50 text-rose-300 text-[13px] font-semibold hover:bg-rose-400/20 transition-colors"
          >
            <Sparkles size={15} /> Start with a premise
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        fitView
        className="dark"
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#3A1B24" variant={BackgroundVariant.Dots} gap={24} size={2} />
        <Controls className="bg-wine-900 border-rose-400/15 fill-rose-100 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]" />
        <MiniMap
          nodeColor={(n) => {
            const t = (n.data as StoryNode["data"])?.node_type || n.type;
            return t === "character"
              ? "#FF2A6D"
              : t === "location"
                ? "#FFCC00"
                : t === "note"
                  ? "#05D582"
                  : "#00F0FF";
          }}
          maskColor="rgba(18, 6, 11, 0.8)"
          style={{
            backgroundColor: "#1D0D14",
            border: "1px solid rgba(251,113,133,0.15)",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        />
      </ReactFlow>

      {/* Live agent dock */}
      <AgentDock
        statuses={statuses}
        latestCritique={latestCritique}
        decision={decision}
        running={running}
      />

      {/* Story Bible panel (left) */}
      <StoryBiblePanel
        open={bibleOpen}
        onClose={() => setBibleOpen(false)}
        roomId={roomId}
        onFactsChange={setStoryFacts}
      />

      {/* Agent chat drawer (right) */}
      <AgentChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        roomId={roomId}
        spatialContext={serializeGraphText()}
        storyFacts={storyFacts}
      />

      {/* Pitch deck generator (modal) */}
      <PitchDeckPanel
        open={pitchOpen}
        onClose={() => setPitchOpen(false)}
        roomId={roomId}
        nodes={serializeGraph().nodes}
        edges={serializeGraph().edges}
        storyFacts={storyFacts.map((f) => ({ category: f.category, content: f.content }))}
      />
    </div>
  );
}
