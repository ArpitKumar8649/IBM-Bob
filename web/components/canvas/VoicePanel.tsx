"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  AudioLines,
  Check,
  Loader2,
  Lock,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import {
  CONFIDENCE_LABEL,
  SEVERITY_COLOR,
  checkVoice,
  deleteVoice,
  getVoice,
  listVoices,
  lockVoice,
  saveFingerprint,
  type VoiceCheckResult,
  type VoiceFingerprintRow,
  type VoiceLockResult,
} from "@/lib/voice";
import { useToast } from "@/components/ui/Toast";

/**
 * VoicePanel — lock a character's voice, then measure any line against it.
 *
 * Two columns, one per half of the feature. Left: name a character and the
 * backend harvests every line they speak on the canvas, measures a 14-axis
 * fingerprint in code, and asks Granite to *name* the register it found.
 * Right: paste a line and see the drift verdict — score, severity, which axes
 * moved and by how much, and any hard rule broken.
 *
 * That verdict spends no tokens and calls no model. It is arithmetic over the
 * stored numbers, which is why the panel can show the writer the evidence
 * rather than an opinion. The same arithmetic runs inside the debate, where the
 * Character Lead measures the crew's own draft against these locks.
 */

interface VoicePanelProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[];
  storyFacts: { category: string; content: string }[];
}

/** Rates live in 0…1, sentence/word lengths in whole-ish words. One formatter
 *  for both, so an axis row never prints "0.00" for a real difference. */
const fmt = (v: number) => (Math.abs(v) < 1 ? v.toFixed(2) : v.toFixed(1));

export default function VoicePanel({
  open,
  onClose,
  roomId,
  nodes,
  edges,
  storyFacts,
}: VoicePanelProps) {
  const { toast } = useToast();
  const [voices, setVoices] = useState<VoiceFingerprintRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [locking, setLocking] = useState(false);
  const [lockResult, setLockResult] = useState<VoiceLockResult | null>(null);
  const [selected, setSelected] = useState("");
  const [line, setLine] = useState("");
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<VoiceCheckResult | null>(null);

  const load = async (pick?: string) => {
    setLoading(true);
    try {
      const rows = await listVoices(roomId);
      setVoices(rows);
      // Keep the tester pointed at something real: the just-locked voice if one
      // was named, otherwise whatever survives the refresh.
      setSelected((current) => {
        const next = pick ?? current;
        return rows.some((r) => r.displayName === next) ? next : (rows[0]?.displayName ?? "");
      });
    } catch {
      // A read failure leaves the list empty rather than blocking the panel —
      // locking still works, and the next open retries.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomId]);

  /** Character names on the canvas that have no lock yet — one click to fill. */
  const suggestions = useMemo(() => {
    const locked = new Set(voices.map((v) => v.character));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const node of nodes) {
      if (String(node.data?.node_type ?? "") !== "character") continue;
      const title = String(node.data?.title ?? "").trim();
      const key = title.toLowerCase();
      if (!title || locked.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(title);
    }
    return out.slice(0, 6);
  }, [nodes, voices]);

  /**
   * Measure a voice, then persist what came back.
   *
   * Two calls because the two halves live in different services (see
   * `lib/voice.ts`). A thin sample is not an error: `/voice/lock` refuses before
   * spending a model call and says how many more words it needs, so that branch
   * shows the message and saves nothing.
   */
  const handleLock = async () => {
    const character = name.trim();
    if (!character || locking) return;
    setLocking(true);
    setLockResult(null);
    try {
      const result = await lockVoice({ roomId, nodes, edges, storyFacts, character });
      setLockResult(result);
      if (result.status === "insufficient_sample") {
        toast(result.message ?? "Not enough dialogue to lock this voice yet.", "info");
        return;
      }
      await saveFingerprint(roomId, character, result);
      setName("");
      await load(character);
      toast(
        result.status === "unnamed"
          ? "Voice measured — the register could not be named, but the numbers are stored."
          : `${character}'s voice is locked.`,
        result.status === "unnamed" ? "info" : "success"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Voice lock failed", "error");
    } finally {
      setLocking(false);
    }
  };

  const handleDelete = async (row: VoiceFingerprintRow) => {
    try {
      await deleteVoice(roomId, row.character);
      if (report?.character === row.displayName) setReport(null);
      await load();
      toast(`Removed the lock on ${row.displayName}.`, "info");
    } catch {
      toast("Could not remove that voice", "error");
    }
  };

  /**
   * Judge the typed line against the selected lock.
   *
   * The stored metrics come from the single-voice read, not from the list (which
   * omits them), and then `/voice/check` does the arithmetic. Deliberately two
   * round trips: the numbers a line is judged against are the ones frozen at
   * lock time, so they are fetched rather than recomputed from today's canvas.
   */
  const handleCheck = async () => {
    const candidate = line.trim();
    if (!candidate || !selected || checking) return;
    setChecking(true);
    setReport(null);
    try {
      const row = await getVoice(roomId, selected);
      if (!row?.metrics) {
        toast(`${selected} has no measured fingerprint to compare against.`, "error");
        return;
      }
      setReport(
        await checkVoice({
          character: row.displayName,
          candidateText: candidate,
          metrics: row.metrics,
          neverSays: row.neverSays,
          signaturePhrases: row.signaturePhrases,
        })
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Voice check failed", "error");
    } finally {
      setChecking(false);
    }
  };

  const register = lockResult?.voice_register;
  const moved = report?.deltas.filter((d) => !d.skipped && d.units > 0) ?? [];
  const notJudged = report?.deltas.filter((d) => d.skipped) ?? [];

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
                  <AudioLines size={18} className="text-rose-300" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-rose-50 leading-tight">
                    Character Voice Lock
                  </h3>
                  <p className="text-[11px] text-rose-100/50">
                    Drift is measured in code — no model gets a vote
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

            <div className="flex-1 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-rose-400/10 overflow-hidden">
              {/* ---- Left: lock a voice ---- */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-rose-400/10 space-y-2.5">
                  <label className="block text-[11px] uppercase tracking-widest text-rose-100/50">
                    Lock a voice
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLock()}
                      placeholder="Character name, spelled as on the canvas"
                      className="flex-1 rounded-xl bg-wine-800 border border-rose-400/15 px-3.5 py-2.5 text-[13px] text-rose-50 placeholder:text-rose-100/30 outline-none focus:border-rose-400/40"
                    />
                    <button
                      onClick={handleLock}
                      disabled={!name.trim() || locking}
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-[12px] font-semibold hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {locking ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Lock size={14} />
                      )}
                      Lock
                    </button>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => setName(s)}
                          className="px-2.5 py-1 rounded-full border border-rose-400/20 text-[11px] text-rose-100/60 hover:border-rose-400/50 hover:text-rose-50 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-rose-100/40 leading-relaxed">
                    Only lines this character can be shown to speak are measured —
                    quoted dialogue with their name in the attribution, or a
                    screenplay cue. A thin sample is refused, not guessed at.
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
                  {/* Outcome of the most recent lock attempt */}
                  {lockResult?.status === "insufficient_sample" && (
                    <div className="flex gap-2.5 rounded-xl border border-[#FFCC00]/30 bg-[#FFCC00]/5 px-3.5 py-3">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-[#FFCC00]" />
                      <div className="text-[12px] leading-relaxed">
                        <p className="text-rose-50">{lockResult.message}</p>
                        <p className="text-rose-100/40 mt-1">
                          {lockResult.sample.lines_found} line
                          {lockResult.sample.lines_found === 1 ? "" : "s"} ·{" "}
                          {lockResult.sample.tokens}/{lockResult.sample.min_tokens_required} words
                          across {lockResult.sample.nodes_scanned} nodes
                        </p>
                      </div>
                    </div>
                  )}

                  {lockResult && register && lockResult.status !== "insufficient_sample" && (
                    <div className="rounded-xl bg-wine-800/60 border border-rose-400/15 px-3.5 py-3">
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <span className="font-display font-bold text-rose-50 text-[14px]">
                          {register.register_label}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-rose-300">
                          {CONFIDENCE_LABEL[lockResult.sample.confidence]}
                        </span>
                      </div>
                      {register.description && (
                        <p className="text-[12px] text-rose-100/70 leading-relaxed mb-2">
                          {register.description}
                        </p>
                      )}
                      {register.vocabulary_domain && (
                        <p className="text-[11px] text-rose-100/50 mb-2">
                          Draws on {register.vocabulary_domain}
                        </p>
                      )}
                      <PhraseRow label="Says" color="#05D582" items={register.signature_phrases} />
                      <PhraseRow label="Never says" color="#FF2A6D" items={register.never_says} />
                    </div>
                  )}

                  {/* Locked voices in this room */}
                  <div>
                    <h4 className="text-[11px] uppercase tracking-widest text-rose-100/50 mb-2">
                      Locked in this room · {voices.length}
                    </h4>

                    {loading && (
                      <div className="flex items-center justify-center gap-2 text-rose-100/40 text-[13px] py-8">
                        <Loader2 size={15} className="animate-spin" /> Loading…
                      </div>
                    )}

                    {!loading && voices.length === 0 && (
                      <p className="text-[12px] text-rose-100/40 leading-relaxed">
                        Nothing locked yet. Lock the characters who carry the
                        dialogue and the crew starts measuring its own drafts
                        against them.
                      </p>
                    )}

                    <div className="space-y-2">
                      {voices.map((v) => (
                        <div
                          key={v.id}
                          // A row, not a <button>: it holds its own delete
                          // button, and nesting buttons is invalid HTML. So it
                          // carries the button semantics explicitly instead.
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected === v.displayName}
                          onClick={() => setSelected(v.displayName)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(v.displayName);
                            }
                          }}
                          className={`group flex items-start gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                            selected === v.displayName
                              ? "bg-rose-400/10 border-rose-400/40"
                              : "bg-wine-800 border-rose-400/10 hover:border-rose-400/25"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-rose-50 font-semibold truncate">
                              {v.displayName}
                            </p>
                            <p className="text-[11px] text-rose-100/60 truncate">
                              {v.registerLabel}
                            </p>
                            <p className="text-[10px] text-rose-100/35 mt-0.5">
                              {v.sampleTokens} words · {v.sampleLines} line
                              {v.sampleLines === 1 ? "" : "s"}
                            </p>
                          </div>
                          {selected === v.displayName && (
                            <Check size={14} className="shrink-0 mt-1 text-rose-300" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(v);
                            }}
                            aria-label={`Remove the lock on ${v.displayName}`}
                            className="shrink-0 p-1 rounded text-rose-100/30 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ---- Right: measure a line against a lock ---- */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-rose-400/10 space-y-2.5">
                  <label className="block text-[11px] uppercase tracking-widest text-rose-100/50">
                    Test a line{selected && <span className="text-rose-300"> · {selected}</span>}
                  </label>
                  <textarea
                    value={line}
                    onChange={(e) => setLine(e.target.value)}
                    rows={4}
                    placeholder={
                      selected
                        ? `Type something ${selected} might say…`
                        : "Lock a voice first, then test a line against it."
                    }
                    disabled={!selected}
                    className="w-full resize-none rounded-xl bg-wine-800 border border-rose-400/15 px-3.5 py-2.5 text-[13px] text-rose-50 placeholder:text-rose-100/30 outline-none focus:border-rose-400/40 disabled:opacity-50 custom-scrollbar"
                  />
                  <button
                    onClick={handleCheck}
                    disabled={!line.trim() || !selected || checking}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-400/10 border border-rose-400/40 text-rose-300 text-[12px] font-semibold hover:bg-rose-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {checking ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ScanLine size={14} />
                    )}
                    Measure drift
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                  {!report && !checking && (
                    <div className="text-[12px] text-rose-100/50 leading-relaxed space-y-2">
                      <p>
                        The verdict here is arithmetic: fourteen measured axes,
                        weighted, against the numbers frozen when the voice was
                        locked. Nothing is sent to a model, so it costs nothing
                        and reads the same way every time.
                      </p>
                      <p>
                        Two rules sit outside the score. A word on the
                        character&apos;s <em>never says</em> list is a blocker at
                        any length, and a line too short to measure is reported
                        as unmeasured rather than scored.
                      </p>
                    </div>
                  )}

                  {report && (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-wine-800/60 border border-rose-400/10 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span
                            className="px-3 py-1 rounded-lg text-wine-950 font-display font-bold text-[13px] uppercase tracking-wide"
                            style={{ background: SEVERITY_COLOR[report.severity] }}
                          >
                            {report.severity}
                          </span>
                          <span className="font-display font-bold text-rose-50">
                            {report.judged ? report.score : "—"}
                            <span className="text-rose-100/40 text-sm">/100 drift</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-wine-950 overflow-hidden mb-3">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${report.judged ? report.score : 0}%`,
                              background: SEVERITY_COLOR[report.severity],
                            }}
                          />
                        </div>
                        <p className="text-[13px] text-rose-50 leading-relaxed">{report.summary}</p>
                        <p className="text-[10px] text-rose-100/35 mt-2">
                          {report.candidate_tokens} words tested against{" "}
                          {report.locked_tokens} locked
                        </p>
                      </div>

                      {/* Unmeasured is a real answer, not a silent zero. */}
                      {!report.judged && report.reason && (
                        <div className="flex gap-2.5 rounded-xl border border-rose-400/20 bg-wine-800/40 px-3.5 py-3">
                          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-300" />
                          <p className="text-[12px] text-rose-100/70 leading-relaxed">
                            {report.reason}
                          </p>
                        </div>
                      )}

                      {report.violations.length > 0 && (
                        <div>
                          <h5 className="text-[11px] uppercase tracking-widest text-rose-100/50 mb-2">
                            Hard rules
                          </h5>
                          <div className="space-y-2">
                            {report.violations.map((v, i) => (
                              <div
                                key={i}
                                className="rounded-lg border px-3 py-2 text-[12px] leading-relaxed"
                                style={{
                                  borderColor: `${SEVERITY_COLOR[v.severity]}55`,
                                  background: `${SEVERITY_COLOR[v.severity]}0D`,
                                }}
                              >
                                <span
                                  className="font-mono text-[10px] uppercase tracking-widest mr-2"
                                  style={{ color: SEVERITY_COLOR[v.severity] }}
                                >
                                  {v.kind === "never_says" ? "never says" : "missing signature"}
                                </span>
                                <span className="text-rose-50">{v.detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {moved.length > 0 && (
                        <div>
                          <h5 className="text-[11px] uppercase tracking-widest text-rose-100/50 mb-2">
                            What moved
                          </h5>
                          <div className="space-y-2.5">
                            {moved.map((d) => (
                              <div key={d.axis}>
                                <div className="flex items-baseline justify-between gap-2 mb-1">
                                  <span className="text-[12px] text-rose-50">
                                    {d.label}
                                    <span className="text-rose-100/45"> — {d.direction}</span>
                                  </span>
                                  <span className="font-mono text-[10px] text-rose-100/40 shrink-0">
                                    {fmt(d.locked)} → {fmt(d.candidate)}
                                  </span>
                                </div>
                                {/* Bar is tolerance units, not raw delta: one full
                                    width is one axis-width of drift, which is the
                                    unit the score is actually built from. */}
                                <div className="h-1.5 rounded-full bg-wine-950 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(d.units, 1) * 100}%`,
                                      background: SEVERITY_COLOR[report.severity],
                                      opacity: 0.55 + Math.min(d.weight * 4, 0.45),
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shown rather than dropped: an axis that was excluded and
                          why is honest; a quietly missing axis looks ignored. */}
                      {notJudged.length > 0 && (
                        <div>
                          <h5 className="text-[11px] uppercase tracking-widest text-rose-100/50 mb-2">
                            Not judged
                          </h5>
                          <div className="flex flex-wrap gap-1.5">
                            {notJudged.map((d) => (
                              <span
                                key={d.axis}
                                title={d.skip_reason ?? ""}
                                className="px-2 py-0.5 rounded-full border border-rose-400/15 text-[10px] text-rose-100/40"
                              >
                                {d.label}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-rose-100/30 mt-1.5">
                            Either unmeasurable on a line this short, or a feature
                            neither the locked voice nor this line uses.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Signature phrases / never-says as chips. Renders nothing on an empty list —
 *  the naming model is told to return one rather than invent entries, so an
 *  empty row means "no honest answer from this sample", not a missing feature. */
function PhraseRow({
  label,
  color,
  items,
}: {
  label: string;
  color: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className="text-[10px] uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
      {items.map((item) => (
        <span
          key={item}
          className="px-2 py-0.5 rounded-full text-[11px] text-rose-50"
          style={{ background: `${color}1A`, border: `1px solid ${color}44` }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

