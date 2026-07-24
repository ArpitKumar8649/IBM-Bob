/**
 * Export pipeline — compile the story graph into a screenplay and render it to
 * multiple industry formats: Fountain, PDF, Final Draft (.fdx), and plain text.
 *
 * The core is a format-agnostic `ScreenplayModel` (a list of typed elements).
 * Each renderer turns that model into a specific output. This keeps the
 * compilation logic in one place and makes adding formats trivial.
 *
 * PDF rendering uses jsPDF with industry-standard screenplay layout:
 * US Letter, Courier 12pt, ~1.5" left margin, 1" top/bottom/right.
 */

import { jsPDF } from "jspdf";
import type { StoryEdge, StoryNode } from "@/lib/canvas-types";

// --------------------------------------------------------------------------- //
// Screenplay model
// --------------------------------------------------------------------------- //

export type ScreenplayElementType =
  | "scene_heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "centered";

export interface ScreenplayElement {
  type: ScreenplayElementType;
  text: string;
}

export interface ScreenplayModel {
  title: string;
  author: string;
  date: string;
  elements: ScreenplayElement[];
}

// --------------------------------------------------------------------------- //
// Compilation: canvas -> model
// --------------------------------------------------------------------------- //

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

  for (const n of nodes) {
    if (!seen.has(n.id)) ordered.push(n);
  }
  return ordered;
}

/**
 * Compile the canvas into a format-agnostic screenplay model.
 */
export function buildScreenplayModel(
  nodes: StoryNode[],
  edges: StoryEdge[],
  title = "Untitled Story",
  author = "The Writers' Room"
): ScreenplayModel {
  const ordered = orderNodes(nodes, edges);
  const elements: ScreenplayElement[] = [];

  elements.push({ type: "transition", text: "FADE IN:" });

  for (const node of ordered) {
    const type = nodeType(node);
    const t = nodeTitle(node);
    const c = nodeContent(node);

    if (type === "location") {
      elements.push({ type: "scene_heading", text: `INT. ${t.toUpperCase()} - DAY` });
      if (c) elements.push({ type: "action", text: c });
    } else if (type === "character") {
      elements.push({ type: "action", text: `We meet ${t.toUpperCase()}.` });
      if (c) elements.push({ type: "action", text: c });
    } else if (type === "note") {
      elements.push({ type: "centered", text: `${t}: ${c}` });
    } else {
      elements.push({ type: "scene_heading", text: `EXT. ${t.toUpperCase()} - CONTINUOUS` });
      if (c) elements.push({ type: "action", text: c });
    }
  }

  elements.push({ type: "transition", text: "FADE OUT." });

  return {
    title,
    author,
    date: new Date().toISOString().slice(0, 10),
    elements,
  };
}

// --------------------------------------------------------------------------- //
// Renderers
// --------------------------------------------------------------------------- //

/** Escape a line for Fountain (prefix leading special chars). */
function fountainEscape(text: string): string {
  return text.replace(/^([@#.*_=\[<~\\])/g, "\\$1");
}

/** Render the model as Fountain text. */
export function toFountain(model: ScreenplayModel): string {
  const lines: string[] = [];
  lines.push(`Title: ${model.title}`);
  lines.push(`Credit: Written with ${model.author}`);
  lines.push(`Draft date: ${model.date}`);
  lines.push("");
  lines.push("===");
  lines.push("");

  for (const el of model.elements) {
    switch (el.type) {
      case "scene_heading":
        lines.push(el.text.toUpperCase());
        lines.push("");
        break;
      case "action":
        lines.push(fountainEscape(el.text));
        lines.push("");
        break;
      case "character":
        lines.push(el.text.toUpperCase());
        break;
      case "parenthetical":
        lines.push(`(${el.text})`);
        break;
      case "dialogue":
        lines.push(el.text);
        lines.push("");
        break;
      case "transition":
        lines.push(`> ${el.text}`);
        lines.push("");
        break;
      case "centered":
        lines.push(`> ${fountainEscape(el.text)} <`);
        lines.push("");
        break;
    }
  }
  return lines.join("\n");
}

/** XML-escape for Final Draft (.fdx). */
function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FDX_TYPE_MAP: Record<ScreenplayElementType, string> = {
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
  centered: "Action", // FDX has no centered; render as action
};

/** Render the model as Final Draft XML (.fdx). */
export function toFDX(model: ScreenplayModel): string {
  const paragraphs = model.elements
    .map((el) => {
      const type = FDX_TYPE_MAP[el.type];
      return `      <Paragraph Type="${type}">\n        <Text>${xmlEscape(el.text)}</Text>\n      </Paragraph>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${paragraphs}
  </Content>
  <TitlePage>
    <Content>
      <Paragraph Type="General">
        <Text Align="Center">${xmlEscape(model.title)}</Text>
      </Paragraph>
      <Paragraph Type="General">
        <Text Align="Center">Written with ${xmlEscape(model.author)}</Text>
      </Paragraph>
      <Paragraph Type="General">
        <Text Align="Center">${xmlEscape(model.date)}</Text>
      </Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>
`;
}

/** Render the model as plain text (readable, monospaced-friendly). */
export function toPlainText(model: ScreenplayModel): string {
  const lines: string[] = [];
  lines.push(model.title.toUpperCase());
  lines.push(`by ${model.author}`);
  lines.push(model.date);
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("");

  for (const el of model.elements) {
    switch (el.type) {
      case "scene_heading":
        lines.push("");
        lines.push(el.text.toUpperCase());
        lines.push("");
        break;
      case "action":
        lines.push(el.text);
        lines.push("");
        break;
      case "character":
        lines.push("                    " + el.text.toUpperCase());
        break;
      case "parenthetical":
        lines.push("               (" + el.text + ")");
        break;
      case "dialogue":
        lines.push("          " + el.text);
        lines.push("");
        break;
      case "transition":
        lines.push("                                        " + el.text);
        lines.push("");
        break;
      case "centered":
        lines.push("          " + el.text);
        lines.push("");
        break;
    }
  }
  return lines.join("\n");
}

// --------------------------------------------------------------------------- //
// PDF rendering (industry-standard screenplay layout)
// --------------------------------------------------------------------------- //

// US Letter in points (72 pt/inch). Margins per screenplay convention.
const PAGE_W = 612; // 8.5in
const PAGE_H = 792; // 11in
const MARGIN_LEFT = 108; // 1.5in
const MARGIN_RIGHT = 72; // 1in
const MARGIN_TOP = 72; // 1in
const MARGIN_BOTTOM = 72; // 1in
const LINE_HEIGHT = 14.4; // 12pt Courier, single-spaced-ish
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

/** Indents (from left margin) and max widths per element type, in points. */
const LAYOUT: Record<
  ScreenplayElementType,
  { indent: number; width: number }
> = {
  scene_heading: { indent: 0, width: CONTENT_W },
  action: { indent: 0, width: CONTENT_W },
  character: { indent: 158, width: CONTENT_W - 158 }, // ~2.2in from left
  parenthetical: { indent: 108, width: CONTENT_W - 144 },
  dialogue: { indent: 72, width: CONTENT_W - 108 }, // ~1in indent, 3.5in wide
  transition: { indent: CONTENT_W - 108, width: 108 }, // right-aligned-ish
  centered: { indent: 0, width: CONTENT_W },
};

/** Wrap text to fit a width (in points) using the PDF's current font metrics. */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/** Render the model as a PDF (US Letter, Courier 12pt, screenplay margins). */
export function toPDF(model: ScreenplayModel): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFont("courier", "normal");
  doc.setFontSize(12);

  // ---- Title page ----
  doc.setFont("courier", "bold");
  const titleLines = wrapText(doc, model.title.toUpperCase(), CONTENT_W);
  let ty = PAGE_H / 2 - 40;
  titleLines.forEach((line) => {
    doc.text(line, PAGE_W / 2, ty, { align: "center" });
    ty += LINE_HEIGHT;
  });
  doc.setFont("courier", "normal");
  doc.text(`by ${model.author}`, PAGE_W / 2, ty + 24, { align: "center" });
  doc.text(model.date, PAGE_W / 2, ty + 48, { align: "center" });
  doc.text("Written with The Writers' Room", PAGE_W / 2, PAGE_H - MARGIN_BOTTOM, {
    align: "center",
  });

  // ---- Body ----
  doc.addPage();
  doc.setFont("courier", "normal");
  let y = MARGIN_TOP;

  const newPageIfNeeded = (linesNeeded: number) => {
    if (y + linesNeeded * LINE_HEIGHT > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      doc.setFont("courier", "normal");
      y = MARGIN_TOP;
    }
  };

  for (const el of model.elements) {
    const layout = LAYOUT[el.type];
    const isBold = el.type === "scene_heading";
    doc.setFont("courier", isBold ? "bold" : "normal");

    const text = el.type === "scene_heading" ? el.text.toUpperCase() : el.text;
    const lines = wrapText(doc, text, layout.width);

    // Extra space before scene headings and after dialogue blocks.
    if (el.type === "scene_heading") {
      y += LINE_HEIGHT;
    }

    newPageIfNeeded(lines.length);

    for (const line of lines) {
      doc.text(line, MARGIN_LEFT + layout.indent, y);
      y += LINE_HEIGHT;
    }

    // Blank line after most elements.
    if (el.type !== "character" && el.type !== "parenthetical") {
      y += LINE_HEIGHT;
    }
  }

  return doc;
}

// --------------------------------------------------------------------------- //
// Download helpers
// --------------------------------------------------------------------------- //

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "screenplay";
}

export type ExportFormat = "fountain" | "pdf" | "fdx" | "text";

/**
 * Export the screenplay model to the given format and trigger a download.
 */
export function exportScreenplay(model: ScreenplayModel, format: ExportFormat): void {
  const base = slugify(model.title);
  switch (format) {
    case "fountain":
      downloadBlob(toFountain(model), `${base}.fountain`, "text/plain;charset=utf-8");
      break;
    case "pdf":
      toPDF(model).save(`${base}.pdf`);
      break;
    case "fdx":
      downloadBlob(toFDX(model), `${base}.fdx`, "application/xml;charset=utf-8");
      break;
    case "text":
      downloadBlob(toPlainText(model), `${base}.txt`, "text/plain;charset=utf-8");
      break;
  }
}
