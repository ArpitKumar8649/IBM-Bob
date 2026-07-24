/**
 * Canonical canvas types for the Writer's Room spatial canvas.
 *
 * Shared by the React Flow canvas, the node components, the agent dock, and
 * the Director's Cut compiler so every layer agrees on what a story node is.
 * Built on @xyflow/react v12's generic `Node` type.
 */

import type { Edge, Node } from "@xyflow/react";

/** The four narrative element kinds the agent crew can produce. */
export type StoryNodeType = "character" | "plot_beat" | "location" | "note";

/** Data carried by every story node on the canvas. */
export type StoryNodeData = {
  title: string;
  content: string;
  sequence?: string;
  node_type?: StoryNodeType;
  /** True for AI-generated nodes awaiting the writer's accept/reject. */
  proposed?: boolean;
  /** Per-node loading flag (replaces the fragile in-string "[thinking]" marker). */
  loading?: boolean;
  /** Interaction callbacks injected by the canvas (v12 data-callback pattern). */
  onGenerate?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onEdit?: (title: string, content: string) => void;
};

/** A concrete React Flow node carrying StoryNodeData. */
export type StoryNode = Node<StoryNodeData, string>;

/** Semantic relationship labels for edges between story nodes. */
export type EdgeSemantics = "causes" | "transitions_to" | "features" | "conflicts";

export type StoryEdgeData = {
  label?: EdgeSemantics;
};

export type StoryEdge = Edge<StoryEdgeData, string>;

/** Visual treatment per edge semantic. */
export const EDGE_STYLES: Record<
  EdgeSemantics,
  { stroke: string; dash?: string; label: string }
> = {
  causes: { stroke: "#00F0FF", label: "causes" },
  transitions_to: { stroke: "#8E8E93", dash: "6 3", label: "transitions to" },
  features: { stroke: "#FFCC00", label: "features" },
  conflicts: { stroke: "#FF2A6D", dash: "2 4", label: "conflicts" },
};
