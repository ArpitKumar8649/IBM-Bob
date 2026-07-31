/**
 * Production breakdowns client — character sheets + scene/shot-list breakdowns.
 * The LLM lives in FastAPI (POST /breakdown/*); this wraps it for the UI.
 */

export interface CharacterBreakdown {
  name: string;
  role: string;
  age_range: string;
  appearance: string;
  arc_summary: string;
  key_scenes: string[];
  voice_note: string;
}

export interface Shot {
  shot_type: string;
  description: string;
}

export interface SceneBreakdown {
  scene_number: number;
  heading: string;
  summary: string;
  characters: string[];
  props: string[];
  time_of_day: string;
  shots: Shot[];
  image_prompt: string;
}

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

export interface BreakdownRequest {
  roomId: string;
  nodes: { id: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; data?: Record<string, unknown> }[];
  storyFacts: { category: string; content: string }[];
}

function buildBody(req: BreakdownRequest) {
  return {
    room_id: req.roomId,
    nodes: req.nodes,
    edges: req.edges,
    story_facts: req.storyFacts,
  };
}

export async function generateCharacterBreakdown(
  req: BreakdownRequest
): Promise<CharacterBreakdown[]> {
  const res = await fetch(`${agentBaseUrl()}/breakdown/characters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(req)),
  });
  if (!res.ok) throw new Error(`Character breakdown failed (${res.status})`);
  const data = await res.json();
  return data.characters;
}

export async function generateSceneBreakdown(
  req: BreakdownRequest
): Promise<SceneBreakdown[]> {
  const res = await fetch(`${agentBaseUrl()}/breakdown/scenes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(req)),
  });
  if (!res.ok) throw new Error(`Scene breakdown failed (${res.status})`);
  const data = await res.json();
  return data.scenes;
}

// --------------------------------------------------------------------------- //
// AI scene images (DashScope — Wan / Qwen)
// --------------------------------------------------------------------------- //

export interface SceneImageResult {
  image_url: string | null;
  status: "success" | "failed" | "no_key";
  message: string | null;
  /** Which model rendered it — or, on failure, the last one tried. */
  model_id?: string | null;
}

/**
 * Render a cinematic image prompt with DashScope's text-to-image models.
 * Returns the image URL on success, or a status explaining why it couldn't
 * (no key configured, generation failed, etc.). The backend walks a fallback
 * chain of models, so a render can come from a different model than the
 * configured primary — `model_id` says which one.
 */
export async function generateSceneImage(
  prompt: string,
  size = "1280*720"
): Promise<SceneImageResult> {
  const res = await fetch(`${agentBaseUrl()}/scene-image/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size }),
  });
  if (!res.ok) throw new Error(`Image generation failed (${res.status})`);
  return res.json();
}

// --------------------------------------------------------------------------- //
// Tone / genre transfer
// --------------------------------------------------------------------------- //

export const TONE_OPTIONS = [
  { key: "noir", label: "Noir", emoji: "🌧️" },
  { key: "comedy", label: "Comedy", emoji: "😂" },
  { key: "horror", label: "Horror", emoji: "👻" },
  { key: "epic", label: "Epic Fantasy", emoji: "⚔️" },
  { key: "minimalist", label: "Minimalist", emoji: "✂️" },
  { key: "literary", label: "Literary", emoji: "📖" },
  { key: "thriller", label: "Thriller", emoji: "🔪" },
  { key: "romance", label: "Romance", emoji: "💕" },
  { key: "sci-fi", label: "Sci-Fi", emoji: "🚀" },
  { key: "fantasy", label: "High Fantasy", emoji: "🐉" },
] as const;

export interface ToneTransformOptions {
  content: string;
  title?: string;
  tone: string;
  storyFacts?: { category: string; content: string }[];
  onToken: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream a tone/genre rewrite of a story node. Calls onToken for each chunk,
 * onDone when finished, onError on failure.
 */
export async function streamToneTransform(opts: ToneTransformOptions): Promise<void> {
  const res = await fetch(`${agentBaseUrl()}/transform/tone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: opts.content,
      title: opts.title ?? "",
      tone: opts.tone,
      story_facts: opts.storyFacts ?? [],
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    opts.onError?.(`Transform failed: ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let eventName = "";
      let dataStr = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!eventName || !dataStr) continue;

      try {
        const data = JSON.parse(dataStr);
        if (eventName === "token") opts.onToken(data.text ?? "");
        else if (eventName === "done") opts.onDone?.();
        else if (eventName === "error") opts.onError?.(data.message ?? "Transform error");
      } catch {
        // ignore malformed frames
      }
    }
  }
}

// --------------------------------------------------------------------------- //
// Markdown renderers (for download / copy)
// --------------------------------------------------------------------------- //

export function charactersToMarkdown(characters: CharacterBreakdown[]): string {
  const lines: string[] = ["# Character Breakdown", ""];
  characters.forEach((c) => {
    lines.push(`## ${c.name} — ${c.role}`);
    lines.push(`**Age:** ${c.age_range}`);
    lines.push("");
    lines.push(`**Appearance:** ${c.appearance}`);
    lines.push("");
    lines.push(`**Arc:** ${c.arc_summary}`);
    lines.push("");
    lines.push("**Key Scenes:**");
    c.key_scenes.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
    lines.push(`**Voice:** ${c.voice_note}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  });
  lines.push("_Generated by The Writers' Room · powered by IBM Granite_");
  return lines.join("\n");
}

export function scenesToMarkdown(scenes: SceneBreakdown[]): string {
  const lines: string[] = ["# Scene Breakdown & Shot List", ""];
  scenes.forEach((s) => {
    lines.push(`## Scene ${s.scene_number}: ${s.heading}`);
    lines.push(`**Time of Day:** ${s.time_of_day}`);
    lines.push(`**Characters:** ${s.characters.join(", ")}`);
    lines.push(`**Props:** ${s.props.join(", ")}`);
    lines.push("");
    lines.push(`**Summary:** ${s.summary}`);
    lines.push("");
    lines.push("**Shots:**");
    s.shots.forEach((shot) => lines.push(`- **${shot.shot_type}** — ${shot.description}`));
    lines.push("");
    lines.push(`**Image Prompt:** ${s.image_prompt}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  });
  lines.push("_Generated by The Writers' Room · powered by IBM Granite_");
  return lines.join("\n");
}
