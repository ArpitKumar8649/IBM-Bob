"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A self-contained, looping preview of the Writer's Room debate.
 *
 * The landing page's job is to show the core innovation — an AI crew that
 * *argues* about your story — in the first two seconds, with zero backend.
 * This cycles through a scripted debate so the room feels alive on load.
 */

type Line = {
  agent: string;
  emoji: string;
  accent: string;
  text: string;
  verdict?: "APPROVE" | "REJECT";
};

const SCRIPT: Line[] = [
  {
    agent: "Architect",
    emoji: "🏛️",
    accent: "#00F0FF",
    text: "Mira finds her own name on the terminal's missing-persons log — dated tomorrow.",
  },
  {
    agent: "Continuity",
    emoji: "🧵",
    accent: "#05D582",
    text: "Wait — she already escaped the room in beat 1B. How is she still inside?",
    verdict: "REJECT",
  },
  {
    agent: "Devil's Advocate",
    emoji: "⚔️",
    accent: "#FF6B35",
    text: "REJECT. The timeline contradicts itself. Send it back.",
    verdict: "REJECT",
  },
  {
    agent: "Reviser",
    emoji: "✍️",
    accent: "#4FC3F7",
    text: "Fixed: the log is a *recording* from a future loop. Mira hasn't escaped yet — she's watching herself fail.",
  },
  {
    agent: "Devil's Advocate",
    emoji: "⚔️",
    accent: "#FF6B35",
    text: "APPROVE. Now the mystery earns its twist.",
    verdict: "APPROVE",
  },
];

export default function DebatePreview() {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible((v) => (v >= SCRIPT.length ? 1 : v + 1));
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  const shown = SCRIPT.slice(0, visible);

  return (
    <div className="beam-border w-full max-w-md rounded-2xl border border-rose-400/15 bg-wine-900/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rose-400/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-[11px] uppercase tracking-widest text-rose-100/50">
            The room is debating
          </span>
        </div>
        <span className="text-[10px] font-mono text-rose-100/50">IBM Granite</span>
      </div>

      {/* Transcript */}
      <div className="p-4 space-y-3 min-h-[240px]">
        <AnimatePresence initial={false}>
          {shown.map((line, i) => (
            <motion.div
              key={`${i}-${line.agent}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex gap-2.5"
            >
              <div
                className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm border"
                style={{ borderColor: `${line.accent}66`, background: `${line.accent}18` }}
              >
                {line.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: line.accent }}
                  >
                    {line.agent}
                  </span>
                  {line.verdict && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        color: line.verdict === "APPROVE" ? "#05D582" : "#FF5C8D",
                        background:
                          line.verdict === "APPROVE" ? "#05D58222" : "#FF2A6D22",
                      }}
                    >
                      {line.verdict}
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] leading-snug text-rose-100/60">
                  {line.text}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
