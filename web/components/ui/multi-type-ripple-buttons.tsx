"use client";

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A button that emits a Material-style ripple from the click point.
 * Used by the pricing cards. Accepts any className + children so it can be
 * styled like a normal button.
 */

type Ripple = { x: number; y: number; size: number; id: number };

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  /** Ripple color. Defaults to a translucent white that reads on most fills. */
  rippleColor?: string;
}

let rippleId = 0;

export const RippleButton = ({
  children,
  className,
  rippleColor = "rgba(255,255,255,0.45)",
  onClick,
  ...rest
}: RippleButtonProps) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const addRipple = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      const id = ++rippleId;
      setRipples((prev) => [...prev, { x, y, size, id }]);
      // Remove the ripple after its animation completes.
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 650);
    },
    []
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    addRipple(event);
    onClick?.(event);
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      className={cn("relative overflow-hidden", className)}
      {...rest}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full animate-ripple"
          style={{
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
            background: rippleColor,
            transform: "scale(0)",
          }}
        />
      ))}
      <span className="relative z-10 inline-flex items-center justify-center w-full">
        {children}
      </span>
    </button>
  );
};
