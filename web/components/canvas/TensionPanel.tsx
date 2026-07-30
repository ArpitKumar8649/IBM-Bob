"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, Check, Copy, Download, Loader2, RefreshCw, X } from "lucide-react";
import {
  fetchTensionAnalysis,
  PACING_COLOR,
  tensionToMarkdown,
  type TensionAnalysis,
} from "@/lib/analytics";
import { useToast } from "@/components/ui/Toast";

/**
 * TensionPanel — a per-beat dramatic-tension curve with code-derived pacing
 * insights, rendered as hand-rolled SVG (no chart dependency).
 *
 * The curve is drawn over the topologically-ordered beats; the climax
 * candidate is marked, flat "sag" stretches are shaded, and the insights strip
 * below surfaces the structural judgment the backend computed in code (average
 * tension, overall shape, climax position vs the back third, dead zones).
 */

interface TensionPanelProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[];
  storyFacts: { category: string; content: string }[];
}

// SVG geometry (fixed viewBox; the SVG scales to the container width).
const W = 720;
const H = 280;
const PAD_L = 40;
const PAD_R = 18;
const PAD_T = 20;
const PAD_B = 48;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const T_MIN = 1;
const T_MAX = 10;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const xAt = (i: number, n: number) => (n <= 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i / (n - 1)) * PLOT_W);
const yAt = (t: number) => PAD_T + (1 - (clamp(t, T_MIN, T_MAX) - T_MIN) / (T_MAX - T_MIN)) * PLOT_H;
const trunc = (s: string, max = 12) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

export default function TensionPanel({
  open,
  onClose,
  roomId,
  nodes,
  edges,
  storyFacts,
}: TensionPanelProps) {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<TensionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyse = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const result = await fetchTensionAnalysis({ roomId, nodes, edges, storyFacts });
      setAnalysis(result);
      if (result.beats.length === 0) {
        toast("No plot beats to score yet — add some beats first.", "info");
      } else {
        toast("Tension curve generated!", "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Tension analysis failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyMd = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(tensionToMarkdown(analysis));
      toast("Pacing analysis copied", "success");
    } catch {
      toast("Could not copy", "error");
    }
  };

  const downloadMd = () => {
    if (!analysis) return;
    const blob = new Blob([tensionToMarkdown(analysis)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pacing-analysis.md";
    a.click();
    URL.revokeObjectURL(url);
    toast("Pacing analysis downloaded", "success");
  };

  const beats = analysis?.beats ?? [];
  const ins = analysis?.insights;
  const n = beats.length;

  // Build the line + area paths.
  const pts = beats.map((b, i) => ({ x: xAt(i, n), y: yAt(b.tension), i }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath =
    pts.length > 0
      ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD_T + PLOT_H).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD_T + PLOT_H).toFixed(1)} Z`
      : "";

  // Flat-stretch shading rectangle (only when >=3 flat beats in a row).
  const fs = ins?.flat_stretch ?? null;
  let sagRect: { x: number; w: number } | null = null;
  if (fs && n > 0) {
    const x0 = xAt(fs.start_index, n);
    const x1 = xAt(Math.min(fs.start_index + fs.length - 1, n - 1), n);
    sagRect = { x: x0, w: Math.max(x1 - x0, 10) };
  }

  const peakIdx = ins?.peak?.index ?? -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[88vh] bg-wine-950 border border-rose-400/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-400/15 border border-rose-400/30">
                  <Activity size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">Pacing & Tension</h3>
                  <p className="text-[11px] text-rose-100/50">
                    A dramatic-tension curve with structure insights computed in code
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-rose-100/50 hover:text-rose-50 hover:bg-rose-400/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
              {!analysis && !loading && (
                <div className="text-center py-14">
                  <div className="text-5xl mb-4">📈</div>
                  <h4 className="font-display text-lg font-bold text-rose-50 mb-2">
                    See your story&apos;s pulse
                  </h4>
                  <p className="text-rose-100/60 text-[13px] max-w-md mx-auto mb-6">
                    Score the dramatic tension of every beat, then read where the
                    climax lands and where the story sags — judged by the code, not
                    guessed by the model.
                  </p>
                  <button
                    onClick={analyse}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all"
                  >
                    <Activity size={16} /> Analyse pacing
                  </button>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                  <Loader2 size={40} className="animate-spin text-rose-400" />
                  <p className="text-rose-100/60 text-[14px]">Scoring your beats…</p>
                </div>
              )}

              {analysis && (
                <>
                  {n === 0 ? (
                    <p className="text-center text-rose-100/60 text-[13px] py-10">
                      No plot beats to score yet — add some beats to the canvas first.
                    </p>
                  ) : (
                    <>
                      {/* The chart */}
                      <div className="rounded-xl bg-wine-900/50 border border-rose-400/10 p-3">
                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Tension curve">
                          <defs>
                            <linearGradient id="tensionFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0" stopColor="#F43F5E" stopOpacity="0.35" />
                              <stop offset="1" stopColor="#F43F5E" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>

                          {/* y gridlines + labels */}
                          {[1, 5, 10].map((t) => (
                            <g key={t}>
                              <line
                                x1={PAD_L}
                                x2={W - PAD_R}
                                y1={yAt(t)}
                                y2={yAt(t)}
                                stroke="#FB7185"
                                strokeOpacity={0.12}
                                strokeDasharray="3 4"
                              />
                              <text x={PAD_L - 8} y={yAt(t) + 3} textAnchor="end" fontSize="9" fill="#fda4af" fillOpacity={0.6}>
                                {t}
                              </text>
                            </g>
                          ))}

                          {/* flat-stretch (sag) shading */}
                          {sagRect && (
                            <g>
                              <rect
                                x={sagRect.x - 5}
                                y={PAD_T}
                                width={sagRect.w + 10}
                                height={PLOT_H}
                                fill="#FFCC00"
                                fillOpacity={0.1}
                                rx={4}
                              />
                              <text
                                x={sagRect.x + sagRect.w / 2}
                                y={PAD_T + 12}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight={700}
                                fill="#FFCC00"
                                fillOpacity={0.85}
                              >
                                SAG
                              </text>
                            </g>
                          )}

                          {/* area + line */}
                          {areaPath && <path d={areaPath} fill="url(#tensionFill)" />}
                          {linePath && (
                            <path d={linePath} fill="none" stroke="#FB7185" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                          )}

                          {/* beat dots + x labels */}
                          {pts.map((p) => {
                            const b = beats[p.i];
                            const isPeak = p.i === peakIdx;
                            const color = PACING_COLOR[b.pacing];
                            return (
                              <g key={p.i}>
                                {isPeak &&<circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#FF2A6D" strokeOpacity={0.5} strokeWidth={1.5} />}
                                <circle cx={p.x} cy={p.y} r={isPeak ? 5 : 3.5} fill={color} stroke="#12060B" strokeWidth={1.5} />
                                <text
                                  x={p.x}
                                  y={H - PAD_B + 14}
                                  textAnchor="end"
                                  fontSize="8.5"
                                  fill="#fda4af"
                                  fillOpacity={0.7}
                                  transform={`rotate(-35 ${p.x} ${H - PAD_B + 14})`}
                                >
                                  {trunc(b.title)}
                                </text>
                                {isPeak && (
                                  <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#FF2A6D">
                                    CLIMAX
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Insights strip */}
                      {ins && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                          <Stat label="Avg tension" value={`${ins.avg_tension}/10`} />
                          <Stat label="Shape" value={ins.shape} small />
                          <Stat
                            label="Climax"
                            value={
                              ins.climax_position === null
                                ? "—"
                                : `${Math.round(ins.climax_position * 100)}% through`
                            }
                            icon={
                              ins.climax_in_back_third === null ? undefined : ins.climax_in_back_third ? (
                                <Check size={12} className="text-[#05D582]" />
                              ) : (
                                <AlertTriangle size={12} className="text-[#FFCC00]" />
                              )
                            }
                          />
                          <Stat
                            label="Dead zones"
                            value={ins.flat_stretch ? `${ins.flat_stretch.length}-beat sag` : "none"}
                            icon={
                              ins.flat_stretch ? (
                                <AlertTriangle size={12} className="text-[#FFCC00]" />
                              ) : (
                                <Check size={12} className="text-[#05D582]" />
                              )
                            }
                          />
                        </div>
                      )}

                      {/* Legend */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[10px] text-rose-100/50">
                        {(Object.keys(PACING_COLOR) as (keyof typeof PACING_COLOR)[]).map((k) => (
                          <span key={k} className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PACING_COLOR[k] }} />
                            {k}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {analysis && analysis.beats.length > 0 && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rose-400/10">
                <button
                  onClick={analyse}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Re-analyse
                </button>
                <button
                  onClick={copyMd}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors"
                >
                  <Copy size={13} /> Copy
                </button>
                <button
                  onClick={downloadMd}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[12px] font-semibold hover:bg-rose-400 transition-colors"
                >
                  <Download size={13} /> Download
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  small,
  icon,
}: {
  label: string;
  value: string;
  small?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-wine-900/50 border border-rose-400/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-rose-100/45 mb-0.5">{label}</div>
      <div className={`flex items-center gap-1.5 text-rose-50 font-semibold ${small ? "text-[11px] leading-tight" : "text-[14px]"}`}>
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
