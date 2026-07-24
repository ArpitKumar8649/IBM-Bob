"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * A reusable horizontal marquee. Children are rendered twice and the track
 * translates -50% on a loop. Configure via:
 * - `[--duration:20s]`  — loop speed
 *  - `pauseOnHover`      — pause while hovered
 *  - `mask-x-from-75%`   — fade the edges (see globals.css)
 */

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  pauseOnHover?: boolean;
}

export function Marquee({ children, className, pauseOnHover = false }: MarqueeProps) {
  return (
    <div className={cn("group relative flex w-full overflow-hidden", className)}>
      <div
        className={cn(
          "flex w-max shrink-0 items-center animate-marquee",
          pauseOnHover && "group-hover:[animation-play-state:paused]"
        )}
        style={{ animationDuration: "var(--duration, 20s)" }}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "flex w-max shrink-0 items-center animate-marquee",
          pauseOnHover && "group-hover:[animation-play-state:paused]"
        )}
        style={{ animationDuration: "var(--duration, 20s)" }}
      >
        {children}
      </div>
    </div>
  );
}
