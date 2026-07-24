"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Loader2 } from "lucide-react";
import {
  streamAgentChat,
  type ChatTurn,
  type StoryFact,
} from "@/lib/bible";

/**
 * AgentChatDrawer — a slide-out panel to converse with any single agent.
 *
 * The agent replies in its persona, grounded in the current canvas and the
 * story bible (RAG). Responses stream in live. Conversation history is kept
 * client-side and sent each turn so the agent remembers the whole chat.
 */

const AGENTS = [
  { key: "architect", label: "Architect", emoji: "🏛️", color: "#00F0FF" },
  { key: "critic_character", label: "Character", emoji: "🎭", color: "#FF2A6D" },
  { key: "critic_world", label: "World", emoji: "🌍", color: "#FFCC00" },
  { key: "critic_continuity", label: "Continuity", emoji: "🧵", color: "#05D582" },
  { key: "critic_tension", label: "Tension", emoji: "⚡", color: "#B388FF" },
  { key: "merge", label: "Advocate", emoji: "⚔️", color: "#FF6B35" },
  { key: "reviser", label: "Reviser", emoji: "✍️", color: "#4FC3F7" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentChatDrawerProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  spatialContext: string;
  storyFacts: StoryFact[];
}

export default function AgentChatDrawer({
  open,
  onClose,
  roomId,
  spatialContext,
  storyFacts,
}: AgentChatDrawerProps) {
  const [agent, setAgent] = useState(AGENTS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to the bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Abort any in-flight stream when closing.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  // Reset the conversation when switching agents.
  const switchAgent = (a: typeof AGENTS[number]) => {
    if (a.key === agent.key) return;
    abortRef.current?.abort();
    setAgent(a);
    setMessages([]);
    setStreaming(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamAgentChat({
      agent: agent.key,
      message: text,
      roomId,
      history,
      spatialContext,
      storyFacts: storyFacts.map((f) => ({ category: f.category, content: f.content })),
      signal: controller.signal,
      onToken: (chunk) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + chunk };
          }
          return copy;
        });
      },
      onDone: () => setStreaming(false),
      onError: (msg) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            copy[copy.length - 1] = { ...last, content: `⚠️ ${msg}` };
          }
          return copy;
        });
        setStreaming(false);
      },
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed top-0 right-0 h-full w-full max-w-md z-[70] bg-wine-950 border-l border-rose-400/15 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border"
                  style={{ background: `${agent.color}18`, borderColor: `${agent.color}44` }}
                >
                  {agent.emoji}
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    {agent.label}
                  </h3>
                  <p className="text-[11px] text-rose-100/50">
                    Grounded in your canvas + story bible
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

            {/* Agent picker */}
            <div className="flex gap-1.5 px-4 py-3 overflow-x-auto border-b border-rose-400/10 custom-scrollbar">
              {AGENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => switchAgent(a)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                    a.key === agent.key
                      ? "border-transparent text-wine-950"
                      : "border-rose-400/20 text-rose-100/60 hover:border-rose-400/40"
                  }`}
                  style={
                    a.key === agent.key
                      ? { background: a.color }
                      : undefined
                  }
                >
                  <span>{a.emoji}</span>
                  {a.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-rose-100/40 text-[13px] mt-12">
                  <p className="text-3xl mb-3">{agent.emoji}</p>
                  Ask the {agent.label} anything about your story.
                  <br />
                  It knows your canvas and story bible.
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-rose-500 text-white rounded-br-sm"
                        : "bg-wine-800 text-rose-50 border border-rose-400/10 rounded-bl-sm"
                    }`}
                  >
                    {m.content || (
                      <span className="inline-flex items-center gap-1.5 text-rose-100/50">
                        <Loader2 size={13} className="animate-spin" /> thinking…
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-rose-400/10">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={`Message the ${agent.label}…`}
                  className="flex-1 resize-none rounded-xl bg-wine-800 border border-rose-400/15 px-3.5 py-2.5 text-[13.5px] text-rose-50 placeholder:text-rose-100/30 outline-none focus:border-rose-400/40 custom-scrollbar max-h-28"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || streaming}
                  className="shrink-0 w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
