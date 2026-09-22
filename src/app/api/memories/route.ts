import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  MAX_MEMORY_ENTRIES,
  MAX_MEMORY_CONTENT_LENGTH,
  MEMORY_CATEGORIES,
  screenMemoryContent,
} from '@/lib/memory'
import { authGuard } from '@/lib/auth/server'
import { getMemoryPrefs } from '@/lib/server/memory-prefs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Whitelist-sanitize a memory document. The client may only set these five
 * fields; everything else in the payload is dropped (defense in depth — the
 * DB is a JSON blob, so we control the shape at the boundary).
 */
function sanitizeMemoryDoc(raw: unknown): {
  ok: true
  id: string
  data: Prisma.InputJsonValue
} | { ok: false; reason: 'sensitive' | 'hard-never' | 'invalid' } {
  if (!isRecord(raw)) return { ok: false, reason: 'invalid' }
  const candidate = isRecord(raw.memory) ? raw.memory : raw
  if (typeof candidate.id !== 'string' || candidate.id.length === 0 || candidate.id.length > 80) {
    return { ok: false, reason: 'invalid' }
  }

  const content = cleanString(candidate.content, MAX_MEMORY_CONTENT_LENGTH)
  if (content.length < 2) return { ok: false, reason: 'invalid' }

  const includeSensitive = candidate.includeSensitive === true
  const screen = screenMemoryContent(content, includeSensitive)
  if (screen) return { ok: false, reason: screen }

  const category = MEMORY_CATEGORIES.includes(candidate.category as never)
    ? (candidate.category as string)
    : 'preferences'
  const source = candidate.source === 'auto' ? 'auto' : 'user'
  const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now()

  return {
    ok: true,
    id: candidate.id,
    data: {
      id: candidate.id,
      category,
      content,
      source,
      createdAt,
      updatedAt: Date.now(),
    },
  }
}

export async function GET() {
  const { user, response } = await authGuard()
  if (!user) return response

  try {
    const [rows, prefs] = await Promise.all([
      db.memoryEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
      getMemoryPrefs(user.id),
    ])
    return Response.json({
      memories: rows.map((row) => row.data),
      prefs,
    })
  } catch (err) {
    console.error('[api/memories] GET failed:', err)
    return Response.json({ error: 'Failed to load memories.' }, { status: 500 })
  }
}

async function upsert(req: Request, userId: string): Promise<Response> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const doc = sanitizeMemoryDoc(raw)
  if (!doc.ok) {
    if (doc.reason === 'hard-never') {
      return Response.json(
        { error: 'This kind of information is never saved to memory.' },
        { status: 422 },
      )
    }
    if (doc.reason === 'sensitive') {
      return Response.json(
        { error: 'Sensitive topics are excluded from memory. Enable "Include sensitive topics" in Memory settings to save this.' },
        { status: 422 },
      )
    }
    return Response.json(
      { error: 'Invalid payload: expected { memory: { id, content, ... } }.' },
      { status: 400 },
    )
  }

  try {
    const existing = await db.memoryEntry.findUnique({
      where: { id: doc.id },
      select: { userId: true },
    })
    if (existing && existing.userId !== userId) {
      return Response.json({ error: 'Memory belongs to another account.' }, { status: 403 })
    }

    const count = await db.memoryEntry.count({ where: { userId } })
    if (count >= MAX_MEMORY_ENTRIES) {
      // Curate like Claude: drop the oldest auto-captured entry to make room.
      // SQLite has no JSON path filters — find it in JS (max 60 rows).
      const all = await db.memoryEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      const oldestAuto = all.find(
        (r) => (r.data as Record<string, unknown>).source === 'auto',
      )
      if (oldestAuto) await db.memoryEntry.delete({ where: { id: oldestAuto.id } })
    }

    await db.memoryEntry.upsert({
      where: { id: doc.id },
      update: { data: doc.data, userId },
      create: { id: doc.id, data: doc.data, userId },
    })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/memories] upsert failed:', err)
    return Response.json({ error: 'Failed to save memory.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { user, response } = await authGuard()
  if (!user) return response
  return upsert(req, user.id)
}

export async function PUT(req: Request) {
  const { user, response } = await authGuard()
  if (!user) return response
  return upsert(req, user.id)
}

export async function DELETE(req: Request) {
  const { user, response } = await authGuard()
  if (!user) return response

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return Response.json({ error: "Missing required query param 'id'." }, { status: 400 })
  }
  try {
    if (id === 'all') {
      // Claude's "Reset memory": permanently delete everything for this account.
      await db.memoryEntry.deleteMany({ where: { userId: user.id } })
    } else {
      await db.memoryEntry.deleteMany({ where: { id, userId: user.id } })
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/memories] DELETE failed:', err)
    return Response.json({ error: 'Failed to delete memory.' }, { status: 500 })
  }
}
