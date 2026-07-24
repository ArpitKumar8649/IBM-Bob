"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * A beam of light that orbits the border of its parent element.
 *
 * Uses CSS Motion Path (`offset-path: rect(...)`) to travel the rounded
 * rectangle perimeter, with a conic-gradient "comet" as the beam. The parent
 * must have `relative` positioning and (usually) a border + rounded corners.
 *
 * The `duration` and `size` props MUST match the constants used by the
 * LogoCloud's `useAnimationFrame` sync logic (beam offset is derived from the
 * same clock so the text shimmer tracks the beam).
 */

interface BorderBeamProps {
  className?: string;
  /** Beam length in px. */
  size?: number;
  /** Seconds per full orbit. */
  duration?: number;
  /** Border width in px. */
  borderWidth?: number;
  /** Starting anchor (degrees) for the gradient. */
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  /** Delay in seconds (negative to start mid-orbit). */
  delay?: number;
}

export const BorderBeam = ({
  className,
  size = 100,
  duration = 8,
  borderWidth = 1.5,
  anchor = 90,
  colorFrom = "#FB7185",
  colorTo = "#F43F5E",
  delay = 0,
}: BorderBeamProps) => {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": duration,
          "--anchor": anchor,
          "--border-width": borderWidth,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--delay": `-${delay}s`,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        "[border:calc(var(--border-width)*1px)_solid_transparent]",
        "![mask-clip:padding-box,border-box]",
        "![mask-composite:intersect]",
        "[mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        "after:absolute after:aspect-square after:w-[calc(var(--size)*1px)]",
        "after:animate-border-beam after:[animation-delay:var(--delay)]",
        "after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]",
        "after:[offset-anchor:calc(var(--anchor)*1%)_50%]",
        "after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]",
        className
      )}
    />
  );
};
