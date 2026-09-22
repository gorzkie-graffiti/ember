import { db } from '@/lib/db'
import {
  buildExtractionSystemPrompt,
  parseExtractionResponse,
  screenMemoryContent,
  SENSITIVE_PATTERNS,
  matchesAny,
  MAX_MEMORY_ENTRIES,
} from '@/lib/memory'
import {
  pickLiveCurator,
  runCuratorCompletion,
} from '@/lib/server/curator'
import { authGuard } from '@/lib/auth/server'
import { getMemoryPrefs } from '@/lib/server/memory-prefs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Claude-style memory extraction.
 *
 * The client POSTs the last user/assistant exchange; the server runs a small
 * "curator" model to decide which durable facts about the user are worth
 * keeping, applies the sensitive-topic + hard-never gates, dedupes against
 * existing memory, and writes survivors directly to the DB. The client never
 * decides what gets remembered — mirroring how Claude captures memory
 * server-side while keeping the user's stored list authoritative.
 *
 * Everything is scoped to the signed-in account, and the curator model's key
 * resolution prefers that account's own provider keys.
 */

interface ExtractBody {
  messages?: Array<{ role?: unknown; content?: unknown }>
  /** User messages only, for sensitive-topic detection on the client path. */
  userText?: unknown
}

export async function GET() {
  const { user, response } = await authGuard()
  if (!user) return response

  // Lightweight health/prefs probe so the client can avoid pointless work.
  const prefs = await getMemoryPrefs(user.id)
  return Response.json({ ok: true, ...prefs })
}

export async function POST(req: Request) {
  const { user, response } = await authGuard()
  if (!user) return response

  let body: ExtractBody
  try {
    body = (await req.json()) as ExtractBody
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const prefs = await getMemoryPrefs(user.id)
  if (prefs.paused) return Response.json({ ok: true, saved: 0, reason: 'paused' })

  const messages = Array.isArray(body.messages) ? body.messages : []
  const exchange = messages
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))

  if (exchange.length === 0) {
    return Response.json({ ok: true, saved: 0, reason: 'empty' })
  }

  // Client-supplied user text drives the sensitive notice decision, but the
  // server re-checks everything itself before saving (authoritative).
  const userText =
    typeof body.userText === 'string' ? body.userText : ''
  const touchedSensitive = userText
    ? matchesAny(userText, SENSITIVE_PATTERNS)
    : false

  let completion = ''
  try {
    const result = await runCuratorCompletion(
      buildExtractionSystemPrompt(prefs.includeSensitive),
      exchange
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n'),
      { maxTokens: 600, timeoutMs: 20_000, keys: user.keys },
    )
    if (result === null) {
      return Response.json({
        ok: true,
        saved: 0,
        reason: pickLiveCurator(user.keys) ? 'curator-error' : 'no-provider',
      })
    }
    completion = result
  } catch {
    return Response.json({ ok: true, saved: 0, reason: 'curator-error' })
  }

  const candidates = parseExtractionResponse(completion)
  if (candidates.length === 0) {
    // Nothing durable found — NOT an error, but report why for debugging.
    return Response.json({
      ok: true,
      saved: 0,
      reason: 'no-candidates',
      touchedSensitive,
      raw: completion.slice(0, 400),
    })
  }

  try {
    const existing = await db.memoryEntry.findMany({ where: { userId: user.id } })
    const existingTexts = existing
      .map((r) => {
        const d = r.data as Record<string, unknown>
        return typeof d.content === 'string' ? d.content.toLowerCase() : ''
      })
      .filter(Boolean)

    let saved = 0
    const rejectedSensitive: string[] = []

    for (const raw of candidates) {
      // Server-side gates — identical rules to the client path.
      const screen = screenMemoryContent(raw, prefs.includeSensitive)
      if (screen === 'hard-never') continue
      if (screen === 'sensitive') {
        rejectedSensitive.push(raw)
        continue
      }

      // Dedupe: substring match against existing entries either direction.
      const lower = raw.toLowerCase()
      const isDupe = existingTexts.some(
        (t) => t.includes(lower) || lower.includes(t),
      )
      if (isDupe) continue

      // Simple category guess server-side (same buckets as the UI).
      const category = guessCategory(lower)

      const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const count = await db.memoryEntry.count({ where: { userId: user.id } })
      if (count >= MAX_MEMORY_ENTRIES) {
        // SQLite has no JSON path filters — curate in JS (max 60 rows).
        const all = await db.memoryEntry.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
        })
        const oldestAuto = all.find(
          (r) => (r.data as Record<string, unknown>).source === 'auto',
        )
        if (oldestAuto) await db.memoryEntry.delete({ where: { id: oldestAuto.id } })
      }

      await db.memoryEntry.create({
        data: {
          id,
          userId: user.id,
          data: {
            id,
            category,
            content: raw,
            source: 'auto',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      })
      existingTexts.push(lower)
      saved += 1
    }

    return Response.json({
      ok: true,
      saved,
      touchedSensitive,
      rejectedSensitive: rejectedSensitive.length,
      ...(saved === 0 ? { reason: 'all-duplicates-or-blocked' } : {}),
    })
  } catch (err) {
    console.error('[api/memories/extract] save failed:', err)
    return Response.json({ error: 'Failed to save extracted memories.' }, { status: 500 })
  }
}

function guessCategory(lower: string): string {
  if (/\b(name is|my name|call me|lives in|based in)\b/.test(lower)) return 'people'
  if (/\b(prefer|like|dislike|hate|concise|short|verbose|style|tone)\b/.test(lower)) return 'preferences'
  if (/\b(work|job|role|team|company|title|colleague|boss)\b/.test(lower)) return 'work-role'
  if (/\b(project|building|app|prototype|migration|startup)\b/.test(lower)) return 'projects'
  if (/\b(typescript|python|react|rust|go|linux|mac|windows|stack|tool|editor|neovim|vscode)\b/.test(lower)) return 'technical'
  if (/\b(friend|wife|husband|partner|mother|father|sister|brother|lives in|based in|city|country)\b/.test(lower)) return 'people'
  return 'preferences'
}
