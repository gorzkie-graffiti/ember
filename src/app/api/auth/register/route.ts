import { db } from "@/lib/db";
import {
  generateAccessCode,
  hashCode,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 * Body: { email, reason }
 *
 * The whole sign-up. Creates a `pending` account and returns a one-time
 * sign-in code — the ONLY time that code is ever shown. An admin approves or
 * declines from the panel; nobody gets in until then.
 */
const MIN_REASON = 10;
const MAX_REASON = 1000;

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (raw ?? {}) as { email?: unknown; reason?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!isValidEmail(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (reason.length < MIN_REASON) {
    return Response.json(
      {
        error: `Tell us a little more about why you want access (at least ${MIN_REASON} characters).`,
      },
      { status: 400 },
    );
  }
  if (reason.length > MAX_REASON) {
    return Response.json(
      { error: `Keep your reason under ${MAX_REASON} characters.` },
      { status: 400 },
    );
  }

  try {
    const existing = await db.user.findUnique({ where: { email } });

    if (existing?.status === "approved") {
      return Response.json(
        {
          error: "That email already has access — sign in instead.",
          code: "already-approved",
        },
        { status: 409 },
      );
    }

    if (existing?.status === "revoked" && existing.role !== "admin") {
      return Response.json(
        {
          error:
            "Access for that email was revoked. Contact the admin if you think that was a mistake.",
          code: "revoked",
        },
        { status: 403 },
      );
    }

    // New sign-up, a retry while still pending, or a re-application after a
    // rejection — all mint a fresh code (the old one is discarded) and put the
    // account back in the review queue.
    const accessCode = generateAccessCode();
    const codeHash = await hashCode(accessCode);

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          reason,
          codeHash,
          status: existing.role === "admin" ? existing.status : "pending",
        },
      });
    } else {
      await db.user.create({
        data: {
          email,
          reason,
          codeHash,
          status: "pending",
          role: "user",
          keys: {},
        },
      });
    }

    return Response.json({
      ok: true,
      email,
      status: "pending",
      accessCode,
    });
  } catch (err) {
    console.error("[api/auth/register] failed:", err);
    return Response.json({ error: "Could not complete registration." }, { status: 500 });
  }
}
