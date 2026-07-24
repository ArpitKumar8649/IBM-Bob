"use client";

import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { EDGE_STYLES, type StoryEdge } from "@/lib/canvas-types";

/**
 * A story edge that carries meaning. Instead of one anonymous cyan line, each
 * edge declares a relationship — causes / transitions_to / features / conflicts —
 * rendered with its own color, dash pattern, and a floating label. This turns
 * the graph from "nodes near each other" into a readable story structure.
 */
export default function StoryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<StoryEdge>) {
  const semantics = data?.label ?? "transitions_to";
  const style = EDGE_STYLES[semantics] ?? EDGE_STYLES.transitions_to;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? 2.5 : 1.75,
          strokeDasharray: style.dash,
          opacity: selected ? 1 : 0.85,
        }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto absolute rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#0A0A10",
              color: style.stroke,
              borderColor: `${style.stroke}66`,
            }}
          >
            {style.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
