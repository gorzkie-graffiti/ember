/**
 * Server-side auth helpers (Node runtime).
 *
 * `getAuthUser()` verifies the session cookie AND re-reads the account from
 * the database, so an admin revoking someone (or un-approving them) takes
 * effect on that person's very next request.
 */
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { ProviderId } from "@/lib/models/types";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type AccountRole,
  type AccountStatus,
} from "./token";

export interface AuthUser {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  reason: string;
  createdAt: Date;
  /** Per-user provider keys, provider id → key. */
  keys: Partial<Record<ProviderId, string>>;
}

function parseKeys(raw: unknown): Partial<Record<ProviderId, string>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<ProviderId, string>> = {};
  for (const [provider, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim().length > 0) {
      out[provider as ProviderId] = value.trim();
    }
  }
  return out;
}

/** The signed-in account, or null. */
export async function getAuthUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  try {
    const row = await db.user.findUnique({ where: { id: payload.uid } });
    if (!row) return null;
    // Revoked / un-approved accounts lose access immediately.
    if (row.status !== "approved") return null;
    return {
      id: row.id,
      email: row.email,
      role: row.role === "admin" ? "admin" : "user",
      status: row.status as AccountStatus,
      reason: row.reason,
      createdAt: row.createdAt,
      keys: parseKeys(row.keys),
    };
  } catch (err) {
    console.error("[auth] session lookup failed:", err);
    return null;
  }
}

/**
 * Guard for API routes. Returns the user, or an already-built 401/403 response
 * the caller should return immediately.
 */
export async function authGuard(options?: {
  admin?: boolean;
}): Promise<{ user: AuthUser; response: null } | { user: null; response: Response }> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: Response.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  if (options?.admin && user.role !== "admin") {
    return {
      user: null,
      response: Response.json({ error: "Admin access required." }, { status: 403 }),
    };
  }
  return { user, response: null };
}

/** Issues a signed session cookie for an account. */
export async function establishSession(user: {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
}): Promise<void> {
  const token = await signSession({
    uid: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 0,
  });
}

/* ------------------------------------------------------------------ */
/* Admin bootstrap (env-driven, so no seeding step is required)        */
/* ------------------------------------------------------------------ */

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const list = getAdminEmails();
  // `ADMIN_EMAILS=*` means "any email may sign in as admin with the admin
  // password" — handy for a single-operator instance before the owner has
  // decided which address to use.
  if (list.includes("*")) return true;
  return list.includes(email.trim().toLowerCase());
}

/** True when the supplied secret matches the `ADMIN_PASSWORD` env var. */
export function verifyAdminPassword(secret: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (typeof expected !== "string" || expected.length === 0) return false;
  if (secret.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}
