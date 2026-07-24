"use client";

import React, { useEffect, useRef, useState } from "react";
import VaporizeTextCycle, { Tag } from "@/components/ui/vapour-text-effect";

/**
 * VapourAccent — a drop-in animated accent for headings.
 *
 * Renders a VaporizeTextCycle canvas that cycles through phrases, vaporizing
 * each one into particles. It measures the parent heading's computed font
 * (family + size) so the particles match the display typeface exactly and stay
 * responsive across breakpoints. Themed to the site's rose accent.
 *
 * Use as a block-level child of a heading:
 *   <h1>
 *     A writer&apos;s room
 *     <VapourAccent texts={["that argues back.", "that pushes further."]} />
 *   </h1>
 */
export default function VapourAccent({
  texts,
  color = "rgb(251, 113, 133)", // rose-400
  fontWeight = 800,
  animation = { vaporizeDuration: 2.4, fadeInDuration: 0.9, waitDuration: 1.6 },
}: {
  texts: string[];
  color?: string;
  fontWeight?: number;
  animation?: {
    vaporizeDuration?: number;
    fadeInDuration?: number;
    waitDuration?: number;
  };
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState({ fontFamily: "sans-serif", fontSize: 48 });

  useEffect(() => {
    const measure = () => {
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const cs = getComputedStyle(parent);
      setMetrics({
        fontFamily: cs.fontFamily,
        fontSize: parseFloat(cs.fontSize) || 48,
      });
    };

    measure();
    // Re-measure once webfonts finish loading so particles use the real face.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <span
      ref={ref}
      className="block w-full"
      style={{ height: `${metrics.fontSize * 1.25}px` }}
    >
      <VaporizeTextCycle
        texts={texts}
        font={{
          fontFamily: metrics.fontFamily,
          fontSize: `${metrics.fontSize}px`,
          fontWeight,
        }}
        color={color}
        spread={4}
        density={6}
        animation={animation}
        direction="left-to-right"
        alignment="left"
        tag={Tag.P}
      />
    </span>
  );
}
