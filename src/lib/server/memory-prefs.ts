import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Prefs live one row per account, keyed `user:<id>`. */
export function prefsIdFor(userId: string): string {
  return `user:${userId}`;
}

export interface MemoryPrefs {
  paused: boolean;
  includeSensitive: boolean;
}

/** Load one account's memory prefs (defaults to all-off when unset). */
export async function getMemoryPrefs(userId: string): Promise<MemoryPrefs> {
  const row = await db.memoryPrefs.findUnique({ where: { id: prefsIdFor(userId) } });
  const data = (row?.data ?? {}) as Record<string, unknown>;
  return {
    paused: data.paused === true,
    includeSensitive: data.includeSensitive === true,
  };
}

export async function saveMemoryPrefs(
  userId: string,
  prefs: MemoryPrefs,
): Promise<void> {
  const id = prefsIdFor(userId);
  const data: Prisma.InputJsonValue = {
    paused: prefs.paused,
    includeSensitive: prefs.includeSensitive,
  };
  await db.memoryPrefs.upsert({
    where: { id },
    update: { data, userId },
    create: { id, data, userId },
  });
}
