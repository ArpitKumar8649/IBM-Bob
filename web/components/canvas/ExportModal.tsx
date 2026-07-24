"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clapperboard, Download, FileText, FileCode, FileType2, X } from "lucide-react";
import {
  buildScreenplayModel,
  exportScreenplay,
  type ExportFormat,
} from "@/lib/export";
import type { StoryEdge, StoryNode } from "@/lib/canvas-types";
import { useToast } from "@/components/ui/Toast";

/**
 * ExportModal — the Director's Cut export hub. Compiles the canvas into a
 * screenplay and lets the writer download it as Fountain, PDF, Final Draft
 * (.fdx), or plain text — all industry-standard formats.
 */

const FORMATS: {
  key: ExportFormat;
  label: string;
  desc: string;
  ext: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    key: "pdf",
    label: "PDF Screenplay",
    desc: "Industry-standard layout — Courier 12pt, US Letter, proper margins.",
    ext: ".pdf",
    icon: FileType2,
    color: "#FF2A6D",
  },
  {
    key: "fountain",
    label: "Fountain",
    desc: "Plain-text markup that renders to screenplay in any Fountain tool.",
    ext: ".fountain",
    icon: FileText,
    color: "#00F0FF",
  },
  {
    key: "fdx",
    label: "Final Draft",
    desc: "Native .fdx XML — opens directly in Final Draft software.",
    ext: ".fdx",
    icon: FileCode,
    color: "#FFCC00",
  },
  {
    key: "text",
    label: "Plain Text",
    desc: "Simple readable text for quick sharing or pasting anywhere.",
    ext: ".txt",
    icon: FileText,
    color: "#05D582",
  },
];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  nodes: StoryNode[];
  edges: StoryEdge[];
  title?: string;
}

export default function ExportModal({
  open,
  onClose,
  nodes,
  edges,
  title = "Untitled Story",
}: ExportModalProps) {
  const { toast } = useToast();
  const [storyTitle, setStoryTitle] = useState(title);

  const handleExport = (format: ExportFormat) => {
    if (nodes.length === 0) {
      toast("Nothing to export — add some beats first.", "info");
      return;
    }
    try {
      const model = buildScreenplayModel(nodes, edges, storyTitle.trim() || "Untitled Story");
      exportScreenplay(model, format);
      const fmt = FORMATS.find((f) => f.key === format);
      toast(`Exported as ${fmt?.label}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    }
  };

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
            className="relative w-full max-w-lg bg-wine-950 border border-rose-400/20 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-400/15 border border-rose-400/30">
                  <Clapperboard size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    Director&apos;s Cut
                  </h3>
                  <p className="text-[11px] text-rose-100/50">
                    Export your story as a screenplay
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
            <div className="px-6 py-5">
              <label className="block text-[11px] uppercase tracking-widest text-rose-100/50 mb-2">
                Story title
              </label>
              <input
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                placeholder="Untitled Story"
                className="w-full rounded-xl bg-wine-800 border border-rose-400/15 px-4 py-2.5 text-[14px] text-rose-50 placeholder:text-rose-100/30 outline-none focus:border-rose-400/40 mb-5"
              />

              <p className="text-[11px] uppercase tracking-widest text-rose-100/50 mb-3">
                Choose a format
              </p>
              <div className="space-y-2.5">
                {FORMATS.map((fmt) => {
                  const Icon = fmt.icon;
                  return (
                    <button
                      key={fmt.key}
                      onClick={() => handleExport(fmt.key)}
                      className="group w-full flex items-center gap-4 rounded-xl bg-wine-800 border border-rose-400/10 px-4 py-3.5 text-left hover:border-rose-400/40 transition-all"
                    >
                      <span
                        className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center border"
                        style={{ background: `${fmt.color}18`, borderColor: `${fmt.color}44` }}
                      >
                        <Icon size={18} style={{ color: fmt.color }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-rose-50 text-[14px]">
                            {fmt.label}
                          </span>
                          <span className="text-[10px] font-mono text-rose-100/40">
                            {fmt.ext}
                          </span>
                        </div>
                        <p className="text-[12px] text-rose-100/55 leading-snug mt-0.5">
                          {fmt.desc}
                        </p>
                      </div>
                      <Download
                        size={16}
                        className="shrink-0 text-rose-100/30 group-hover:text-rose-300 transition-colors"
                      />
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-rose-100/40 text-center mt-4">
                {nodes.length} node{nodes.length !== 1 ? "s" : ""} · compiled in
                topological order
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
