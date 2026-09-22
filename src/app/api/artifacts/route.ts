import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { authGuard } from '@/lib/auth/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Accepts the contract shape `{ artifact: doc }` or, tolerantly, a bare doc
 * with a string `id`. Returns the Prisma-ready upsert payload.
 */
function extractDoc(body: unknown): { id: string; data: Prisma.InputJsonValue } | null {
  if (!isRecord(body)) return null
  const candidate = isRecord(body.artifact) ? body.artifact : typeof body.id === 'string' ? body : null
  if (!candidate || typeof candidate.id !== 'string' || candidate.id.length === 0) return null
  return {
    id: candidate.id,
    data: candidate as Prisma.InputJsonValue,
  }
}

export async function GET() {
  const { user, response } = await authGuard()
  if (!user) return response

  try {
    const rows = await db.artifact.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ artifacts: rows.map((row) => row.data) })
  } catch (err) {
    console.error('[api/artifacts] GET failed:', err)
    return Response.json({ error: 'Failed to load artifacts.' }, { status: 500 })
  }
}

async function upsert(req: Request, userId: string): Promise<Response> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const doc = extractDoc(raw)
  if (!doc) {
    return Response.json({ error: 'Invalid payload: expected { artifact: { id: string, ... } }.' }, { status: 400 })
  }

  try {
    const existing = await db.artifact.findUnique({
      where: { id: doc.id },
      select: { userId: true },
    })
    if (existing && existing.userId !== userId) {
      return Response.json({ error: 'Artifact belongs to another account.' }, { status: 403 })
    }

    await db.artifact.upsert({
      where: { id: doc.id },
      update: { data: doc.data, userId },
      create: { id: doc.id, data: doc.data, userId },
    })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/artifacts] upsert failed:', err)
    return Response.json({ error: 'Failed to save artifact.' }, { status: 500 })
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
    await db.artifact.deleteMany({ where: { id, userId: user.id } })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/artifacts] DELETE failed:', err)
    return Response.json({ error: 'Failed to delete artifact.' }, { status: 500 })
  }
}
