"use client";

import React, { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  Check,
  Clapperboard,
  GripVertical,
  MapPin,
  Palette,
  Sparkles,
  StickyNote,
  User,
  X,
} from "lucide-react";
import type { StoryNode, StoryNodeType } from "@/lib/canvas-types";

/**
 * One card component renders every narrative element on the canvas.
 *
 * Each `node_type` gets its own accent, icon, and label so a reader can scan
 * the room and instantly tell characters from beats from locations. The card
 * also carries the human-in-the-loop affordances: inline editing, a per-node
 * loading shimmer, and Accept/Reject controls for AI-proposed nodes.
 */

const TYPE_CONFIG: Record<
  StoryNodeType,
  { label: string; icon: React.ElementType; accent: string; ring: string; chip: string }
> = {
  plot_beat: {
    label: "Beat",
    icon: Clapperboard,
    accent: "#00F0FF",
    ring: "rgba(0,240,255,0.35)",
    chip: "bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/30",
  },
  character: {
    label: "Character",
    icon: User,
    accent: "#FF2A6D",
    ring: "rgba(255,42,109,0.35)",
    chip: "bg-[#FF2A6D]/10 text-[#FF5C8D] border-[#FF2A6D]/30",
  },
  location: {
    label: "Location",
    icon: MapPin,
    accent: "#FFCC00",
    ring: "rgba(255,204,0,0.30)",
    chip: "bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/30",
  },
  note: {
    label: "Note",
    icon: StickyNote,
    accent: "#05D582",
    ring: "rgba(5,213,130,0.30)",
    chip: "bg-[#05D582]/10 text-[#05D582] border-[#05D582]/30",
  },
};

function resolveType(node: StoryNode): StoryNodeType {
  const fromData = node.data.node_type;
  if (fromData && fromData in TYPE_CONFIG) return fromData;
  const fromNodeType = node.type as StoryNodeType | undefined;
  if (fromNodeType && fromNodeType in TYPE_CONFIG) return fromNodeType;
  return "plot_beat";
}

const StoryCardNode = ({ data, selected, isConnectable }: NodeProps<StoryNode>) => {
  const type = resolveType({ data, type: data.node_type } as StoryNode);
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  const proposed = Boolean(data.proposed);
  const loading = Boolean(data.loading);

  // Local editable draft, synced from props when the data changes externally.
  const [title, setTitle] = useState(data.title);
  const [content, setContent] = useState(data.content);
  useEffect(() => setTitle(data.title), [data.title]);
  useEffect(() => setContent(data.content), [data.content]);

  const commit = () => {
    if (title !== data.title || content !== data.content) {
      data.onEdit?.(title, content);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`group relative w-[320px] rounded-xl border bg-wine-900/90 backdrop-blur-xl shadow-2xl transition-colors duration-300 ${
        proposed ? "border-dashed" : ""
      }`}
      style={{
        borderColor: selected
          ? cfg.accent
          : proposed
            ? `${cfg.accent}80`
            : "rgba(251,113,133,0.15)",
        boxShadow: selected
          ? `0 0 24px ${cfg.ring}`
          : proposed
            ? `0 0 16px ${cfg.ring}`
            : "0 12px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Incoming handle */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !rounded-full !border-2 !border-wine-950"
        style={{ background: cfg.accent }}
      />

      {/* Drag affordance */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-40 transition-opacity text-rose-100/40">
        <GripVertical size={14} />
      </div>

      {/* Header row: type chip + sequence + actions */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.chip}`}
          >
            <Icon size={11} />
            {cfg.label}
          </span>
          {data.sequence && (
            <span className="text-[10px] font-mono text-rose-100/50 bg-wine-950/60 px-1.5 py-0.5 rounded">
              {data.sequence}
            </span>
          )}
        </div>

        {/* Expand / generate action (only on settled plot beats) */}
        {!proposed && !loading && (
          <div className="flex items-center gap-1">
            {data.onGenerate && (
              <button
                onClick={data.onGenerate}
                title="Ask the room to branch from here"
                className="p-1.5 rounded-md text-rose-100/50 hover:text-rose-300 hover:bg-rose-400/10 transition-colors"
              >
                <Sparkles size={14} />
              </button>
            )}
            {data.onTransform && (
              <button
                onClick={data.onTransform}
                title="Rewrite in a different tone"
                className="p-1.5 rounded-md text-rose-100/50 hover:text-rose-300 hover:bg-rose-400/10 transition-colors"
              >
                <Palette size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editable title */}
      <input
        value={title}
        disabled={loading}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="Untitled"
        className="w-full bg-transparent outline-none px-4 mt-2 text-[15px] font-semibold text-rose-50 placeholder:text-rose-100/40 disabled:opacity-60"
      />

      {/* Editable content */}
      <textarea
        value={content}
        disabled={loading}
        onChange={(e) => setContent(e.target.value)}
        onBlur={commit}
        rows={4}
        placeholder="Empty. Click ✦ to let the room expand this."
        className="w-full bg-transparent outline-none resize-none px-4 mt-1.5 mb-3 text-[12.5px] leading-relaxed text-rose-100/60 placeholder:text-rose-100/30 custom-scrollbar disabled:opacity-60"
      />

      {/* Loading shimmer */}
      {loading && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.4s_infinite]" />
          <div
            className="absolute bottom-0 left-0 h-0.5 w-full animate-pulse"
            style={{ background: cfg.accent }}
          />
        </div>
      )}

      {/* Proposed: accept / reject */}
      {proposed && !loading && (
        <div className="flex items-center justify-between px-4 pb-3">
          <span className="text-[10px] uppercase tracking-widest text-rose-100/50">
            AI suggestion
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={data.onReject}
              title="Reject"
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border border-[#FF2A6D]/40 text-[#FF5C8D] hover:bg-[#FF2A6D]/15 transition-colors"
            >
              <X size={12} /> Reject
            </button>
            <button
              onClick={data.onAccept}
              title="Accept onto the canvas"
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border border-[#05D582]/40 text-[#05D582] hover:bg-[#05D582]/15 transition-colors"
            >
              <Check size={12} /> Accept
            </button>
          </div>
        </div>
      )}

      {/* Outgoing handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !rounded-full !border-2 !border-wine-950"
        style={{ background: cfg.accent }}
      />
    </motion.div>
  );
};

export default memo(StoryCardNode);
