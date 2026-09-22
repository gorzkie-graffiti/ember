import { db } from "@/lib/db";
import { authGuard } from "@/lib/auth/server";
import { PROVIDER_IDS, getProvider } from "@/lib/models/providers";
import { getProviderEnvVar } from "@/lib/server/provider-gateways";
import type { ProviderId } from "@/lib/models/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KEY_LENGTH = 400;

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as string[]).includes(value);
}

function maskHint(key: string): string {
  const tail = key.slice(-4);
  return `••••${tail}`;
}

function personalKeys(raw: unknown): Partial<Record<ProviderId, string>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<ProviderId, string>> = {};
  for (const [provider, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isProviderId(provider) && typeof value === "string" && value.trim()) {
      out[provider] = value.trim();
    }
  }
  return out;
}

/**
 * GET /api/keys — which providers this account can use, and where the key
 * comes from. Key VALUES are never returned; only a last-4 hint.
 */
export async function GET() {
  const { user, response } = await authGuard();
  if (!user) return response;

  const personal = personalKeys(
    (await db.user.findUnique({ where: { id: user.id }, select: { keys: true } }))?.keys,
  );

  const providers = PROVIDER_IDS.map((id) => {
    const mine = personal[id];
    const shared = (process.env[getProviderEnvVar(id) ?? ""] ?? "").trim().length > 0;
    const source: "personal" | "shared" | "none" = mine
      ? "personal"
      : shared
        ? "shared"
        : "none";
    return {
      id,
      name: getProvider(id).name,
      accent: getProvider(id).accent,
      envVar: getProviderEnvVar(id),
      source,
      hint: mine ? maskHint(mine) : null,
      live: source !== "none",
    };
  });

  return Response.json({ providers });
}

/** PUT /api/keys — { provider, key }. An empty key clears the personal key. */
export async function PUT(req: Request) {
  const { user, response } = await authGuard();
  if (!user) return response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (raw ?? {}) as { provider?: unknown; key?: unknown };
  if (!isProviderId(body.provider)) {
    return Response.json({ error: "Unknown provider." }, { status: 400 });
  }
  if (typeof body.key !== "string") {
    return Response.json({ error: "Field 'key' must be a string." }, { status: 400 });
  }
  const key = body.key.trim();
  if (key.length > MAX_KEY_LENGTH) {
    return Response.json({ error: "That key is implausibly long." }, { status: 400 });
  }

  try {
    const row = await db.user.findUnique({ where: { id: user.id }, select: { keys: true } });
    const next: Record<string, string> = { ...personalKeys(row?.keys) };
    if (key.length === 0) {
      delete next[body.provider];
    } else {
      next[body.provider] = key;
    }
    await db.user.update({ where: { id: user.id }, data: { keys: next } });
    return Response.json({ ok: true, provider: body.provider, cleared: key.length === 0 });
  } catch (err) {
    console.error("[api/keys] PUT failed:", err);
    return Response.json({ error: "Failed to save the key." }, { status: 500 });
  }
}

/** DELETE /api/keys?provider=groq — removes one personal key. */
export async function DELETE(req: Request) {
  const { user, response } = await authGuard();
  if (!user) return response;

  const provider = new URL(req.url).searchParams.get("provider");
  if (!isProviderId(provider)) {
    return Response.json({ error: "Unknown provider." }, { status: 400 });
  }

  try {
    const row = await db.user.findUnique({ where: { id: user.id }, select: { keys: true } });
    const next: Record<string, string> = { ...personalKeys(row?.keys) };
    delete next[provider];
    await db.user.update({ where: { id: user.id }, data: { keys: next } });
    return Response.json({ ok: true, provider });
  } catch (err) {
    console.error("[api/keys] DELETE failed:", err);
    return Response.json({ error: "Failed to remove the key." }, { status: 500 });
  }
}
