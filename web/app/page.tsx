"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clapperboard,
  GitBranch,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import DebatePreview from "@/components/landing/DebatePreview";
import LogoCloud from "@/components/ui/logo-cloud-15";
import CanvasMock from "@/components/landing/CanvasMock";
import ScreenplayShowcase from "@/components/landing/ScreenplayShowcase";
import Reveal, { SectionHeading } from "@/components/landing/Reveal";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import VapourAccent from "@/components/landing/VapourAccent";
import DemoModeButton from "@/components/landing/DemoModeButton";

/**
 * Landing page — themed in the warm rose family (matching the footer), with
 * semantic agent/node colors preserved. Structured like a screenplay: Courier
 * slugline kickers, a live debate in the hero, and a long scroll through the
 * crew, the loop, the canvas, the export, and the realtime room.
 */

const CREW = [
  { emoji: "🏛️", name: "The Architect", role: "Drafter", desc: "Proposes structural beats — turning points, reversals, inciting incidents that branch from your canvas.", accent: "#00F0FF" },
  { emoji: "🎭", name: "Character Lead", role: "Critic", desc: "Judges voice, motivation, and arc. Flags characters acting out of convenience.", accent: "#FF2A6D" },
  { emoji: "🌍", name: "World Builder", role: "Critic", desc: "Checks setting and lore. Rejects beats that break established rules.", accent: "#FFCC00" },
  { emoji: "🧵", name: "Continuity Checker", role: "Critic", desc: "Hunts plot holes and timeline contradictions against everything you've written.", accent: "#05D582" },
  { emoji: "⚡", name: "Tension/Pacing", role: "Critic", desc: "Reads stakes and momentum. Calls out flat, rushed, or repetitive beats.", accent: "#B388FF" },
  { emoji: "⚔️", name: "Devil's Advocate", role: "Gate", desc: "Merges every critique into one verdict — APPROVE, or send it back.", accent: "#FF6B35" },
  { emoji: "✍️", name: "The Reviser", role: "Rewriter", desc: "Rewrites the draft to resolve the room's objections without losing its soul.", accent: "#4FC3F7" },
];

const LOOP = [
  { step: "01", title: "You point", desc: "Click any beat on the canvas and tell the room where to branch.", accent: "#FDA4AF" },
  { step: "02", title: "The Architect drafts", desc: "Two to four new beats, laid out spatially below your story.", accent: "#4FC3F7" },
  { step: "03", title: "Four critics argue", desc: "Character, world, continuity, and tension each weigh in — in parallel.", accent: "#FF2A6D" },
  { step: "04", title: "The Advocate gates", desc: "One verdict. APPROVE and it stands; REJECT and it goes back.", accent: "#FF6B35" },
  { step: "05", title: "You decide", desc: "Accept the survivors, reject the rest. You stay in the director's chair.", accent: "#05D582" },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-wine-950 text-rose-50 overflow-x-hidden font-sans selection:bg-rose-500/30">
      {/* Ambient background — warm rose glows over a wine field */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[15%] w-[560px] h-[560px] bg-rose-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[460px] h-[460px] bg-rose-700/12 rounded-full blur-[120px]" />
        <div className="absolute top-[45%] left-[55%] w-[380px] h-[380px] bg-pink-400/6 rounded-full blur-[110px]" />
        <div className="absolute inset-0 bg-spatial-grid-rose opacity-30 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,#000_20%,transparent_100%)]" />
      </div>

      <div className="relative z-10">
        <Navbar />

        {/* ============ HERO ============ */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
              {/* Courier slugline kicker */}
              <p className="font-script text-[12px] tracking-[0.3em] uppercase text-rose-300 mb-5">
                INT. THE WRITERS&apos; ROOM — NIGHT
              </p>
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-rose-200 border border-rose-400/30 bg-rose-400/5 rounded-full px-3 py-1 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                Powered by IBM Granite
              </span>
              <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-[1.04] tracking-tight mb-6 text-rose-50">
                A writer&apos;s room
                <VapourAccent
                  texts={[
                    "that argues back.",
                    "that pushes further.",
                    "that never settles.",
                  ]}
                />
              </h1>
              <p className="text-lg text-rose-100/60 leading-relaxed max-w-lg mb-9">
                Stop prompting a chatbot and start running a room. Seven specialist
                agents draft, critique, and revise your story on a spatial canvas —
                and you stay in the director&apos;s chair.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/dashboard">
                  <button className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_34px_rgba(244,63,94,0.5)] transition-all">
                    Enter the room
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
                <DemoModeButton />
                <Link href="/room/demo">
                  <button className="px-6 py-3 rounded-full border border-rose-400/30 text-rose-100 font-medium text-sm hover:border-rose-400/60 hover:bg-rose-400/5 transition-colors">
                    Try the live canvas
                  </button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.15 }}
              className="flex justify-center lg:justify-end"
            >
              <DebatePreview />
            </motion.div>
          </div>
        </section>

        {/* ============ TRUSTED BY (logo cloud) ============ */}
        <section className="py-16">
          <LogoCloud />
        </section>

        {/* ============ THE CREW ============ */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-24">
          <Reveal>
            <SectionHeading
              kicker="CAST OF AGENTS"
              accent="#FB7185"
              title={
                <>
                  Seven specialists.
                  <br />
                  One room. Zero yes-men.
                </>
              }
              lede="Most AI writing tools agree with you. This one staffs a room of critics whose job is to find the flaw before your audience does."
            />
          </Reveal>

          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {CREW.map((agent, i) => (
              <Reveal key={agent.name} delay={(i % 3) * 0.08}>
                <div
                  className={`beam-border group relative h-full rounded-xl border bg-wine-900/70 backdrop-blur-md p-6 transition-all duration-300 hover:-translate-y-1 ${
                    i === 0 ? "md:col-span-2 md:row-span-1" : ""
                  }`}
                  style={{ borderColor: `${agent.accent}33`, "--beam-delay": `${-i * 0.9}s` } as React.CSSProperties}
                >
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ background: `radial-gradient(circle at 20% 0%, ${agent.accent}14, transparent 60%)` }}
                  />
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 shrink-0 rounded-lg flex items-center justify-center text-2xl border transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `${agent.accent}16`, borderColor: `${agent.accent}44` }}
                    >
                      {agent.emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display text-lg font-bold text-rose-50">{agent.name}</h3>
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                          style={{ color: agent.accent, borderColor: `${agent.accent}55`, background: `${agent.accent}10` }}
                        >
                          {agent.role}
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-rose-100/60">{agent.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ============ THE LOOP ============ */}
        <section className="border-y border-rose-400/10 bg-wine-900/50">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <Reveal>
              <SectionHeading
                kicker="HOW A SCENE GETS WRITTEN"
                accent="#FF6B35"
                title={
                  <>
                    The debate loop,
                    <br />
                    beat by beat.
                  </>
                }
                lede="Every branch from your canvas runs the same rigorous loop. You watch the whole thing happen — and you get the final vote."
              />
            </Reveal>

            <div className="mt-14 grid md:grid-cols-5 gap-4">
              {LOOP.map((item, i) => (
                <Reveal key={item.step} delay={i * 0.09}>
                  <div
                    className="beam-border group relative h-full rounded-xl border border-rose-400/10 bg-wine-950/80 p-5 hover:border-rose-400/30 transition-colors"
                    style={{ "--beam-delay": `${-i * 1.1}s` } as React.CSSProperties}
                  >
                    <span
                      className="font-script text-3xl font-bold block mb-3 transition-colors"
                      style={{ color: item.accent }}
                    >
                      {item.step}
                    </span>
                    <h3 className="font-display text-[15px] font-bold text-rose-50 mb-2">{item.title}</h3>
                    <p className="text-[12.5px] leading-relaxed text-rose-100/60">{item.desc}</p>
                    {i < LOOP.length - 1 && (
                      <ArrowRight
                        size={16}
                        className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-rose-400/30 group-hover:text-rose-300 transition-colors z-10"
                      />
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============ THE CANVAS ============ */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <Reveal>
              <SectionHeading
                kicker="THE SPATIAL CANVAS"
                accent="#FFCC00"
                title={
                  <>
                    Your story is a map,
                    <br />
                    not a document.
                  </>
                }
                lede="Beats, characters, locations, and notes live as draggable nodes. Connect them with meaning — causes, transitions, features, conflicts — so the structure of your story is visible at a glance."
              />
              <ul className="mt-8 space-y-3">
                {[
                  { icon: GitBranch, text: "Four node types, each with its own color and identity", color: "#00F0FF" },
                  { icon: GitBranch, text: "Semantic edges that say how beats relate, not just that they do", color: "#FFCC00" },
                  { icon: Sparkles, text: "AI suggestions arrive as dashed nodes — accept or reject each one", color: "#05D582" },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3">
                    <f.icon size={17} className="mt-0.5 shrink-0" style={{ color: f.color }} />
                    <span className="text-[14px] text-rose-100/60 leading-relaxed">{f.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.12}>
              <CanvasMock />
            </Reveal>
          </div>
        </section>

        {/* ============ DIRECTOR'S CUT ============ */}
        <section className="border-y border-rose-400/10 bg-wine-900/50">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className="grid lg:grid-cols-2 gap-14 items-center">
              <Reveal className="order-2 lg:order-1">
                <ScreenplayShowcase />
              </Reveal>
              <Reveal delay={0.12} className="order-1 lg:order-2">
                <SectionHeading
                  kicker="DIRECTOR'S CUT"
                  accent="#05D582"
                  title={
                    <>
                      One click from
                      <br />
                      map to screenplay.
                    </>
                  }
                  lede="When the room agrees, compile your graph into a properly formatted Fountain screenplay — sluglines, action, character cues, and dialogue. Download it and hand it to anyone."
                />
                <div className="mt-8 flex items-center gap-3">
                  <Clapperboard size={20} className="text-rose-400" />
                  <span className="font-script text-[13px] tracking-[0.2em] uppercase text-rose-100/60">
                    Exports .fountain · industry-standard
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ============ REALTIME ============ */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <Reveal>
              <SectionHeading
                kicker="THE SHARED ROOM"
                accent="#B388FF"
                title={
                  <>
                    Write together,
                    <br />
                    in real time.
                  </>
                }
                lede="The room is shared. Collaborators see the same canvas, the same debate, the same cursor — synced live and saved the moment it happens. No merge conflicts, no 'final_v2_REAL.docx'."
              />
              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  { icon: Users, label: "Live cursors & presence", color: "#B388FF" },
                  { icon: Radio, label: "Synced debate, shared verdicts", color: "#FDA4AF" },
                  { icon: GitBranch, label: "Persistent rooms that survive reload", color: "#05D582" },
                ].map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-medium"
                    style={{ color: f.color, borderColor: `${f.color}44`, background: `${f.color}0d` }}
                  >
                    <f.icon size={14} />
                    {f.label}
                  </span>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="beam-border relative rounded-2xl border border-rose-400/10 bg-wine-900/70 p-8 overflow-hidden">
                <div className="absolute inset-0 bg-spatial-grid-rose opacity-40" />
                <div className="relative flex items-center justify-center h-48">
                  <motion.div
                    className="absolute"
                    animate={{ x: [0, 60, 20, 0], y: [0, -30, 20, 0] }}
                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <CursorSVG color="#FDA4AF" name="You" />
                  </motion.div>
                  <motion.div
                    className="absolute"
                    animate={{ x: [40, -50, 30, 40], y: [20, 40, -20, 20] }}
                    transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <CursorSVG color="#FF2A6D" name="Sam" />
                  </motion.div>
                  <motion.div
                    className="absolute"
                    animate={{ x: [-60, 30, -20, -60], y: [-20, 10, 40, -20] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <CursorSVG color="#FFCC00" name="Rae" />
                  </motion.div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ TECH STRIP ============ */}
        <section className="border-t border-rose-400/10">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <Reveal>
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {["IBM Granite", "LangGraph", "FastAPI", "Next.js", "React Flow", "Liveblocks"].map((t, i) => (
                  <span key={t} className="flex items-center gap-3">
                    <span className="font-script text-[13px] tracking-[0.2em] uppercase text-rose-100/50 hover:text-rose-200 transition-colors">
                      {t}
                    </span>
                    {i < 5 && <span className="w-1 h-1 rounded-full bg-rose-400/30" />}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ FINAL CTA ============ */}
        <section className="max-w-4xl mx-auto px-6 py-24 text-center">
          <Reveal>
            <p className="font-script text-[12px] tracking-[0.3em] uppercase text-rose-300 mb-4">
              FADE IN:
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.08] mb-5 text-rose-50">
              Your story deserves
              <br />a room that fights for it.
            </h2>
            <p className="text-[15px] text-rose-100/60 max-w-xl mx-auto mb-9">
              Open a room, drop in a premise, and watch seven agents argue your
              first scene into shape.
            </p>
            <Link href="/room/demo">
              <button className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_40px_rgba(244,63,94,0.5)] transition-all">
                Start your first scene
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
          </Reveal>
        </section>

        {/* ============ FOOTER ============ */}
        <Footer />
      </div>
    </main>
  );
}

/** A small labeled cursor SVG for the presence visual. */
function CursorSVG({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex flex-col items-start">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 2 L20 10 L12 12 L10 20 Z"
          fill={color}
          stroke="#12060B"
          strokeWidth="1.5"
        />
      </svg>
      <span
        className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: color, color: "#12060B" }}
      >
        {name}
      </span>
    </div>
  );
}
