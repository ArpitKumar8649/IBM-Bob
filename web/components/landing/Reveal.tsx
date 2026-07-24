"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Scroll-reveal wrapper. Children fade/slide up when they enter the viewport.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity:0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Consistent section heading: a Courier slugline kicker + display headline. */
export function SectionHeading({
  kicker,
  title,
  accent,
  lede,
}: {
  kicker: string;
  title: React.ReactNode;
  accent?: string;
  lede?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p
        className="font-script text-[12px] tracking-[0.3em] uppercase mb-3"
        style={{ color: accent ?? "#FB7185" }}
      >
        {kicker}
      </p>
      <h2 className="font-display text-3xl md:text-5xl font-extrabold leading-[1.08] tracking-tight text-rose-50">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-[15px] leading-relaxed text-rose-100/60">{lede}</p>
      )}
    </div>
  );
}
