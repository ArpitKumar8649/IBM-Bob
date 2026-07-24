"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  Clock,
  Compass,
  FileText,
  Flame,
  Map,
  Plus,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Reveal, { SectionHeading } from "@/components/landing/Reveal";
import VapourAccent from "@/components/landing/VapourAccent";

/**
 * Dashboard — the writer's command center. A rich, warm rose-themed overview:
 * greeting, live stats, a featured "continue" room with a mini canvas preview,
 * the room library, story templates, the agent crew, and a live activity feed.
 */

const STATS = [
  { icon: BookOpen, label: "Rooms", value: "4", trend: "+1 this week", color: "#FDA4AF" },
  { icon: FileText, label: "Beats written", value: "128", trend: "+23 today", color: "#FFCC00" },
  { icon: Swords, label: "Debates run", value: "342", trend: "7 pending review", color: "#FF2A6D" },
  { icon: Users, label: "Collaborators", value: "6", trend: "3 online now", color: "#05D582" },
];

const FEATURED = {
  id: "cyberpunk-heist",
  title: "Cyberpunk Heist",
  desc: "A high-stakes data extraction run in the neon-lit streets of Neo-Tokyo.",
  progress: 68,
  beats: 42,
  lastEdited: "2 hours ago",
  color: "#FF2A6D",
};

const ROOMS = [
  { id: "cyberpunk-heist", title: "Cyberpunk Heist", desc: "A high-stakes data extraction run in the neon-lit streets of Neo-Tokyo.", lastEdited: "2 hours ago", beats: 42, color: "#FF2A6D", status: "active" },
  { id: "fantasy-epic", title: "Fantasy Epic", desc: "The ancient dragons have returned to the shivering peaks of Eldoria.", lastEdited: "1 day ago", beats: 31, color: "#B388FF", status: "active" },
  { id: "space-opera", title: "Space Opera", desc: "Intergalactic diplomacy falls apart as the Galactic Senate collapses.", lastEdited: "3 days ago", beats: 27, color: "#FFCC00", status: "draft" },
  { id: "murder-mystery", title: "Murder Mystery", desc: "A secluded manor, a dead billionaire, and twelve suspects with motives.", lastEdited: "1 week ago", beats: 28, color: "#05D582", status: "draft" },
];

const TEMPLATES = [
  { icon: Compass, name: "Hero's Journey", desc: "12 beats from the ordinary world to the return with the elixir.", color: "#FDA4AF" },
  { icon: Swords, name: "Mystery", desc: "Crime, clues, red herrings, and a reveal that earns its twist.", color: "#FF2A6D" },
  { icon: Flame, name: "Thriller", desc: "Ticking clocks and escalating stakes from cold open to climax.", color: "#FF6B35" },
  { icon: Sparkles, name: "Romance", desc: "Meet-cute to grand gesture, with the beats that make hearts race.", color: "#FFCC00" },
  { icon: Map, name: "Worldbuilding", desc: "Lore, factions, and rules before a single scene is written.", color: "#05D582" },
];

const CREW = [
  { emoji: "🏛️", name: "Architect", role: "Drafter", color: "#00F0FF" },
  { emoji: "🎭", name: "Character", role: "Critic", color: "#FF2A6D" },
  { emoji: "🌍", name: "World", role: "Critic", color: "#FFCC00" },
  { emoji: "🧵", name: "Continuity", role: "Critic", color: "#05D582" },
  { emoji: "⚡", name: "Tension", role: "Critic", color: "#B388FF" },
  { emoji: "⚔️", name: "Advocate", role: "Gate", color: "#FF6B35" },
  { emoji: "✍️", name: "Reviser", role: "Rewriter", color: "#4FC3F7" },
];

const ACTIVITY = [
  { actor: "🎭 Character", action: "rejected a beat in", target: "Cyberpunk Heist", note: "voice drift", time: "4m", color: "#FF2A6D" },
  { actor: "⚔️ Advocate", action: "approved a draft in", target: "Fantasy Epic", note: "all clear", time: "18m", color: "#FF6B35" },
  { actor: "🏛️ Architect", action: "drafted 3 beats in", target: "Space Opera", note: "new branch", time: "1h", color: "#00F0FF" },
  { actor: "🧵 Continuity", action: "flagged a plot hole in", target: "Murder Mystery", note: "timeline", time: "3h", color: "#05D582" },
  { actor: "✍️ Reviser", action: "rewrote a scene in", target: "Cyberpunk Heist", note: "resolved", time: "5h", color: "#4FC3F7" },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-wine-950 text-rose-50 font-sans selection:bg-rose-500/30 overflow-x-hidden relative">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[10%] w-[480px] h-[480px] bg-rose-500/8 rounded-full blur-[130px]" />
        <div className="absolute bottom-[5%] right-[8%] w-[420px] h-[420px] bg-rose-700/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-spatial-grid-rose opacity-20 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,#000_20%,transparent_100%)]" />
      </div>

      <div className="relative z-10">
        <Navbar />

        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* ===== Greeting + new room ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10"
          >
            <div>
              <p className="font-script text-[12px] tracking-[0.3em] uppercase text-rose-300 mb-2">
                FADE IN:
              </p>
              <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05]">
                Welcome back,
                <VapourAccent
                  texts={["Writer.", "Storyteller.", "Worldbuilder.", "Director."]}
                />
              </h1>
              <p className="mt-3 text-rose-100/60 text-[15px] max-w-xl">
                Pick up a room where you left off, or open a fresh one and let the
                crew argue your next scene into shape.
              </p>
            </div>
            <Link href="/room/demo">
              <button className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all whitespace-nowrap">
                <Plus size={16} />
                New room
              </button>
            </Link>
          </motion.div>

          {/* ===== Stats strip ===== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.06}>
                <div
                  className="beam-border rounded-xl border border-rose-400/10 bg-wine-900/70 backdrop-blur-md p-5 hover:border-rose-400/25 transition-colors"
                  style={{ "--beam-delay": `${-i * 1.4}s` } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: `${s.color}16`, border: `1px solid ${s.color}44` }}
                    >
                      <s.icon size={17} style={{ color: s.color }} />
                    </div>
                    <TrendingUp size={14} className="text-rose-400/50" />
                  </div>
                  <div className="font-display text-3xl font-extrabold text-rose-50">{s.value}</div>
                  <div className="text-[12px] text-rose-100/50 mt-0.5">{s.label}</div>
                  <div className="text-[11px] mt-2 font-medium" style={{ color: s.color }}>
                    {s.trend}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* ===== Featured: continue where you left off ===== */}
          <Reveal>
            <div className="beam-border relative rounded-2xl border border-rose-400/15 bg-wine-900/70 backdrop-blur-md overflow-hidden mb-14">
              {/* glow */}
              <div
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-[90px] pointer-events-none"
                style={{ background: `${FEATURED.color}22` }}
              />
              <div className="relative grid md:grid-cols-2 gap-8 p-8">
                <div className="flex flex-col justify-center">
                  <span className="inline-flex items-center gap-2 w-fit text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full border mb-4"
                    style={{ color: FEATURED.color, borderColor: `${FEATURED.color}55`, background: `${FEATURED.color}12` }}>
                    <Clock size={11} /> Continue where you left off
                  </span>
                  <h2 className="font-display text-3xl font-extrabold text-rose-50 mb-2">{FEATURED.title}</h2>
                  <p className="text-[14px] text-rose-100/60 leading-relaxed mb-6 max-w-md">{FEATURED.desc}</p>

                  {/* progress */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-[12px] mb-2">
                     <span className="text-rose-100/60">{FEATURED.beats} beats · edited {FEATURED.lastEdited}</span>
                      <span className="font-semibold" style={{ color: FEATURED.color }}>{FEATURED.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-wine-950 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${FEATURED.color}, #FDA4AF)` }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${FEATURED.progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <Link href={`/room/${FEATURED.id}`}>
                   <button className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_24px_rgba(244,63,94,0.5)] transition-all">
                      Reopen room
                      <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </Link>
                </div>

                {/* Mini canvas preview */}
                <div className="relative rounded-xl border border-rose-400/10 bg-wine-950/80 overflow-hidden min-h-[220px]">
                  <div className="absolute inset-0 bg-spatial-grid-rose opacity-50" />
                  <svg viewBox="0 0 400 240" className="relative w-full h-full">
                    {/* edges */}
                    <path d="M110 60 C 160 60, 170 110, 200 110" fill="none" stroke="#FFCC00" strokeWidth={1.5} strokeOpacity={0.7} />
                    <path d="M110 60 C 110 110, 110 130, 110 150" fill="none" stroke="#8E8E93" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.7} />
                    <path d="M200 110 C 250 110, 260 150, 290 150" fill="none" stroke="#FF2A6D" strokeWidth={1.5} strokeDasharray="3 4" strokeOpacity={0.7} />
                    {/* nodes */}
                    <MiniNode x={40} y={40} color="#00F0FF" label="BEAT" />
                    <MiniNode x={200} y={92} color="#FF2A6D" label="CHAR" />
                    <MiniNode x={40} y={150} color="#FFCC00" label="LOC" />
                    <MiniNode x={290} y={150} color="#05D582" label="NOTE" dashed />
                  </svg>
                  <span className="absolute bottom-3 right-3 text-[10px] font-mono text-rose-100/40">
                    live canvas preview
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ===== Your rooms ===== */}
          <div className="flex items-end justify-between mb-8">
            <SectionHeading kicker="YOUR LIBRARY" accent="#FDA4AF" title="Recent rooms" />
            <span className="text-[13px] text-rose-100/50 hidden md:block">{ROOMS.length} rooms</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
            {ROOMS.map((room, i) => (
              <Reveal key={room.id} delay={(i % 4) * 0.07}>
                <Link href={`/room/${room.id}`} className="block group h-full">
                  <div
                    className="beam-border relative h-full rounded-xl border border-rose-400/10 bg-wine-900/70 backdrop-blur-md overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-rose-400/30"
                    style={{ "--beam-delay": `${-i * 1.2}s` } as React.CSSProperties}
                  >
                    {/* gradient cover */}
                    <div className="h-24 relative overflow-hidden">
                      <div
                        className="absolute inset-0"
                        style={{ background: `linear-gradient(135deg, ${room.color}33, transparent 70%)` }}
                      />
                      <div className="absolute inset-0 bg-spatial-grid-rose opacity-40" />
                      <div
                        className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                        style={{
                          color: room.status === "active" ? "#05D582" : "#FDA4AF",
                          borderColor: room.status === "active" ? "#05D58255" : "#FDA4AF55",
                          background: room.status === "active" ? "#05D58212" : "#FDA4AF12",
                        }}
                      >
                        {room.status}
                      </div>
                      <div
                        className="absolute bottom-3 left-4 w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-lg border"
                        style={{ background: `${room.color}1f`, borderColor: `${room.color}55`, color: room.color }}
                      >
                        {room.title.charAt(0)}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-display text-[16px] font-bold text-rose-50 mb-1.5 group-hover:text-white transition-colors">
                        {room.title}
                      </h3>
                      <p className="text-[12.5px] text-rose-100/55 leading-relaxed line-clamp-2 mb-4 min-h-[36px]">
                        {room.desc}
                      </p>
                      <div className="flex items-center justify-between pt-3 border-t border-rose-400/10">
                        <span className="text-[11px] text-rose-100/45">{room.beats} beats · {room.lastEdited}</span>
                        <ArrowUpRight size={15} className="text-rose-400/50 group-hover:text-rose-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          {/* ===== Story templates ===== */}
          <Reveal>
            <SectionHeading
              kicker="START FROM A STRUCTURE"
              accent="#FFCC00"
              title="Story templates"
              lede="Don't start from a blank page. Pick a proven structure and let the Architect lay down the opening beats."
            />
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-10 mb-16">
            {TEMPLATES.map((t, i) => (
              <Reveal key={t.name} delay={(i % 5) * 0.06}>
                <Link href="/room/demo" className="block group h-full">
                  <div
                    className="beam-border h-full rounded-xl border border-rose-400/10 bg-wine-900/60 p-5 hover:border-rose-400/30 hover:-translate-y-1 transition-all duration-300"
                    style={{ "--beam-delay": `${-i * 1.3}s` } as React.CSSProperties}
                  >
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                      style={{ background: `${t.color}16`, border: `1px solid ${t.color}44` }}
                    >
                      <t.icon size={20} style={{ color: t.color }} />
                    </div>
                    <h3 className="font-display text-[15px] font-bold text-rose-50 mb-1.5">{t.name}</h3>
                    <p className="text-[12px] text-rose-100/55 leading-relaxed">{t.desc}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          {/* ===== Crew + activity (two columns) ===== */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Crew */}
            <Reveal>
              <div className="beam-border rounded-2xl border border-rose-400/10 bg-wine-900/70 backdrop-blur-md p-6 h-full">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display text-lg font-bold text-rose-50">Your agent crew</h3>
                  <span className="text-[11px] text-rose-100/45">7 specialists</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {CREW.map((a) => (
                    <div
                      key={a.name}
                      className="flex items-center gap-3 rounded-lg border border-rose-400/10 bg-wine-950/60 px-3 py-2.5 hover:border-rose-400/25 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{ background: `${a.color}16`, border: `1px solid ${a.color}44` }}
                      >
                        {a.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-rose-50 truncate">{a.name}</div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: a.color }}>
                          {a.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Activity feed */}
            <Reveal delay={0.1}>
              <div className="beam-border rounded-2xl border border-rose-400/10 bg-wine-900/70 backdrop-blur-md p-6 h-full">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display text-lg font-bold text-rose-50">Room activity</h3>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-rose-100/45">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> live
                  </span>
                </div>
                <ul className="space-y-1">
                  {ACTIVITY.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-wine-950/50 transition-colors"
                    >
                      <span
                        className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                        style={{ background: a.color, boxShadow: `0 0 8px ${a.color}88` }}
                      />
                      <p className="text-[13px] leading-snug text-rose-100/70 flex-1">
                        <span className="font-semibold text-rose-50">{a.actor}</span>{" "}
                        {a.action}{" "}
                        <span className="text-rose-300">{a.target}</span>
                        <span className="text-rose-100/40"> · {a.note}</span>
                      </p>
                      <span className="text-[11px] text-rose-100/40 shrink-0">{a.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </main>
      </div>
    </div>
  );
}

/** A small node for the featured-room mini canvas preview. */
function MiniNode({
  x,
  y,
  color,
  label,
  dashed,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={70}
        height={36}
        rx={8}
        fill="#1D0D14"
        stroke={color}
        strokeOpacity={dashed ? 0.6 : 0.4}
        strokeWidth={1.3}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <text x={x + 8} y={y + 22} fontSize={9} fontWeight={700} letterSpacing={1} fill={color}>
        {label}
      </text>
    </g>
  );
}
