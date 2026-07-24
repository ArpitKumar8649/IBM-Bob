"use client";

import React from "react";

/**
 * A light "paper" panel showing the Director's Cut output as a properly
 * formatted screenplay (Courier, slugline / action / character / dialogue).
 * The bright page against the dark site reads instantly as "a real script."
 */

export default function ScreenplayShowcase() {
  return (
    <div className="relative mx-auto max-w-xl">
      {/* Paper */}
     <div className="beam-border relative rounded-sm bg-[#F7F4EC] px-8 py-10 shadow-[0_30px_70px_rgba(0,0,0,0.55)] rotate-[-0.6deg]">
        {/* Punch holes */}
        <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-around py-8">
          <span className="w-2.5 h-2.5 rounded-full bg-void-900/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-void-900/15" />
        </div>

        <div className="font-script text-[#2A2A2E] leading-[1.5]">
          {/* Scene heading */}
          <p className="font-bold uppercase text-[13px] tracking-wide">
            INT. THE LOCKED ROOM — SUB-LEVEL 3 — NIGHT
          </p>

          {/* Action */}
          <p className="mt-4 text-[13px]">
            MIRA wakes on cold steel. No memory. A terminal glows against the far
            wall, counting down.
          </p>

          {/* Character cue */}
          <p className="mt-4 text-[13px] font-bold text-center uppercase">Mira</p>
          {/* Parenthetical */}
          <p className="text-[12px] italic text-center text-[#2A2A2E]/70">(hoarse)</p>
          {/* Dialogue */}
          <p className="text-[13px] text-center max-w-[280px] mx-auto">
            Where am I? …How long have I been here?
          </p>

          {/* Action */}
          <p className="mt-4 text-[13px]">
            The terminal flickers. A single line resolves:
          </p>

          {/* Insert */}
          <p className="mt-3 text-[13px] font-bold uppercase">INSERT — TERMINAL SCREEN</p>
          <p className="text-[13px] text-center max-w-[300px] mx-auto">
            SUBJECT 7 — ESCAPE WINDOW CLOSES AT MIDNIGHT.
          </p>
          <p className="mt-3 text-[13px] font-bold uppercase">BACK TO SCENE</p>

          {/* Transition */}
          <p className="mt-5 text-right text-[13px] font-bold uppercase">CUT TO:</p>
        </div>

        {/* Page footer */}
        <div className="absolute bottom-3 right-6 font-script text-[10px] text-[#2A2A2E]/50">
          1.
        </div>
      </div>

      {/* Floating "compiled from N nodes" badge */}
      <div className="absolute -top-4 -right-4 rotate-2 rounded-full border border-rose-400/40 bg-wine-900/95 px-4 py-2 text-[11px] font-semibold text-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.25)] backdrop-blur">
        Compiled from 12 nodes · 0.8s
      </div>
    </div>
  );
}
