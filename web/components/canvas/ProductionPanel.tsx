"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clapperboard,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Users,
  X,
} from "lucide-react";
import {
  generateCharacterBreakdown,
  generateSceneBreakdown,
  generateSceneImage,
  charactersToMarkdown,
  scenesToMarkdown,
  type CharacterBreakdown,
  type SceneBreakdown,
} from "@/lib/breakdown";
import { useToast } from "@/components/ui/Toast";

/**
 * ProductionPanel — generate production-ready breakdowns from the story graph:
 *
 * - Characters tab: casting-ready character breakdown sheets
 * - Scenes tab: scene-by-scene breakdown with shot lists + cinematic image
 *   prompts (the AI scene-image feature — Granite writes the prompt)
 *
 * Both tabs support copy-to-clipboard and Markdown download.
 */

type Tab = "characters" | "scenes";

interface ProductionPanelProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[];
  storyFacts: { category: string; content: string }[];
}

export default function ProductionPanel({
  open,
  onClose,
  roomId,
  nodes,
  edges,
  storyFacts,
}: ProductionPanelProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("characters");
  const [characters, setCharacters] = useState<CharacterBreakdown[] | null>(null);
  const [scenes, setScenes] = useState<SceneBreakdown[] | null>(null);
  const [loadingChars, setLoadingChars] = useState(false);
  const [loadingScenes, setLoadingScenes] = useState(false);
  // scene_number -> image URL (or "loading" / "error:<msg>")
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});

  const req = { roomId, nodes, edges, storyFacts };

  const genSceneImage = async (scene: SceneBreakdown) => {
    setSceneImages((prev) => ({ ...prev, [scene.scene_number]: "loading" }));
    try {
      const result = await generateSceneImage(scene.image_prompt);
      if (result.status === "success" && result.image_url) {
        setSceneImages((prev) => ({ ...prev, [scene.scene_number]: result.image_url! }));
        // Name the model: the backend falls back to another one when the
        // primary is out of quota, and that changes the look of the render.
        toast(
          result.model_id
            ? `Scene image generated with ${result.model_id}`
            : "Scene image generated!",
          "success"
        );
      } else if (result.status === "no_key") {
        setSceneImages((prev) => ({
          ...prev,
          [scene.scene_number]: "error:DASHSCOPE_API_KEY not set — copy the prompt into any image tool.",
        }));
        toast(result.message || "No image key configured", "info");
      } else {
        setSceneImages((prev) => ({
          ...prev,
          [scene.scene_number]: `error:${result.message || "Image generation failed"}`,
        }));
        toast(result.message || "Image generation failed", "error");
      }
    } catch (err) {
      setSceneImages((prev) => ({
        ...prev,
        [scene.scene_number]: `error:${err instanceof Error ? err.message : "Failed"}`,
      }));
      toast("Image generation failed", "error");
    }
  };

  const genCharacters = async () => {
    setLoadingChars(true);
    try {
      const result = await generateCharacterBreakdown(req);
      setCharacters(result);
      toast("Character breakdown generated!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setLoadingChars(false);
    }
  };

  const genScenes = async () => {
    setLoadingScenes(true);
    try {
      const result = await generateSceneBreakdown(req);
      setScenes(result);
      toast("Scene breakdown generated!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setLoadingScenes(false);
    }
  };

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast("Downloaded!", "success");
  };

  const copy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast("Copied to clipboard", "success");
    } catch {
      toast("Could not copy", "error");
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
            className="relative w-full max-w-4xl h-[85vh] bg-wine-950 border border-rose-400/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-400/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-400/15 border border-rose-400/30">
                  <Clapperboard size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    Production Breakdowns
                  </h3>
                  <p className="text-[11px] text-rose-100/50">
                    Casting sheets & shot lists from your story
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

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-4 border-b border-rose-400/10">
              <button
                onClick={() => setTab("characters")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-[13px] font-medium transition-colors ${
                  tab === "characters"
                    ? "bg-wine-800 text-rose-300 border border-rose-400/20 border-b-transparent"
                    : "text-rose-100/50 hover:text-rose-100/80"
                }`}
              >
                <Users size={15} />
                Characters
              </button>
              <button
                onClick={() => setTab("scenes")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-[13px] font-medium transition-colors ${
                  tab === "scenes"
                    ? "bg-wine-800 text-rose-300 border border-rose-400/20 border-b-transparent"
                    : "text-rose-100/50 hover:text-rose-100/80"
                }`}
              >
                <Clapperboard size={15} />
                Scenes & Shots
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
              {/* ---- Characters tab ---- */}
              {tab === "characters" && (
                <div>
                  {!characters && !loadingChars && (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">🎭</div>
                      <h4 className="font-display text-lg font-bold text-rose-50 mb-2">
                        Character Breakdown Sheets
                      </h4>
                      <p className="text-rose-100/60 text-[13px] max-w-md mx-auto mb-6">
                        Generate casting-ready breakdowns: appearance, arc, key
                        scenes, and voice notes for every character.
                      </p>
                      <button
                        onClick={genCharacters}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all"
                      >
                        <Users size={16} />
                        Generate Character Breakdown
                      </button>
                    </div>
                  )}

                  {loadingChars && (
                    <div className="flex flex-col items-center justify-center gap-4 py-20">
                      <Loader2 size={40} className="animate-spin text-rose-400" />
                      <p className="text-rose-100/60 text-[14px]">
                        Analyzing your characters…
                      </p>
                    </div>
                  )}

                  {characters && (
                    <>
                      <div className="flex justify-end gap-2 mb-4">
                        <button
                          onClick={() => copy(charactersToMarkdown(characters))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors"
                        >
                          <Copy size={13} /> Copy
                        </button>
                        <button
                          onClick={() =>
                            download(charactersToMarkdown(characters), "character-breakdown.md")
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[12px] font-semibold hover:bg-rose-400 transition-colors"
                        >
                          <Download size={13} /> Download
                        </button>
                      </div>
                      <div className="space-y-4">
                        {characters.map((c, i) => (
                          <div
                            key={i}
                            className="rounded-xl bg-wine-800 border border-rose-400/10 p-5"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <span className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-400/15 border border-rose-400/30 text-lg">
                                🎭
                              </span>
                              <div>
                                <h4 className="font-display text-lg font-bold text-rose-50">
                                  {c.name}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-300 border border-rose-400/30">
                                    {c.role}
                                  </span>
                                  <span className="text-[11px] text-rose-100/50">
                                    {c.age_range}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2.5 text-[13px]">
                              <p className="text-rose-100/70">
                                <span className="text-rose-300 font-semibold">Appearance: </span>
                                {c.appearance}
                              </p>
                              <p className="text-rose-100/70">
                                <span className="text-rose-300 font-semibold">Arc: </span>
                                {c.arc_summary}
                              </p>
                              <div>
                                <span className="text-rose-300 font-semibold">Key Scenes:</span>
                                <ul className="mt-1 space-y-1">
                                  {c.key_scenes.map((s, j) => (
                                    <li key={j} className="text-rose-100/60 flex gap-2">
                                      <span className="text-rose-400">•</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <p className="text-rose-100/70">
                                <span className="text-rose-300 font-semibold">Voice: </span>
                                {c.voice_note}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ---- Scenes tab ---- */}
              {tab === "scenes" && (
                <div>
                  {!scenes && !loadingScenes && (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">🎬</div>
                      <h4 className="font-display text-lg font-bold text-rose-50 mb-2">
                        Scene Breakdown & Shot List
                      </h4>
                      <p className="text-rose-100/60 text-[13px] max-w-md mx-auto mb-6">
                        Break your story into scenes with sluglines, characters,
                        props, suggested shots, and a cinematic image prompt for
                        each scene.
                      </p>
                      <button
                        onClick={genScenes}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all"
                      >
                        <Clapperboard size={16} />
                        Generate Scene Breakdown
                      </button>
                    </div>
                  )}

                  {loadingScenes && (
                    <div className="flex flex-col items-center justify-center gap-4 py-20">
                      <Loader2 size={40} className="animate-spin text-rose-400" />
                      <p className="text-rose-100/60 text-[14px]">
                        Breaking down your scenes…
                      </p>
                    </div>
                  )}

                  {scenes && (
                    <>
                      <div className="flex justify-end gap-2 mb-4">
                        <button
                          onClick={() => copy(scenesToMarkdown(scenes))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 transition-colors"
                        >
                          <Copy size={13} /> Copy
                        </button>
                        <button
                          onClick={() =>
                            download(scenesToMarkdown(scenes), "scene-breakdown.md")
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[12px] font-semibold hover:bg-rose-400 transition-colors"
                        >
                          <Download size={13} /> Download
                        </button>
                      </div>
                      <div className="space-y-4">
                        {scenes.map((s) => (
                          <div
                            key={s.scene_number}
                            className="rounded-xl bg-wine-800 border border-rose-400/10 p-5"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-display text-[15px] font-bold text-rose-50">
                                Scene {s.scene_number}: {s.heading}
                              </h4>
                              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-300 border border-rose-400/30">
                                {s.time_of_day}
                              </span>
                            </div>
                            <p className="text-rose-100/70 text-[13px] mb-3">{s.summary}</p>

                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className="text-[11px] text-rose-100/50">
                                <span className="text-rose-300">Cast:</span>{" "}
                                {s.characters.join(", ")}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {s.props.map((p, j) => (
                                <span
                                  key={j}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-wine-950 border border-rose-400/10 text-rose-100/60"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>

                            {/* Shot list */}
                            <div className="mb-3">
                              <p className="text-rose-300 text-[11px] uppercase tracking-wider mb-2">
                                Shot List
                              </p>
                              <div className="space-y-1.5">
                                {s.shots.map((shot, j) => (
                                  <div key={j} className="flex gap-2 text-[12px]">
                                    <span className="shrink-0 font-mono font-bold text-rose-400 w-32">
                                      {shot.shot_type}
                                    </span>
                                    <span className="text-rose-100/60">{shot.description}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Cinematic image prompt + optional in-app render.
                                The prompt is the always-working artifact: it is
                                shown and copyable regardless of whether an image
                                model is configured, so this step never blocks the
                                writer. In-app rendering (Qwen/Wan via DashScope)
                                is an optional bonus on top. */}
                            <div className="rounded-lg bg-gradient-to-br from-rose-500/10 to-wine-950 border border-rose-400/20 p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <ImageIcon size={13} className="text-rose-300" />
                                  <span className="text-rose-300 text-[11px] uppercase tracking-wider">
                                    Cinematic image prompt
                                  </span>
                                </div>
                                <button
                                  onClick={() => genSceneImage(s)}
                                  disabled={sceneImages[s.scene_number] === "loading"}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500 text-white text-[11px] font-semibold hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {sceneImages[s.scene_number] === "loading" ? (
                                    <>
                                      <Loader2 size={11} className="animate-spin" /> Rendering…
                                    </>
                                  ) : (
                                    <>
                                      <ImageIcon size={11} /> Render in-app
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-rose-100/70 text-[12px] leading-relaxed italic mb-2">
                                {s.image_prompt}
                              </p>

                              {/* The prompt is always copyable — the real,
                                  model-agnostic deliverable. */}
                              <div className="flex items-center gap-2 mb-2">
                                <button
                                  onClick={() => copy(s.image_prompt)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-rose-400/25 text-rose-100/80 text-[11px] font-medium hover:bg-rose-400/10 transition-colors"
                                >
                                  <Copy size={11} /> Copy prompt
                                </button>
                                <span className="text-[10px] text-rose-100/40">
                                  Paste into Midjourney, FLUX, or Replicate
                                </span>
                              </div>

                              {/* Rendered concept art when an image model succeeds. */}
                              {sceneImages[s.scene_number] &&
                                sceneImages[s.scene_number] !== "loading" &&
                                !sceneImages[s.scene_number].startsWith("error:") && (
                                  <img
                                    src={sceneImages[s.scene_number]}
                                    alt={`Scene ${s.scene_number} concept`}
                                    className="w-full rounded-lg border border-rose-400/20 mt-1"
                                  />
                                )}

                              {/* Friendly "render unavailable" note — a usable
                                  state, not an error: the prompt above is ready. */}
                              {sceneImages[s.scene_number]?.startsWith("error:") && (
                                <div className="flex items-start gap-2 rounded-md bg-amber-400/10 border border-amber-400/25 px-2.5 py-2 mt-1">
                                  <ImageIcon size={13} className="text-amber-300 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                                    In-app rendering needs{" "}
                                    <code className="font-mono text-amber-200">DASHSCOPE_API_KEY</code>.
                                    The prompt above is ready to paste into any image
                                    tool — the concept-art step never blocks you.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
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
