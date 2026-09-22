import { db } from "@/lib/db";
import { normalizeEmail, verifyCode, generateAccessCode, hashCode } from "@/lib/auth/codes";
import {
  establishSession,
  isAdminEmail,
  verifyAdminPassword,
} from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Body: { email, secret }
 *
 * `secret` is the one-time sign-in code handed out at registration. Admins
 * (emails listed in `ADMIN_EMAILS`) may instead use the `ADMIN_PASSWORD`
 * value, which bootstraps the first admin without any seeding step.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (raw ?? {}) as { email?: unknown; secret?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const secret = typeof body.secret === "string" ? body.secret : "";

  if (!email || !secret.trim()) {
    return Response.json({ error: "Email and sign-in code are both required." }, { status: 400 });
  }

  try {
    // ---- Admin path -------------------------------------------------
    if (isAdminEmail(email) && verifyAdminPassword(secret)) {
      const data = {
        role: "admin",
        status: "approved" as const,
        codeHash: await hashCode(generateAccessCode()),
      };
      const admin = await db.user.upsert({
        where: { email },
        update: { role: data.role, status: data.status },
        create: { email, reason: "Admin account", keys: {}, ...data },
      });
      await establishSession({
        id: admin.id,
        email: admin.email,
        role: "admin",
        status: "approved",
      });
      return Response.json({ ok: true, role: "admin", redirect: "/admin" });
    }

    // ---- Regular account path --------------------------------------
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return Response.json(
        { error: "No account found for that email. Request access first.", code: "unknown-email" },
        { status: 401 },
      );
    }

    const matches = await verifyCode(secret, user.codeHash);
    if (!matches) {
      return Response.json(
        { error: "That email and sign-in code don't match.", code: "bad-credentials" },
        { status: 401 },
      );
    }

    if (user.status === "pending") {
      return Response.json(
        {
          error: "Your request is still awaiting approval. Try again once the admin has reviewed it.",
          code: "pending",
        },
        { status: 403 },
      );
    }
    if (user.status === "rejected") {
      return Response.json(
        { error: "Your request was declined.", code: "rejected" },
        { status: 403 },
      );
    }
    if (user.status !== "approved") {
      return Response.json(
        { error: "Your access has been revoked.", code: "revoked" },
        { status: 403 },
      );
    }

    const role = user.role === "admin" ? "admin" : "user";
    await establishSession({
      id: user.id,
      email: user.email,
      role,
      status: "approved",
    });
    return Response.json({
      ok: true,
      role,
      redirect: role === "admin" ? "/admin" : "/chat",
    });
  } catch (err) {
    console.error("[api/auth/login] failed:", err);
    return Response.json({ error: "Sign-in failed. Try again." }, { status: 500 });
  }
}
