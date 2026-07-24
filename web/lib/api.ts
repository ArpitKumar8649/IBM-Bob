export type CanvasNodePayload = {
  id: string;
  data: {
    title?: string;
    content?: string;
    sequence?: string;
    node_type?: string;
  };
};

export type CanvasEdgePayload = {
  id: string;
  source: string;
  target: string;
  data?: {
    label?: string;
  };
};

export type GeneratedStoryNode = {
  label: string;
  content: string;
  node_type: "character" | "plot_beat" | "location" | "note";
  relative_x: number;
  relative_y: number;
};

export type AgentGenerationResult = {
  status: "success" | "error";
  nodes: GeneratedStoryNode[];
  decision?: "APPROVE" | "REJECT" | null;
  critic_results?: Array<{
    critic: string;
    decision: "APPROVE" | "REJECT";
    feedback: string;
    severity: "blocker" | "major" | "minor" | "ok";
  }>;
  debate_feedback?: string;
  error?: string;
};

export type GeneratePlotBeatInput = {
  roomId: string;
  selectedNode: {
    id: string;
    title: string;
    content: string;
  };
  nodes: CanvasNodePayload[];
  edges: CanvasEdgePayload[];
};

function agentBaseUrl(): string {
  // Deployment should always set NEXT_PUBLIC_API_BASE_URL. Preserve a local
  // fallback for development, including Codespaces' forwarded port behavior.
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const isCodespace =
    typeof window !== "undefined" && window.location.hostname.includes("github.dev");
  if (isCodespace) {
    const hostname = window.location.hostname;
    const codespaceDomain = hostname.replace("-3002", "-8000").replace("-3000", "-8000");
    return `https://${codespaceDomain}`;
  }

  return "http://127.0.0.1:8000";
}

function agentInvokeUrl(): string {
  return `${agentBaseUrl()}/agent/invoke`;
}

function agentStreamUrl(): string {
  return `${agentBaseUrl()}/agent/stream`;
}

/**
 * Ask the full Writer's Room crew to branch from a selected beat.
 *
 * The full, serializable canvas is sent as nodes + edges—not only the clicked
 * node—so the Architect and specialist critics can reason about continuity,
 * character, world rules, and pacing across the current story graph.
 */
export async function generatePlotBeat({
  roomId,
  selectedNode,
  nodes,
  edges,
}: GeneratePlotBeatInput): Promise<AgentGenerationResult> {
  const payload = {
    room_id: roomId,
    user_intent: `Draft a consequential next beat branching from "${selectedNode.title}". Preserve its established context while advancing the larger story.`,
    nodes,
    edges,
  };

  try {
    const response = await fetch(agentInvokeUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate plot beat: ${response.statusText} - ${errorText}`);
    }

    return (await response.json()) as AgentGenerationResult;
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

/** The agent personas the canvas dock knows how to light up. */
export type AgentName =
  | "architect"
  | "critic_character"
  | "critic_world"
  | "critic_continuity"
  | "critic_tension"
  | "merge"
  | "reviser";

/** A single server-sent event from POST /agent/stream. */
export type StreamEvent =
  | { event: "agent_start"; agent: AgentName; label: string }
  | { event: "agent_finish"; agent: AgentName; label: string }
  | {
      event: "critique";
      critic: string;
      decision: "APPROVE" | "REJECT";
      feedback: string;
      severity: "blocker" | "major" | "minor" | "ok";
    }
  | { event: "decision"; decision: "APPROVE" | "REJECT" }
  | { event: "nodes"; nodes: GeneratedStoryNode[]; by: string }
  | { event: "done"; nodes: GeneratedStoryNode[]; decision: "APPROVE" | "REJECT" | null; critic_results: AgentGenerationResult["critic_results"]; debate_feedback: string }
  | { event: "error"; message: string };

export type StreamRequest = {
  roomId: string;
  userIntent: string;
  nodes: CanvasNodePayload[];
  edges: CanvasEdgePayload[];
  /** RAG context: relevant story-bible facts retrieved by the caller. */
  storyFacts?: { category: string; content: string }[];
};

/**
 * Stream the live debate from POST /agent/stream.
 *
 * Uses fetch + ReadableStream (not EventSource) so we can send a JSON body.
 * Each parsed SSE event is passed to `onEvent`; the promise resolves when the
 * stream closes. The caller drives the agent dock and canvas from `onEvent`.
 */
export async function streamAgentDebate(
  request: StreamRequest,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(agentStreamUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room_id: request.roomId,
      user_intent: request.userIntent,
      nodes: request.nodes,
      edges: request.edges,
      story_facts: request.storyFacts ?? [],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to open debate stream: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // SSE frames are separated by a blank line. The backend (sse-starlette)
  // emits CRLF line endings, so we normalize to LF before splitting on "\n\n".
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Normalize CRLF and lone CR to LF for uniform frame splitting.
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      let eventName = "";
      let dataStr = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!eventName || !dataStr) continue;

      try {
        const data = JSON.parse(dataStr);
        onEvent({ event: eventName, ...data } as StreamEvent);
      } catch (err) {
        console.error("[SSE] Failed to process event:", eventName, err);
      }
    }
  }

  // Flush any remaining frame (some servers omit the trailing blank line).
  if (buffer.trim()) {
    let eventName = "";
    let dataStr = "";
    for (const line of buffer.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
    }
    if (eventName && dataStr) {
      try {
        const data = JSON.parse(dataStr);
        onEvent({ event: eventName, ...data } as StreamEvent);
      } catch (err) {
        console.error("[SSE] Failed to process final event:", eventName, err);
      }
    }
  }
}

/**
 * Seed a fresh story from a premise. Calls the crew with a premise intent so
 * the Architect lays down the opening beats and the critics vet them.
 */
export async function seedFromPremise({
  roomId,
  premise,
}: {
  roomId: string;
  premise: string;
}): Promise<AgentGenerationResult> {
  const response = await fetch(agentInvokeUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room_id: roomId,
      user_intent: `This is the premise of a new story: "${premise}". Lay down the opening 2-3 narrative beats that establish character, world, and the central tension.`,
      nodes: [],
      edges: [],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to seed story: ${response.statusText} - ${errorText}`);
  }
  return (await response.json()) as AgentGenerationResult;
}
