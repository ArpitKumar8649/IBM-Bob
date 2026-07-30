"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, FileCheck2, Loader2, RefreshCw, X } from "lucide-react";
import {
  coverageToMarkdown,
  generateCoverage,
  VERDICT_COLOR,
  type CoverageReport,
} from "@/lib/coverage";
import { useToast } from "@/components/ui/Toast";

/**
 * CoveragePanel — full-screen modal that generates a professional script-reader's
 * coverage report from the current canvas + story bible.
 *
 * Renders the verdict as a big colored badge, the overall score as a /10 meter,
 * then strengths / weaknesses / plot holes / character notes / structure /
 * marketability. Copy to clipboard or download as Markdown.
 */

interface CoveragePanelProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[];
  storyFacts: { category: string; content: string }[];
}

export default function CoveragePanel({
  open,
  onClose,
  roomId,
  nodes,
  edges,
  storyFacts,
}: CoveragePanelProps) {
  const { toast } = useToast();
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setReport(null);
    try {
      const result = await generateCoverage({ roomId, nodes, edges, storyFacts });
      setReport(result);
      toast("Coverage report generated!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Coverage generation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(coverageToMarkdown(report));
      toast("Coverage copied to clipboard", "success");
    } catch {
      toast("Could not copy", "error");
    }
  };

  const downloadMarkdown = () => {
    if (!report) return;
    const blob = new Blob([coverageToMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coverage-report.md";
    a.click();
    URL.revokeObjectURL(url);
    toast("Coverage downloaded", "success");
  };

  const verdictColor = report ? VERDICT_COLOR[report.verdict] : "#FB7185";

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
            className="relative w-full max-w-3xl h-[85vh] bg-wine-950 border border-rose-400/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-400/15 border border-rose-400/30">
                  <FileCheck2 size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    Coverage Report
                  </h3>
                  <p className="text-[11px] text-rose-100/50">
                    A professional reader&apos;s verdict on your story
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
              {/* Empty state */}
              {!report && !loading && (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📝</div>
                  <h4 className="font-display text-lg font-bold text-rose-50 mb-2">
                    Get professional coverage
                  </h4>
                  <p className="text-rose-100/60 text-[13px] max-w-md mx-auto mb-6">
                    An AI script reader evaluates your story the way a studio
                    coverage service would — verdict, score, strengths,
                    weaknesses, plot holes, and notes on every character.
                  </p>
                  <button
                    onClick={generate}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all"
                  >
                    <FileCheck2 size={16} />
                    Generate Coverage
                  </button>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                  <Loader2 size={40} className="animate-spin text-rose-400" />
                  <p className="text-rose-100/60 text-[14px]">
                    The reader is going through your story…
                  </p>
                </div>
              )}

              {/* Result */}
              {report && (
                <div>
                  {/* Verdict + score header */}
                  <div className="flex items-center justify-between gap-4 mb-5 rounded-xl bg-wine-800/60 border border-rose-400/10 p-4">
                    <div
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-display font-bold text-lg"
                      style={{ background: verdictColor }}
                    >
                      {report.verdict}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] uppercase tracking-widest text-rose-100/50">
                          Overall score
                        </span>
                        <span className="font-display font-bold text-rose-50">
                          {report.overall_score}
                          <span className="text-rose-100/40 text-sm">/10</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-wine-950 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${report.overall_score * 10}%`,
                            background: verdictColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logline + premise */}
                  <p className="text-rose-50 text-[15px] italic leading-relaxed mb-4">
                    &ldquo;{report.logline}&rdquo;
                  </p>
                  <p className="text-rose-100/70 text-[13px] leading-relaxed mb-6">
                    {report.premise}
                  </p>

                  {/* Strengths / weaknesses */}
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    <Section title="Strengths" color="#05D582" items={report.strengths} />
                    <Section title="Weaknesses" color="#FFCC00" items={report.weaknesses} />
                  </div>

                  {/* Plot holes */}
                  <div className="mb-6">
                    <h5 className="text-rose-300 text-[11px] uppercase tracking-widest mb-2">
                      Plot Holes / Continuity
                    </h5>
                    {report.plot_holes.length === 0 ? (
                      <p className="text-rose-100/50 text-[13px]">
                        None detected in the material provided.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {report.plot_holes.map((p, i) => (
                          <li key={i} className="flex gap-2 text-[13px] text-rose-100/70">
                            <span className="text-[#FF2A6D] shrink-0">⚠</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Character notes */}
                  {report.character_notes.length > 0 && (
                    <div className="mb-6">
                      <h5 className="text-rose-300 text-[11px] uppercase tracking-widest mb-2">
                        Character Notes
                      </h5>
                      <div className="space-y-2">
                        {report.character_notes.map((c, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-wine-800/60 border border-rose-400/10 px-3 py-2"
                          >
                            <span className="font-display font-bold text-rose-50 text-[13px]">
                              {c.name}
                            </span>
                            <span className="text-rose-100/60 text-[13px]"> — {c.note}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structure + marketability */}
                  <div className="grid sm:grid-cols-2 gap-4 mb-2">
                    <div>
                      <h5 className="text-rose-300 text-[11px] uppercase tracking-widest mb-2">
                        Structure
                      </h5>
                      <p className="text-rose-100/70 text-[13px] leading-relaxed">
                        {report.structure_note}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-rose-300 text-[11px] uppercase tracking-widest mb-2">
                        Marketability
                      </h5>
                      <p className="text-rose-100/70 text-[13px] leading-relaxed">
                        {report.marketability}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            {report && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rose-400/10">
                <button
                  onClick={generate}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Regenerate
                </button>
                <button
                  onClick={copyMarkdown}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors"
                >
                  <Copy size={13} /> Copy
                </button>
                <button
                  onClick={downloadMarkdown}
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

function Section({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div>
      <h5
        className="text-[11px] uppercase tracking-widest mb-2"
        style={{ color }}
      >
        {title}
      </h5>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-rose-100/70">
            <span style={{ color }} className="shrink-0">
              •
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
