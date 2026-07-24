import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embed, cosineSimilarity } from "@/lib/embeddings";

/**
 * Story Bible semantic search — the RAG retrieval step.
 *
 * GET /api/bible/search?roomId=...&q=...&k=5
 *
 * Embeds the query, fetches all facts for the room, ranks by cosine
 * similarity, and returns the top-K. This is what gets injected into the
 * agent context so every agent "knows" the established world.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const q = searchParams.get("q");
    const k = parseInt(searchParams.get("k") || "5", 10);

    if (!roomId || !q) {
      return NextResponse.json(
        { error: "roomId and q are required" },
        { status: 400 }
      );
    }

    // Embed the query.
    const queryVec = await embed(q);

    // Fetch all facts for the room (with embeddings).
    const facts = await prisma.storyFact.findMany({
      where: { roomId },
      select: {
        id: true,
        category: true,
        content: true,
        embedding: true,
      },
    });

    // Rank by cosine similarity.
    const scored = facts
      .map((f) => ({
        id: f.id,
        category: f.category,
        content: f.content,
        score: cosineSimilarity(queryVec, f.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return NextResponse.json({ results: scored });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
