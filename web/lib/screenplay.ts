/**
 * Director's Cut — compile the spatial story graph into a linear screenplay.
 *
 * The canvas is a non-linear map of beats, characters, and locations. This
 * module linearizes it into a Fountain-formatted screenplay: it topologically
 * walks the graph from the root beats, emits scene headings from location/beat
 * nodes, introduces characters, and lays out the action. The result downloads
 * as a `.fountain` file — the demo's payoff moment.
 *
 * Fountain is a plain-text screenplay format (https://fountain.io) that renders
 * to industry-standard layout in any Fountain tool.
 */

import type { StoryEdge, StoryNode } from "@/lib/canvas-types";

function nodeTitle(n: StoryNode): string {
  return (n.data.title || "Untitled").trim();
}

function nodeContent(n: StoryNode): string {
  return (n.data.content || "").trim();
}

function nodeType(n: StoryNode): string {
  return n.data.node_type || n.type || "plot_beat";
}

/** Topologically order nodes by following edges; orphans appended at the end. */
function orderNodes(nodes: StoryNode[], edges: StoryEdge[]): StoryNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const n of nodes) {
    outgoing.set(n.id, []);
    indegree.set(n.id, 0);
  }
  for (const e of edges) {
    if (byId.has(e.source) && byId.has(e.target)) {
      outgoing.get(e.source)!.push(e.target);
      indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm, seeded with zero-indegree nodes (the story's roots).
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const ordered: StoryNode[] = [];
  const seen = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) ordered.push(node);
    for (const next of outgoing.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if ((indegree.get(next) ?? 0) <= 0) queue.push(next);
    }
  }

  // Append any nodes the graph never reached (disconnected ideas).
  for (const n of nodes) {
    if (!seen.has(n.id)) ordered.push(n);
  }
  return ordered;
}

/** Fountain-escape a line (prefix special chars with a backslash). */
function escapeLine(text: string): string {
  return text.replace(/^([@#.*_=\[<~\\])/g, "\\$1");
}

/**
 * Compile the canvas into a Fountain screenplay string.
 *
 * @param title The screenplay title (shown on the title page).
 */
export function compileScreenplay(
  nodes: StoryNode[],
  edges: StoryEdge[],
  title = "Untitled Story"
): string {
  const ordered = orderNodes(nodes, edges);
  const lines: string[] = [];

  // Title page.
  lines.push(`Title: ${title}`);
  lines.push("Credit: Written with The Writers' Room");
  lines.push("Draft date: " + new Date().toISOString().slice(0, 10));
  lines.push("");
  lines.push("===");
  lines.push("");

  let sceneNumber = 0;
  for (const node of ordered) {
    const type = nodeType(node);
    const t = nodeTitle(node);
    const c = nodeContent(node);

    if (type === "location") {
      // A location becomes a scene heading.
      sceneNumber += 1;
      lines.push(`INT. ${t.toUpperCase()} - DAY`);
      lines.push("");
      if (c) {
        lines.push(escapeLine(c));
        lines.push("");
      }
    } else if (type === "character") {
      // A character node becomes an introduction action line.
      lines.push(`We meet ${t.toUpperCase()}.`);
      if (c) lines.push(escapeLine(c));
      lines.push("");
    } else if (type === "note") {
      // Notes become centered synopsis (bracketed in Fountain).
      lines.push(`> ${escapeLine(`${t}: ${c}`)}`);
      lines.push("");
    } else {
      // plot_beat — the spine of the screenplay.
      sceneNumber += 1;
      lines.push(`EXT. ${t.toUpperCase()} - CONTINUOUS`);
      lines.push("");
      if (c) {
        lines.push(escapeLine(c));
        lines.push("");
      }
    }
  }

  lines.push("FADE OUT.");
  lines.push("");
  return lines.join("\n");
}

/** Trigger a browser download of the compiled screenplay as a .fountain file. */
export function downloadScreenplay(fountain: string, filename = "screenplay.fountain") {
  const blob = new Blob([fountain], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
