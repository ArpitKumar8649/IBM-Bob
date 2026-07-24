"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Plus, Trash2, X, Loader2 } from "lucide-react";
import {
  listFacts,
  addFact,
  deleteFact,
  type FactCategory,
  type StoryFact,
} from "@/lib/bible";

/**
 * StoryBiblePanel — a slide-out panel showing the room's established world
 * knowledge (characters, locations, lore, rules, events). Writers can add and
 * delete facts; every agent retrieves these via RAG so the world stays
 * consistent.
 */

const CATEGORIES: { key: FactCategory; label: string; emoji: string; color: string }[] = [
  { key: "character", label: "Characters", emoji: "🎭", color: "#FF2A6D" },
  { key: "location", label: "Locations", emoji: "🌍", color: "#FFCC00" },
  { key: "lore", label: "Lore", emoji: "📜", color: "#B388FF" },
  { key: "rule", label: "Rules", emoji: "⚖️", color: "#05D582" },
  { key: "event", label: "Events", emoji: "⚡", color: "#00F0FF" },
];

interface StoryBiblePanelProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  /** Called whenever facts change so the canvas can refresh its RAG context. */
  onFactsChange?: (facts: StoryFact[]) => void;
}

export default function StoryBiblePanel({
  open,
  onClose,
  roomId,
  onFactsChange,
}: StoryBiblePanelProps) {
  const [facts, setFacts] = useState<StoryFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState<FactCategory>("character");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const loaded = await listFacts(roomId);
      setFacts(loaded);
      onFactsChange?.(loaded);
    } catch {
      // ignore — panel just shows empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomId]);

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content || adding) return;
    setAdding(true);
    try {
      await addFact(roomId, newCategory, content);
      setNewContent("");
      await load();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFact(id);
      await load();
    } catch {
      // ignore
    }
  };

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: facts.filter((f) => f.category === cat.key),
  }));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed top-0 left-0 h-full w-full max-w-md z-[70] bg-wine-950 border-r border-rose-400/15 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-400/15 border border-rose-400/30">
                  <BookOpen size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    Story Bible
                  </h3>
                  <p className="text-[11px] text-rose-100/50">
                    Canon every agent knows · {facts.length} facts
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

            {/* Add fact */}
            <div className="px-5 py-4 border-b border-rose-400/10 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setNewCategory(cat.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      newCategory === cat.key
                        ? "border-transparent text-wine-950"
                        : "border-rose-400/20 text-rose-100/60 hover:border-rose-400/40"
                    }`}
                    style={newCategory === cat.key ? { background: cat.color } : undefined}
                  >
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  rows={2}
                  placeholder={`Add a ${newCategory} fact… e.g. "Mira has a scar on her left hand"`}
                  className="flex-1 resize-none rounded-xl bg-wine-800 border border-rose-400/15 px-3.5 py-2.5 text-[13px] text-rose-50 placeholder:text-rose-100/30 outline-none focus:border-rose-400/40 custom-scrollbar"
                />
                <button
                  onClick={handleAdd}
                  disabled={!newContent.trim() || adding}
                  className="shrink-0 w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </button>
              </div>
            </div>

            {/* Facts list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
              {loading && (
                <div className="flex items-center justify-center gap-2 text-rose-100/40 text-[13px] py-8">
                  <Loader2 size={15} className="animate-spin" /> Loading…
                </div>
              )}

              {!loading && facts.length === 0 && (
                <div className="text-center text-rose-100/40 text-[13px] mt-12">
                  <p className="text-3xl mb-3">📖</p>
                  No facts yet. Add the rules of your world
                  <br />
                  and every agent will respect them.
                </div>
              )}

              {grouped.map(
                (group) =>
                  group.items.length > 0 && (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span>{group.emoji}</span>
                        <h4
                          className="text-[11px] font-bold uppercase tracking-widest"
                          style={{ color: group.color }}
                        >
                          {group.label}
                        </h4>
                        <span className="text-[10px] text-rose-100/40">
                          {group.items.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((fact) => (
                          <div
                            key={fact.id}
                            className="group flex items-start gap-2 rounded-lg bg-wine-800 border border-rose-400/10 px-3 py-2.5"
                          >
                            <p className="flex-1 text-[13px] text-rose-50 leading-relaxed">
                              {fact.content}
                            </p>
                            <button
                              onClick={() => handleDelete(fact.id)}
                              className="shrink-0 p-1 rounded text-rose-100/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
