"use client";

import React from "react";

/**
 * Eight abstract studio logomarks for the "trusted by" logo cloud.
 * Fictional creative studios, drawn in the landing page's rose family.
 * Each is a self-contained SVG that inherits `currentColor` for its stroke/fill
 * so it reads against the dark wine card.
 */

const base = {
  width: 120,
  height: 40,
  viewBox: "0 0 120 40",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

export const Logo01 = () => (
  <svg {...base} aria-label="Northlight Studios">
    <circle cx="20" cy="20" r="11" stroke="currentColor" strokeWidth="2.4" />
    <path d="M20 9v22M9 20h22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">NORTHLIGHT</text>
  </svg>
);

export const Logo02 = () => (
  <svg {...base} aria-label="Fable & Co">
    <path d="M12 30V10l8 6 8-6v20" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">FABLE&amp;CO</text>
  </svg>
);

export const Logo03 = () => (
  <svg {...base} aria-label="Inkwell">
    <path d="M20 8c6 8 9 13 9 17a9 9 0 11-18 0c0-4 3-9 9-17z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">INKWELL</text>
  </svg>
);

export const Logo04 = () => (
  <svg {...base} aria-label="Storyline">
    <path d="M9 26c4-8 8-8 11 0s7 8 11 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="20" cy="13" r="3" fill="currentColor" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">STORYLINE</text>
  </svg>
);

export const Logo05 = () => (
  <svg {...base} aria-label="Reelhouse">
    <rect x="9" y="10" width="22" height="20" rx="4" stroke="currentColor" strokeWidth="2.4" />
    <path d="M9 16h22M15 10v-3M25 10v-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">REELHOUSE</text>
  </svg>
);

export const Logo06 = () => (
  <svg {...base} aria-label="Quillworks">
    <path d="M28 8c-9 2-15 9-17 19l5-1c7-2 12-8 12-18z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M11 29l8-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">QUILLWORKS</text>
  </svg>
);

export const Logo07 = () => (
  <svg {...base} aria-label="Third Act">
    <path d="M9 30l11-20 11 20" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M14.5 21h11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">THIRD ACT</text>
  </svg>
);

export const Logo08 = () => (
  <svg {...base} aria-label="Moonrise">
    <path d="M25 9a11 11 0 100 22 9 9 0 010-22z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <circle cx="27" cy="13" r="1.6" fill="currentColor" />
    <text x="40" y="25" fill="currentColor" fontSize="14" fontWeight="700" letterSpacing="1">MOONRISE</text>
  </svg>
);
