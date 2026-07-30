/**
 * Character voice lock client.
 *
 * Split-brain by design, the same way `lib/bible.ts` is:
 *
 * * **Measuring and judging** live in FastAPI (`/voice/lock`, `/voice/check`).
 *   That service has no database handle, and the canvas graph is in the
 *   browser, so the nodes have to be posted to it.
 * * **Persistence** lives in Next.js (`/api/voice/fingerprints`), which owns
 *   Postgres.
 *
 * So a lock is two calls, in this order: `lockVoice()` to measure and name,
 * then `saveFingerprint()` to store what came back. A check is also two:
 * `getVoice()` for the stored fingerprint, then `checkVoice()` to judge a line
 * against it. Nothing is persisted server-side by FastAPI, and nothing is
 * measured by the Next route.
 *
 * Field naming follows whichever service owns the shape: snake_case for the
 * FastAPI payloads (`register_label`, `never_says`), camelCase for the Prisma
 * rows (`registerLabel`, `neverSays`). `saveFingerprint` is the one place that
 * converts between them.
 */

export type VoiceSeverity = "ok" | "minor" | "major" | "blocker";
export type VoiceConfidence = "none" | "low" | "medium" | "high";
export type VoiceLockStatus = "locked" | "insufficient_sample" | "unnamed";

/** The 14 measured StyleMetrics fields, kept as an open record so an older
 *  stored fingerprint with a different key set still round-trips. */
export type VoiceMetrics = Record<string, number>;

export interface VoiceRegister {
  register_label: string;
  description: string;
  signature_phrases: string[];
  vocabulary_domain: string;
  never_says: string[];
}

export interface VoiceSampleReport {
  nodes_scanned: number;
  lines_found: number;
  tokens: number;
  min_tokens_required: number;
  confidence: VoiceConfidence;
}

export interface VoiceLockResult {
  status: VoiceLockStatus;
  character: string;
  message: string | null;
  metrics: VoiceMetrics | null;
  voice_register: VoiceRegister | null;
  sample: VoiceSampleReport;
}

export interface AxisDelta {
  axis: string;
  label: string;
  locked: number;
  candidate: number;
  delta: number;
  units: number;
  weight: number;
  tolerance: number;
  direction: string;
  skipped: boolean;
  skip_reason: string | null;
}

export interface VoiceViolation {
  kind: "never_says" | "missing_signature";
  detail: string;
  severity: VoiceSeverity;
  escalates: boolean;
}

export interface VoiceCheckResult {
  character: string;
  /** False when the sample was too short to measure. `score` is then 0 and
   *  `reason` says why — but `severity` can still be a blocker, because a hard
   *  rule break needs no sample size to be true. */
  judged: boolean;
  score: number;
  severity: VoiceSeverity;
  summary: string;
  deltas: AxisDelta[];
  violations: VoiceViolation[];
  candidate_tokens: number;
  locked_tokens: number;
  reason: string | null;
}

/** A stored fingerprint. `metrics`, `neverSays` and `signaturePhrases` are only
 *  present on the single-character read — the list view omits them. */
export interface VoiceFingerprintRow {
  id: string;
  character: string;
  displayName: string;
  registerLabel: string;
  vocabularyDomain: string;
  sampleLines: number;
  sampleTokens: number;
  lockedAt: string;
  description?: string;
  metrics?: VoiceMetrics;
  signaturePhrases?: string[];
  neverSays?: string[];
}

/** Resolve the FastAPI base URL (mirrors the other inference clients). */
function agentBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.hostname.includes("github.dev")) {
    const hostname = window.location.hostname;
    const codespaceDomain = hostname.replace("-3002", "-8000").replace("-3000", "-8000");
    return `https://${codespaceDomain}`;
  }
  return "http://127.0.0.1:8000";
}

// ---- Measure + judge (FastAPI) ----

export interface LockVoiceOptions {
  roomId: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[];
  storyFacts: { category: string; content: string }[];
  character: string;
}

/**
 * Measure a character's voice from the canvas and ask Granite to name it.
 *
 * Neither a thin sample nor a failed naming call is an error. The call succeeds
 * with `status: "insufficient_sample"` and a `message` saying how many more
 * words are needed (spending no model call), or with `status: "unnamed"` and
 * the measured `metrics` intact when the model was unreachable. So callers
 * should branch on `status`, not on `res.ok` — a non-ok response here means the
 * request itself was rejected, not that the voice could not be locked.
 */
export async function lockVoice(opts: LockVoiceOptions): Promise<VoiceLockResult> {
  const res = await fetch(`${agentBaseUrl()}/voice/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room_id: opts.roomId,
      nodes: opts.nodes,
      edges: opts.edges,
      story_facts: opts.storyFacts,
      character: opts.character,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Voice lock failed (${res.status})`);
  }

  return res.json();
}

export interface CheckVoiceOptions {
  character: string;
  candidateText: string;
  metrics: VoiceMetrics;
  neverSays?: string[];
  signaturePhrases?: string[];
}

/**
 * Judge a candidate line against a locked fingerprint.
 *
 * No model call and no token cost on the server — the verdict is arithmetic
 * plus two hard rules — so this is safe to call per line as the writer types.
 */
export async function checkVoice(opts: CheckVoiceOptions): Promise<VoiceCheckResult> {
  const res = await fetch(`${agentBaseUrl()}/voice/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      character: opts.character,
      candidate_text: opts.candidateText,
      metrics: opts.metrics,
      never_says: opts.neverSays ?? [],
      signature_phrases: opts.signaturePhrases ?? [],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Voice check failed (${res.status})`);
  }

  return res.json();
}

// ---- Persistence (Next.js API routes) ----

export async function listVoices(roomId: string): Promise<VoiceFingerprintRow[]> {
  const res = await fetch(`/api/voice/fingerprints?roomId=${encodeURIComponent(roomId)}`);
  if (!res.ok) throw new Error("Failed to load locked voices");
  const data = await res.json();
  return data.voices;
}

/** One stored fingerprint, with the metrics `checkVoice` needs. Null if this
 *  character has no lock yet — an expected state, not an error. */
export async function getVoice(
  roomId: string,
  character: string
): Promise<VoiceFingerprintRow | null> {
  const res = await fetch(
    `/api/voice/fingerprints?roomId=${encodeURIComponent(roomId)}` +
      `&character=${encodeURIComponent(character)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load the locked voice");
  return res.json();
}

/**
 * Persist a successful lock. Rejects an `insufficient_sample` result rather
 * than storing a fingerprint with no metrics — an unnamed lock is still worth
 * keeping (the numbers are the deterministic half), but an unmeasured one is
 * not.
 */
export async function saveFingerprint(
  roomId: string,
  character: string,
  result: VoiceLockResult
): Promise<void> {
  if (!result.metrics) {
    throw new Error(result.message || "Nothing measured — this voice cannot be saved yet");
  }

  const register = result.voice_register;
  const res = await fetch("/api/voice/fingerprints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId,
      character,
      metrics: result.metrics,
      registerLabel: register?.register_label || "unnamed voice",
      description: register?.description ?? "",
      vocabularyDomain: register?.vocabulary_domain ?? "",
      signaturePhrases: register?.signature_phrases ?? [],
      neverSays: register?.never_says ?? [],
      sampleLines: result.sample.lines_found,
      sampleTokens: result.sample.tokens,
    }),
  });
  if (!res.ok) throw new Error("Failed to save the locked voice");
}

export async function deleteVoice(roomId: string, character: string): Promise<void> {
  const res = await fetch(
    `/api/voice/fingerprints?roomId=${encodeURIComponent(roomId)}` +
      `&character=${encodeURIComponent(character)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to delete the locked voice");
}

// ---- Presentation helpers ----

/** Severity → accent color (matches the site's semantic palette). */
export const SEVERITY_COLOR: Record<VoiceSeverity, string> = {
  ok: "#05D582",
  minor: "#FFCC00",
  major: "#FF8A3D",
  blocker: "#FF2A6D",
};

/** How much a lock built from this many words can be trusted. */
export const CONFIDENCE_LABEL: Record<VoiceConfidence, string> = {
  none: "not locked",
  low: "rough read",
  medium: "solid",
  high: "strong",
};
