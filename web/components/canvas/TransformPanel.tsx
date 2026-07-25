"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Loader2, Palette, X } from "lucide-react";
import { streamToneTransform, TONE_OPTIONS } from "@/lib/breakdown";
import { useToast } from "@/components/ui/Toast";

/**
 * TransformPanel — rewrite a story node in a different tone/genre.
 *
 * The writer picks a tone, the AI streams a rewrite that preserves plot facts
 * while transforming voice and mood. The result can be copied or applied
 * back to the node.
 */

interface TransformPanelProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeTitle: string;
  nodeContent: string;
  storyFacts: { category: string; content: string }[];
  onApply: (newContent: string) => void;
}

export default function TransformPanel({
  open,
  onClose,
  nodeId,
  nodeTitle,
  nodeContent,
  storyFacts,
  onApply,
}: TransformPanelProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [applied, setApplied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const startTransform = async (selectedTone: string) => {
    if (streaming) return;
    setTone(selectedTone);
    setOutput("");
    setApplied(false);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamToneTransform({
      content: nodeContent,
      title: nodeTitle,
      tone: selectedTone,
      storyFacts,
      signal: controller.signal,
      onToken: (text) => {
        setOutput((prev) => prev + text);
        // Auto-scroll to bottom
        requestAnimationFrame(() => {
          outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
        });
      },
      onDone: () => setStreaming(false),
      onError: (msg) => {
        setOutput((prev) => prev + `\n\n⚠️ ${msg}`);
        setStreaming(false);
        toast(msg, "error");
      },
    });
  };

  const handleApply = () => {
    if (!output.trim()) return;
    onApply(output.trim());
    setApplied(true);
    toast("Applied to node!", "success");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast("Copied to clipboard", "success");
    } catch {
      toast("Could not copy", "error");
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setStreaming(false);
    onClose();
  };

  const selectedToneMeta = TONE_OPTIONS.find((t) => t.key === tone);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl h-[80vh] bg-wine-950 border border-rose-400/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-400/15 border border-rose-400/30">
                  <Palette size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    Tone Transfer
                  </h3>
                  <p className="text-[11px] text-rose-100/50 truncate max-w-[280px]">
                    {nodeTitle || "Untitled node"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-rose-100/50 hover:text-rose-50 hover:bg-rose-400/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
              {/* Tone picker */}
              {!output && !streaming && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-rose-100/50 mb-3">
                    Choose a tone
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => startTransform(t.key)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-wine-800 border border-rose-400/10 hover:border-rose-400/40 hover:bg-wine-700 transition-all text-left group"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">
                          {t.emoji}
                        </span>
                        <span className="text-[13px] font-medium text-rose-50 group-hover:text-rose-200 transition-colors">
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Original content preview */}
                  <div className="mt-6 rounded-xl bg-wine-800/60 border border-rose-400/10 p-4">
                    <p className="text-[11px] uppercase tracking-widest text-rose-100/40 mb-2">
                      Original
                    </p>
                    <p className="text-[13px] text-rose-100/60 leading-relaxed whitespace-pre-wrap">
                      {nodeContent}
                    </p>
                  </div>
                </div>
              )}

              {/* Streaming output */}
              {(output || streaming) && (
                <div>
                  {selectedToneMeta && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">{selectedToneMeta.emoji}</span>
                      <span className="text-[13px] font-semibold text-rose-300">
                        {selectedToneMeta.label} rewrite
                      </span>
                      {streaming && (
                        <Loader2 size={14} className="animate-spin text-rose-400" />
                      )}
                    </div>
                  )}
                  <div
                    ref={outputRef}
                    className="rounded-xl bg-wine-800/60 border border-rose-400/10 p-4 max-h-[45vh] overflow-y-auto custom-scrollbar"
                  >
                    <p className="text-[14px] text-rose-50 leading-relaxed whitespace-pre-wrap font-serif">
                      {output}
                      {streaming && (
                        <span className="inline-block w-2 h-4 bg-rose-400 animate-pulse ml-0.5 align-middle" />
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  {!streaming && output && (
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={handleApply}
                        disabled={applied}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500 text-white text-[12px] font-semibold hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {applied ? (
                          <>
                            <Check size={13} /> Applied
                          </>
                        ) : (
                          <>
                            <Check size={13} /> Apply to node
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors"
                      >
                        <Copy size={13} /> Copy
                      </button>
                      <button
                        onClick={() => {
                          setOutput("");
                          setTone(null);
                          setApplied(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors"
                      >
                        Try another tone
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
