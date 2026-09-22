/**
 * Session token primitives — Web Crypto only, so this module runs in both the
 * Edge middleware and the Node.js route handlers.
 *
 * A session is a compact, HMAC-SHA256 signed token: `base64url(payload).base64url(sig)`.
 * The payload carries the account id, email, role and status so the middleware
 * can gate pages without touching the database. Route handlers additionally
 * re-read the account from the DB (see `getSessionUser`) so revocation and
 * approval changes take effect immediately rather than at token expiry.
 */

export const SESSION_COOKIE = "ember_session";

/** Session lifetime: 7 days. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AccountStatus = "pending" | "approved" | "rejected" | "revoked";
export type AccountRole = "user" | "admin";

export interface SessionPayload {
  /** Account id (Prisma `User.id`). */
  uid: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  /** Unix seconds. */
  exp: number;
}

/**
 * Signing secret. Prefer `AUTH_SECRET`; the fallback keeps local dev working
 * without configuration but MUST be overridden in any real deployment, since
 * anyone who knows it could forge a session.
 */
function getSecret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (typeof fromEnv === "string" && fromEnv.trim().length >= 16) {
    return fromEnv.trim();
  }
  return "ember-insecure-dev-secret-set-AUTH_SECRET-in-env";
}

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Constant-time-ish byte comparison. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(
  payload: Omit<SessionPayload, "exp"> & { exp?: number },
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(full)));
  const key = await importKey(getSecret());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/** Returns the payload for a valid, unexpired token, else null. */
export async function verifySession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const signature = base64UrlToBytes(token.slice(dot + 1));
  if (!signature) return null;

  try {
    const key = await importKey(getSecret());
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
    );
    if (!bytesEqual(expected, signature)) return null;
  } catch {
    return null;
  }

  const decoded = base64UrlToBytes(body);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded)) as SessionPayload;
    if (typeof parsed?.uid !== "string" || typeof parsed?.exp !== "number") {
      return null;
    }
    if (parsed.exp * 1000 <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True when this deployment still uses the built-in dev secret. */
export function isUsingDevSecret(): boolean {
  const fromEnv = process.env.AUTH_SECRET;
  return !(typeof fromEnv === "string" && fromEnv.trim().length >= 16);
}
