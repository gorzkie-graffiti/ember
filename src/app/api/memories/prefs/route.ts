import { authGuard } from '@/lib/auth/server'
import { getMemoryPrefs, saveMemoryPrefs } from '@/lib/server/memory-prefs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { user, response } = await authGuard()
  if (!user) return response

  try {
    return Response.json(await getMemoryPrefs(user.id))
  } catch (err) {
    console.error('[api/memories/prefs] GET failed:', err)
    return Response.json({ error: 'Failed to load memory prefs.' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const { user, response } = await authGuard()
  if (!user) return response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const body = (raw ?? {}) as Record<string, unknown>
  const patch: { paused?: boolean; includeSensitive?: boolean } = {}
  if (typeof body.paused === 'boolean') patch.paused = body.paused
  if (typeof body.includeSensitive === 'boolean') patch.includeSensitive = body.includeSensitive

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'No valid pref fields provided.' }, { status: 400 })
  }

  try {
    const current = await getMemoryPrefs(user.id)
    const next = { ...current, ...patch }
    await saveMemoryPrefs(user.id, next)
    return Response.json({ ok: true, prefs: next })
  } catch (err) {
    console.error('[api/memories/prefs] PUT failed:', err)
    return Response.json({ error: 'Failed to save memory prefs.' }, { status: 500 })
  }
}
