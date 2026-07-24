"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Presentation,
  Sparkles,
  X,
} from "lucide-react";
import {
  generatePitch,
  pitchToMarkdown,
  type PitchDeck,
} from "@/lib/pitch";
import { useToast } from "@/components/ui/Toast";

/**
 * PitchDeckPanel — a full-screen modal that generates a producer-ready pitch
 * from the current canvas + story bible and presents it as a slide deck.
 *
 * Slides: Title/Logline → Synopsis → Comps & Genre → Characters → Themes & Hook.
 * Copy to clipboard or download as Markdown.
 */

interface PitchDeckPanelProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[];
  storyFacts: { category: string; content: string }[];
}

export default function PitchDeckPanel({
  open,
  onClose,
  roomId,
  nodes,
  edges,
  storyFacts,
}: PitchDeckPanelProps) {
  const { toast } = useToast();
  const [deck, setDeck] = useState<PitchDeck | null>(null);
  const [loading, setLoading] = useState(false);
  const [slide, setSlide] = useState(0);
  const [notes, setNotes] = useState("");

  const generate = async () => {
    setLoading(true);
    setDeck(null);
    setSlide(0);
    try {
      const result = await generatePitch({
        roomId,
        nodes,
        edges,
        storyFacts,
        notes: notes.trim() || undefined,
      });
      setDeck(result);
      toast("Pitch deck generated!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Pitch generation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!deck) return;
    try {
      await navigator.clipboard.writeText(pitchToMarkdown(deck));
      toast("Pitch copied to clipboard", "success");
    } catch {
      toast("Could not copy", "error");
    }
  };

  const downloadMarkdown = () => {
    if (!deck) return;
    const blob = new Blob([pitchToMarkdown(deck)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-pitch.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Pitch downloaded", "success");
  };

  const totalSlides = deck ? 5 : 0;

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
            className="relative w-full max-w-4xl h-[85vh] bg-wine-950 border border-rose-400/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-400/15 border border-rose-400/30">
                  <Presentation size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    Pitch Deck Generator
                  </h3>
                  <p className="text-[11px] text-rose-100/50">
                    Turn your story into a sellable pitch
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
            <div className="flex-1 overflow-hidden flex flex-col">
              {!deck && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                  <div className="text-5xl mb-4">🎬</div>
                  <h4 className="font-display text-xl font-bold text-rose-50 mb-2">
                    Ready to pitch your story?
                  </h4>
                  <p className="text-rose-100/60 text-[13px] max-w-md mb-6">
                    The AI will synthesize your canvas and story bible into a
                    professional pitch: logline, synopsis, comparable titles,
                    character bios, and themes.
                  </p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional: any guidance for the pitch (target audience, tone, etc.)"
                    className="w-full max-w-md resize-none rounded-xl bg-wine-800 border border-rose-400/15 px-4 py-3 text-[13px] text-rose-50 placeholder:text-rose-100/30 outline-none focus:border-rose-400/40 mb-4 custom-scrollbar"
                  />
                  <button
                    onClick={generate}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all"
                  >
                    <Sparkles size={16} />
                    Generate Pitch Deck
                  </button>
                </div>
              )}

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <Loader2 size={40} className="animate-spin text-rose-400" />
                  <p className="text-rose-100/60 text-[14px]">
                    Crafting your pitch…
                  </p>
                </div>
              )}

              {deck && (
                <>
                  {/* Slide content */}
                  <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={slide}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                      >
                        {slide === 0 && (
                          <div className="text-center">
                            <p className="text-rose-400 text-[11px] uppercase tracking-[0.3em] mb-4">
                              {deck.genre} · {deck.tone}
                            </p>
                            <h2 className="font-display text-4xl md:text-5xl font-extrabold text-rose-50 mb-6">
                              {deck.title}
                            </h2>
                            <div className="max-w-2xl mx-auto">
                              <p className="text-rose-300 text-[11px] uppercase tracking-widest mb-2">
                                Logline
                              </p>
                              <p className="text-rose-100/80 text-lg leading-relaxed italic">
                                "{deck.logline}"
                              </p>
                            </div>
                          </div>
                        )}

                        {slide === 1 && (
                          <div>
                            <h3 className="font-display text-2xl font-bold text-rose-50 mb-4">
                              Synopsis
                            </h3>
                            <p className="text-rose-100/70 text-[15px] leading-relaxed">
                              {deck.synopsis}
                            </p>
                          </div>
                        )}

                        {slide === 2 && (
                          <div>
                            <h3 className="font-display text-2xl font-bold text-rose-50 mb-4">
                              Comparable Titles
                            </h3>
                            <div className="space-y-3">
                              {deck.comparable_titles.map((comp, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 rounded-xl bg-wine-800 border border-rose-400/10 px-5 py-4"
                                >
                                  <span className="text-2xl">🎯</span>
                                  <span className="text-rose-50 text-[15px] font-medium">
                                    {comp}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {slide === 3 && (
                          <div>
                            <h3 className="font-display text-2xl font-bold text-rose-50 mb-4">
                              Characters
                            </h3>
                            <div className="space-y-4">
                              {deck.characters.map((char, i) => (
                                <div
                                  key={i}
                                  className="rounded-xl bg-wine-800 border border-rose-400/10 px-5 py-4"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">🎭</span>
                                    <h4 className="font-display text-lg font-bold text-rose-50">
                                      {char.name}
                                    </h4>
                                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-300 border border-rose-400/30">
                                      {char.role}
                                    </span>
                                  </div>
                                  <p className="text-rose-100/70 text-[13px] leading-relaxed">
                                    {char.bio}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {slide === 4 && (
                          <div>
                            <h3 className="font-display text-2xl font-bold text-rose-50 mb-4">
                              Themes & The Hook
                            </h3>
                            <div className="mb-6">
                              <p className="text-rose-300 text-[11px] uppercase tracking-widest mb-3">
                                Central Themes
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {deck.themes.map((theme, i) => (
                                  <span
                                    key={i}
                                    className="px-4 py-2 rounded-full bg-wine-800 border border-rose-400/20 text-rose-50 text-[13px] font-medium"
                                  >
                                    {theme}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl bg-gradient-to-br from-rose-500/10 to-wine-800 border border-rose-400/20 px-6 py-5">
                              <p className="text-rose-300 text-[11px] uppercase tracking-widest mb-2">
                                The Hook
                              </p>
                              <p className="text-rose-50 text-lg leading-relaxed font-medium">
                                {deck.hook}
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Slide navigation */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-rose-400/10">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSlide(Math.max(0, slide - 1))}
                        disabled={slide === 0}
                        className="p-2 rounded-lg text-rose-100/60 hover:text-rose-50 hover:bg-rose-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span className="text-rose-100/60 text-[13px] font-medium min-w-[60px] text-center">
                        {slide + 1} / {totalSlides}
                      </span>
                      <button
                        onClick={() => setSlide(Math.min(totalSlides - 1, slide + 1))}
                        disabled={slide === totalSlides - 1}
                        className="p-2 rounded-lg text-rose-100/60 hover:text-rose-50 hover:bg-rose-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyMarkdown}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 hover:text-rose-50 transition-colors"
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                      <button
                        onClick={downloadMarkdown}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500 text-white text-[12px] font-semibold hover:bg-rose-400 transition-colors"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
