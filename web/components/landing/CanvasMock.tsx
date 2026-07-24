"use client";

import React from "react";

/**
 * A static, code-drawn mock of the spatial canvas. Shows the four node types
 * (beat / character / location / note), semantic edges (causes / transitions /
 * conflicts), and a dashed "proposed" AI node — all pure SVG, no images.
 */

const NODES = {
  beat: { x: 40, y: 40, w: 230, h: 88, color: "#00F0FF", label: "BEAT", title: "Scene 1 · The Awakening", sub: "Mira wakes in a locked room…" },
  character: { x: 470, y: 26, w: 230, h: 88, color: "#FF2A6D", label: "CHARACTER", title: "Mira — Protagonist", sub: "Ex-systems engineer. Amnesiac." },
  location: { x: 40, y: 250, w: 230, h: 88, color: "#FFCC00", label: "LOCATION", title: "The Locked Room", sub: "Sub-level 3. One terminal." },
  note: { x: 470, y: 250, w: 230, h: 88, color: "#05D582", label: "NOTE", title: "The door is a lie", sub: "It opens inward. She doesn't know." },
  proposed: { x: 255, y: 400, w: 250, h: 84, color: "#00F0FF", label: "AI SUGGESTION", title: "Beat · The door opens inward", sub: "Drafted by the room — accept?" },
};

function Node({ n, dashed }: { n: (typeof NODES)["beat"]; dashed?: boolean }) {
  return (
    <g>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={14}
        fill="#1D0D14"
        stroke={n.color}
        strokeOpacity={dashed ? 0.6 : 0.35}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "6 5" : undefined}
      />
      {/* Type chip */}
      <rect x={n.x + 12} y={n.y + 12} width={n.label.length * 7 + 16} height={18} rx={9} fill={n.color} fillOpacity={0.14} />
      <text x={n.x + 20} y={n.y + 25} fontSize={9} fontWeight={700} letterSpacing={1.2} fill={n.color}>
        {n.label}
      </text>
      {/* Title */}
      <text x={n.x + 14} y={n.y + 52} fontSize={13} fontWeight={600} fill="#FFF1F2">
        {n.title}
      </text>
      {/* Sub */}
      <text x={n.x + 14} y={n.y + 72} fontSize={10.5} fill="#FDA4AF" fillOpacity={0.6}>
        {n.sub}
      </text>
    </g>
  );
}

function Edge({
  d,
  color,
  dashed,
  label,
  labelX,
  labelY,
  animated,
}: {
  d: string;
  color: string;
  dashed?: string;
  label: string;
  labelX: number;
  labelY: number;
  animated?: boolean;
}) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeDasharray={dashed}
        strokeOpacity={0.8}
        className={animated ? "animate-[dash-move_1.2s_linear_infinite]" : undefined}
        style={animated ? { strokeDasharray: "6 6" } : undefined}
      />
      <rect x={labelX - 30} y={labelY - 9} width={60} height={18} rx={9} fill="#1D0D14" stroke={color} strokeOpacity={0.4} />
      <text x={labelX} y={labelY + 3.5} fontSize={8.5} fontWeight={600} letterSpacing={0.8} fill={color} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

export default function CanvasMock() {
  return (
    <div className="beam-border relative w-full rounded-2xl border border-rose-400/15 bg-wine-900/70 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Dotted grid backdrop */}
      <div className="absolute inset-0 bg-spatial-grid-rose opacity-50" />
      <svg viewBox="0 0 740 500" className="relative w-full h-auto" role="img" aria-label="Preview of the spatial story canvas">
        {/* Edges */}
        <Edge d="M270 84 C 360 84, 380 70, 470 70" color="#FFCC00" label="FEATURES" labelX={370} labelY={62} />
        <Edge d="M155 128 C 155 190, 155 190, 155 250" color="#8E8E93" dashed="6 4" label="TRANSITIONS" labelX={190} labelY={190} />
        <Edge d="M470 294 C 380 294, 360 294, 270 294" color="#FF2A6D" dashed="3 5" label="CONFLICTS" labelX={370} labelY={280} />
        <Edge d="M155 338 C 155 400, 255 420, 255 420" color="#00F0FF" label="CAUSES" labelX={190} labelY={392} animated />

        {/* Nodes */}
        <Node n={NODES.beat} />
        <Node n={NODES.character} />
        <Node n={NODES.location} />
        <Node n={NODES.note} />
        <Node n={NODES.proposed} dashed />

        {/* Accept/Reject pills on the proposed node */}
        <g>
          <rect x={NODES.proposed.x + 14} y={NODES.proposed.y + NODES.proposed.h - 26} width={64} height={18} rx={9} fill="#05D582" fillOpacity={0.16} stroke="#05D582" strokeOpacity={0.5} />
          <text x={NODES.proposed.x + 46} y={NODES.proposed.y + NODES.proposed.h - 13} fontSize={9} fontWeight={700} fill="#05D582" textAnchor="middle">
            ACCEPT
          </text>
          <rect x={NODES.proposed.x + 86} y={NODES.proposed.y + NODES.proposed.h - 26} width={60} height={18} rx={9} fill="#FF2A6D" fillOpacity={0.14} stroke="#FF2A6D" strokeOpacity={0.5} />
          <text x={NODES.proposed.x + 116} y={NODES.proposed.y + NODES.proposed.h - 13} fontSize={9} fontWeight={700} fill="#FF5C8D" textAnchor="middle">
            REJECT
          </text>
        </g>
      </svg>
    </div>
  );
}
