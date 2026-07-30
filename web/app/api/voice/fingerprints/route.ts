import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureRoom } from "@/lib/room";

/**
 * Voice fingerprint API — persistence for a locked character voice.
 *
 * POST   /api/voice/fingerprints                     — upsert a locked voice
 * GET    /api/voice/fingerprints?roomId=             — list a room's voices (no metrics)
 * GET    /api/voice/fingerprints?roomId=&full=1      — list them with the judging payload
 * GET    /api/voice/fingerprints?roomId=&character=  — one voice, with metrics
 * DELETE /api/voice/fingerprints?roomId=&character=  — remove one voice
 *
 * The measurement lives in FastAPI (POST /voice/lock) and the canvas graph
 * lives in the browser, so this route never computes a fingerprint — it stores
 * the one the writer locked and hands it back verbatim for /voice/check. The
 * numbers are deliberately frozen at lock time: recomputing them on read would
 * let later canvas edits move the baseline a line is being judged against.
 *
 * `character` is stored lowercased as the lookup key, with the writer's own
 * capitalization kept in `displayName` — so "O'Brien" renders correctly while
 * "o'brien" still finds it.
 */

const metricsSchema = z.record(z.string(), z.number());

const lockSchema = z.object({
  roomId: z.string().min(1).max(80),
  character: z.string().min(1).max(80),
  metrics: metricsSchema,
  registerLabel: z.string().min(1).max(60),
  description: z.string().max(400),
  vocabularyDomain: z.string().max(120),
  signaturePhrases: z.array(z.string().min(1).max(80)).max(10),
  neverSays: z.array(z.string().min(1).max(60)).max(20),
  sampleLines: z.number().int().min(0),
  sampleTokens: z.number().int().min(0),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = lockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { roomId, character, ...fields } = parsed.data;
    const displayName = character.trim();
    const key = displayName.toLowerCase();

    await ensureRoom(roomId);

    // Upsert, not create: re-locking a voice after writing more dialogue is the
    // normal case, so this returns 200 rather than a 201 that would be a lie on
    // the second lock.
    const row = await prisma.voiceFingerprint.upsert({
      where: { roomId_character: { roomId, character: key } },
      update: { ...fields, displayName, lockedAt: new Date() },
      create: { roomId, character: key, displayName, ...fields },
    });

    return NextResponse.json({
      id: row.id,
      roomId,
      character: key,
      displayName: row.displayName,
      lockedAt: row.lockedAt,
    });
  } catch (error) {
    console.error("Lock voice error:", error);
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

    const character = searchParams.get("character");
    if (character) {
      // The single-voice read is what feeds /voice/check, so it must include
      // metrics, neverSays and signaturePhrases — the whole judging payload.
      const voice = await prisma.voiceFingerprint.findUnique({
        where: { roomId_character: { roomId, character: character.trim().toLowerCase() } },
      });
      if (!voice) {
        return NextResponse.json(
          { error: "No locked voice for that character" },
          { status: 404 }
        );
      }
      return NextResponse.json(voice);
    }

    // The list view omits metrics the way /api/bible/facts omits embedding:
    // it is a 14-key blob per row and the UI only needs the label + confidence.
    //
    // `full=1` opts back in, because one caller does need every row's judging
    // payload at once: the debate posts a room's locks to /agent/stream so the
    // Character Lead can measure the draft against them. Doing that with the
    // single-voice read would be one round trip per locked character on every
    // generation.
    const full = searchParams.get("full") === "1";
    const voices = await prisma.voiceFingerprint.findMany({
      where: { roomId },
      orderBy: { lockedAt: "desc" },
      select: {
        id: true,
        character: true,
        displayName: true,
        registerLabel: true,
        vocabularyDomain: true,
        sampleLines: true,
        sampleTokens: true,
        lockedAt: true,
        ...(full ? { metrics: true, signaturePhrases: true, neverSays: true } : {}),
      },
    });

    return NextResponse.json({ voices });
  } catch (error) {
    console.error("List voices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const character = searchParams.get("character");
    if (!roomId || !character) {
      return NextResponse.json(
        { error: "roomId and character required" },
        { status: 400 }
      );
    }

    // Scoped by room on purpose, and deleteMany so a missing row is a
    // deleted: 0 rather than a Prisma P2025 surfacing as a 500.
    const result = await prisma.voiceFingerprint.deleteMany({
      where: { roomId, character: character.trim().toLowerCase() },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error("Delete voice error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
