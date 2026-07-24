/**
 * Story Bible + Agent Chat client.
 *
 * The story bible (facts + embeddings) lives in Postgres via Next.js API
 * routes. The agent chat LLM lives in FastAPI. This module wraps both so the
 * canvas UI has one clean interface.
 */

export type FactCategory = "character" | "location" | "lore" | "rule" | "event";

export interface StoryFact {
  id: string;
  category: FactCategory;
  content: string;
  createdAt?: string;
}

export interface SearchResult {
  id: string;
  category: string;
  content: string;
  score: number;
}

// ---- Story Bible (Next.js API routes) ----

export async function listFacts(roomId: string): Promise<StoryFact[]> {
  const res = await fetch(`/api/bible/facts?roomId=${encodeURIComponent(roomId)}`);
  if (!res.ok) throw new Error("Failed to load story bible");
  const data = await res.json();
  return data.facts;
}

export async function addFact(
  roomId: string,
  category: FactCategory,
  content: string
): Promise<StoryFact> {
  const res = await fetch("/api/bible/facts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, category, content }),
  });
  if (!res.ok) throw new Error("Failed to add fact");
  return res.json();
}

export async function deleteFact(id: string): Promise<void> {
  const res = await fetch(`/api/bible/facts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete fact");
}

export async function searchFacts(
  roomId: string,
  query: string,
  k = 5
): Promise<SearchResult[]> {
  const res = await fetch(
    `/api/bible/search?roomId=${encodeURIComponent(roomId)}&q=${encodeURIComponent(query)}&k=${k}`
  );
  if (!res.ok) throw new Error("Failed to search story bible");
  const data = await res.json();
  return data.results;
}

// ---- Agent Chat (FastAPI, streamed) ----

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStreamOptions {
  agent: string;
  message: string;
  roomId: string;
  history: ChatTurn[];
  spatialContext?: string;
  storyFacts: { category: string; content: string }[];
  onToken: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/** Resolve the FastAPI base URL (mirrors the debate client). */
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

/**
 * Stream a conversational reply from a single agent. Calls onToken for each
 * text chunk, onDone when finished, onError on failure.
 */
export async function streamAgentChat(opts: ChatStreamOptions): Promise<void> {
  const res = await fetch(`${agentBaseUrl()}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: opts.agent,
      message: opts.message,
      room_id: opts.roomId,
      history: opts.history,
      spatial_context: opts.spatialContext ?? null,
      story_facts: opts.storyFacts,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    opts.onError?.(`Chat failed: ${res.status}`);
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
        else if (eventName === "error") opts.onError?.(data.message ?? "Chat error");
      } catch {
        // ignore malformed frames
      }
    }
  }
}
