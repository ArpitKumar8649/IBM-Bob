"use client";

import Link from "next/link";
import { Feather, Mail } from "lucide-react";

/**
 * Site footer in the landing page's warm rose family: rose glow blobs behind a
 * dark glass card, rose accent headings, and a gradient brand mark. Adapted
 * from the provided FooterGlow design and enriched with richer columns.
 */

/* Brand icons as inline SVGs (lucide-react no longer ships brand marks). */
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.633 7.997c.013.176.013.353.013.53 0 5.387-4.099 11.605-11.604 11.605A11.561 11.561 0 010 18.29c.373.044.734.074 1.12.074a8.189 8.189 0 005.065-1.737 4.102 4.102 0 01-3.834-2.85c.25.04.5.065.765.065.37 0 .734-.049 1.08-.147A4.092 4.092 0 01.8 8.582v-.05a4.119 4.119 0 001.853.522A4.099 4.099 0 01.812 5.847c0-.02 0-.042.002-.062a11.653 11.653 0 008.457 4.287A4.62 4.62 0 0122 5.924a8.215 8.215 0 002.018-.559 4.108 4.108 0 01-1.803 2.268 8.233 8.233 0 002.368-.648 8.897 8.897 0 01-2.062 2.112z" />
  </svg>
);

const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 .29a12 12 0 00-3.797 23.401c.6.11.82-.26.82-.577v-2.17c-3.338.726-4.042-1.415-4.042-1.415-.546-1.387-1.332-1.756-1.332-1.756-1.09-.744.084-.729.084-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.835 2.809 1.306 3.495.999.106-.775.418-1.307.76-1.608-2.665-.301-5.466-1.332-5.466-5.933 0-1.31.469-2.381 1.236-3.222-.123-.303-.535-1.523.117-3.176 0 0 1.007-.322 3.301 1.23a11.502 11.502 0 016.002 0c2.292-1.552 3.297-1.23 3.297-1.23.654 1.653.242 2.873.119 3.176.77.841 1.235 1.912 1.235 3.222 0 4.61-2.805 5.629-5.476 5.925.429.369.813 1.096.813 2.211v3.285c0 .32.217.694.825.576A12 12 0 0012 .29" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 0h-14a5 5 0 00-5 5v14a5 5 0 005 5h14a5 5 0 005-5v-14a5 5 0 00-5-5zm-11 19h-3v-9h3zm-1.5-10.268a1.752 1.752 0 110-3.505 1.752 1.752 0 010 3.505zm15.5 10.268h-3v-4.5c0-1.07-.02-2.450-1.492-2.450-1.495 0-1.725 1.166-1.725 2.372v4.578h-3v-9h2.88v1.23h.04a3.157 3.157 0 012.847-1.568c3.042 0 3.605 2.003 3.605 4.612v4.726z" />
  </svg>
);

const socialLinks = [
  { icon: TwitterIcon, label: "Twitter", href: "#" },
  { icon: GithubIcon, label: "GitHub", href: "#" },
  { icon: LinkedinIcon, label: "LinkedIn", href: "#" },
];

const columns = [
  {
    title: "Product",
    links: [
      { text: "Features", href: "/#features" },
      { text: "Pricing", href: "/pricing" },
      { text: "Demo room", href: "/room/demo" },
      { text: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { text: "About", href: "#" },
      { text: "Careers", href: "#" },
      { text: "Blog", href: "#" },
      { text: "Contact", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { text: "Docs", href: "#" },
      { text: "Community", href: "#" },
      { text: "Support", href: "#" },
      { text: "Security", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative z-10 mt-8 w-full overflow-hidden pt-16 pb-8">
      {/* Rose glow blobs */}
      <div className="pointer-events-none absolute top-0 left-1/2 z-0 h-full w-full -translate-x-1/2 select-none">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-rose-600/20 blur-3xl" />
        <div className="absolute right-1/4 -bottom-24 h-80 w-80 rounded-full bg-rose-600/20 blur-3xl" />
      </div>

      {/* Glass card */}
      <div
        className="relative mx-auto flex max-w-6xl flex-col items-center gap-10 rounded-2xl px-6 py-10 md:flex-row md:items-start md:justify-between md:gap-12"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(30,0,0,0.10) 60%, #2A0E0E 100%)",
          border: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(2px)",
        }}
      >
        {/* Brand + socials */}
        <div className="flex flex-col items-center md:items-start">
          <Link href="/" className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-700 shadow-[0_0_18px_rgba(244,63,94,0.35)]">
              <Feather className="h-5 w-5 text-white" strokeWidth={2.2} />
            </span>
            <span className="bg-gradient-to-br from-rose-200 to-rose-500 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
              The Writers&apos; Room
            </span>
          </Link>
          <p className="mb-6 max-w-xs text-center text-sm leading-relaxed text-foreground/70 md:text-left">
            A spatial canvas where a crew of AI agents drafts, critiques, and
            revises your story — powered by IBM Granite.
          </p>
          <div className="mt-2 flex gap-4 text-rose-400">
            {socialLinks.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="transition hover:text-rose-200 hover:-translate-y-0.5"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <nav className="flex w-full flex-col gap-9 text-center md:w-auto md:flex-row md:justify-end md:gap-14 md:text-left">
          {columns.map((col) => (
            <div key={col.title}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-rose-400">
                {col.title}
              </div>
              <ul className="space-y-2.5">
                {col.links.map(({ text, href }) => (
                  <li key={text}>
                    <Link
                      href={href}
                      className="text-sm text-foreground/70 transition hover:text-rose-200"
                    >
                      {text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 mt-10 flex flex-col items-center gap-2 text-center text-xs text-foreground/60">
        <span className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-rose-400" />
          Built for the IBM AI Builders Challenge · Creative Industries
        </span>
        <span>&copy; 2026 The Writers&apos; Room. All rights reserved.</span>
      </div>
    </footer>
  );
}
