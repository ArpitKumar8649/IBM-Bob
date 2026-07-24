import { prisma } from "@/lib/prisma";

/**
 * Ensure a Room row exists for the given id.
 *
 * The canvas works with ad-hoc room ids (e.g. "demo", or a slug from the URL)
 * that may not correspond to a row in the `rooms` table. Story-bible facts and
 * other per-room data have a foreign key to `rooms`, so we lazily provision a
 * room the first time we touch it.
 *
 * For now the room is owned by a shared "demo" user (also lazily created).
 * Once real auth + room ownership is wired up, this becomes the place to
 * attach the room to the signed-in user.
 */
export async function ensureRoom(roomId: string): Promise<void> {
  const existing = await prisma.room.findUnique({ where: { id: roomId } });
  if (existing) return;

  // Lazily provision a shared demo owner.
  const owner = await prisma.user.upsert({
    where: { email: "demo@writersroom.local" },
    update: {},
    create: {
      email: "demo@writersroom.local",
      name: "Demo Writer",
    },
  });

  await prisma.room.upsert({
    where: { id: roomId },
    update: {},
    create: {
      id: roomId,
      title: roomId,
      ownerId: owner.id,
    },
  });
}
