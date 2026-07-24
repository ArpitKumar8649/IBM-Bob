import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { embed } from "@/lib/embeddings";
import { ensureRoom } from "@/lib/room";

/**
 * Story Bible API — persistent world knowledge with embeddings for RAG.
 *
 * POST   /api/bible/facts        — add a fact (embeds it automatically)
 * GET    /api/bible/facts?roomId — list all facts for a room
 * DELETE /api/bible/facts?id=    — delete a fact
 */

const addFactSchema = z.object({
  roomId: z.string().min(1),
  category: z.enum(["character", "location", "lore", "rule", "event"]),
  content: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = addFactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { roomId, category, content } = parsed.data;
    await ensureRoom(roomId);
    const embedding = await embed(content);

    const fact = await prisma.storyFact.create({
      data: { roomId, category, content, embedding },
    });

    return NextResponse.json(
      { id: fact.id, roomId, category, content },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add fact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) {
      return NextResponse.json({ error: "roomId required" }, { status: 400 });
    }

    const facts = await prisma.storyFact.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, content: true, createdAt: true },
    });

    return NextResponse.json({ facts });
  } catch (error) {
    console.error("List facts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.storyFact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete fact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
