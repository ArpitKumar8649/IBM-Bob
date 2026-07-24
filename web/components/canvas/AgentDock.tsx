"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { AgentName } from "@/lib/api";

/**
 * Live debate dock — shows the AI crew working in real-time.
 * Each agent has a clear visual state: idle (gray), active (pulsing + spinner), done (checkmark).
 */

type AgentStatus = "idle" | "active" | "done";

export type DockAgent = {
  name: AgentName;
  label: string;
  emoji: string;
  accent: string;
};

export const DOCK_AGENTS: DockAgent[] = [
  { name: "architect", label: "Architect", emoji: "🏛️", accent: "#00F0FF" },
  { name: "critic_character", label: "Character", emoji: "🎭", accent: "#FF2A6D" },
  { name: "critic_world", label: "World", emoji: "🌍", accent: "#FFCC00" },
  { name: "critic_continuity", label: "Continuity", emoji: "🧵", accent: "#05D582" },
  { name: "critic_tension", label: "Tension", emoji: "⚡", accent: "#B388FF" },
  { name: "merge", label: "Devil's Advocate", emoji: "⚔️", accent: "#FF6B35" },
  { name: "reviser", label: "Reviser", emoji: "✍️", accent: "#4FC3F7" },
];

type AgentDockProps = {
  statuses: Record<AgentName, AgentStatus>;
  latestCritique?: string | null;
  decision?: "APPROVE" | "REJECT" | null;
  running: boolean;
};

export default function AgentDock({
  statuses,
  latestCritique,
  decision,
  running,
}: AgentDockProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3 pointer-events-none">
      {/* Critique ticker */}
      <AnimatePresence mode="wait">
        {(latestCritique || decision) && (
          <motion.div
            key={latestCritique ?? decision}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl px-5 py-3 rounded-xl backdrop-blur-xl border text-sm leading-relaxed text-center shadow-2xl"
            style={{
              borderColor: decision === "REJECT" ? "#FF2A6D66" : "rgba(251,113,133,0.35)",
              background: "rgba(24,10,16,0.92)",
              color: decision === "REJECT" ? "#FF5C8D" : "#FDA4AF",
            }}
          >
            {decision === "APPROVE" && (
              <span className="inline-flex items-center gap-2 text-[#05D582] font-semibold">
                <CheckCircle2 size={16} /> Room approved the draft
              </span>
            )}
            {decision === "REJECT" && (
              <span className="inline-flex items-center gap-2 font-semibold">
                <XCircle size={16} /> Room sent it back for revision
              </span>
            )}
            {!decision && latestCritique && (
              <span className="text-rose-100/60">{latestCritique}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent crew */}
      <div
        className={`flex items-center gap-2 px-6 py-4 rounded-2xl backdrop-blur-2xl border transition-all duration-500 shadow-[0_20px_60px_rgba(0,0,0,0.7)] ${
          running
            ? "bg-rose-400/8 border-rose-400/50 shadow-[0_0_40px_rgba(244,63,94,0.3)]"
            : "bg-wine-900/90 border-rose-400/15"
        }`}
      >
        {DOCK_AGENTS.map((agent) => {
          const status = statuses[agent.name] ?? "idle";
          const isActive = status === "active";
          const isDone = status === "done";

          return (
            <div key={agent.name} className="flex flex-col items-center gap-1.5 min-w-[72px]">
              {/* Icon circle */}
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all duration-300"
                style={{
                  borderColor: isActive ? agent.accent : isDone ? `${agent.accent}88` : "rgba(251,113,133,0.15)",
                  background: isActive
                    ? `${agent.accent}25`
                    : isDone
                      ? `${agent.accent}15`
                      : "#1D0D14",
                  boxShadow: isActive ? `0 0 20px ${agent.accent}AA` : "none",
                  opacity: isActive || isDone ? 1 : 0.4,
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                }}
              >
                {isActive ? (
                  <Loader2
                    size={24}
                    className="absolute animate-spin"
                    style={{ color: agent.accent }}
                  />
                ) : (
                  <span>{agent.emoji}</span>
                )}
                {isDone && (
                  <span
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-wine-950"
                    style={{ background: agent.accent, color: "#12060B" }}
                  >
                    ✓
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className="text-[10px] font-medium tracking-wide transition-colors whitespace-nowrap"
                style={{
                  color: isActive ? agent.accent : isDone ? "#FDA4AF" : "rgba(253,164,175,0.4)",
                }}
              >
                {agent.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
