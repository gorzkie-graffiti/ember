import { db } from "@/lib/db";
import { authGuard } from "@/lib/auth/server";
import { generateAccessCode, hashCode } from "@/lib/auth/codes";
import { PROVIDER_IDS } from "@/lib/models/providers";
import type { ProviderId } from "@/lib/models/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  approved: 1,
  revoked: 2,
  rejected: 3,
};

function keyProviders(raw: unknown): ProviderId[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const map = raw as Record<string, unknown>;
  return PROVIDER_IDS.filter(
    (id) => typeof map[id] === "string" && (map[id] as string).trim().length > 0,
  );
}

/** GET /api/admin/users → every account, review queue first. */
export async function GET() {
  const { user, response } = await authGuard({ admin: true });
  if (!user) return response;

  try {
    const rows = await db.user.findMany();
    const users = rows
      .map((row) => ({
        id: row.id,
        email: row.email,
        reason: row.reason,
        status: row.status,
        role: row.role,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        keyProviders: keyProviders(row.keys),
        isSelf: row.id === user.id,
      }))
      .sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const counts = {
      total: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      approved: users.filter((u) => u.status === "approved").length,
      revoked: users.filter((u) => u.status === "revoked").length,
      rejected: users.filter((u) => u.status === "rejected").length,
    };

    return Response.json({ users, counts });
  } catch (err) {
    console.error("[api/admin/users] GET failed:", err);
    return Response.json({ error: "Failed to load users." }, { status: 500 });
  }
}

/** POST /api/admin/users — { id, action } */
export async function POST(req: Request) {
  const { user, response } = await authGuard({ admin: true });
  if (!user) return response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (raw ?? {}) as { id?: unknown; action?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!id || !action) {
    return Response.json({ error: "Fields 'id' and 'action' are required." }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  // Don't let an admin lock themselves out.
  if (target.id === user.id && ["reject", "revoke", "delete"].includes(action)) {
    return Response.json(
      { error: "You can't revoke or delete your own account." },
      { status: 400 },
    );
  }

  try {
    switch (action) {
      case "approve":
      case "reactivate":
        await db.user.update({ where: { id }, data: { status: "approved" } });
        return Response.json({ ok: true, status: "approved" });

      case "reject":
        await db.user.update({ where: { id }, data: { status: "rejected" } });
        return Response.json({ ok: true, status: "rejected" });

      case "revoke":
        await db.user.update({ where: { id }, data: { status: "revoked" } });
        return Response.json({ ok: true, status: "revoked" });

      case "reset-code": {
        const accessCode = generateAccessCode();
        const codeHash = await hashCode(accessCode);
        await db.user.update({ where: { id }, data: { codeHash } });
        return Response.json({ ok: true, accessCode });
      }

      case "delete":
        await db.user.delete({ where: { id } });
        return Response.json({ ok: true, deleted: true });

      default:
        return Response.json(
          {
            error: `Unknown action "${action}". Use approve, reject, revoke, reactivate, reset-code or delete.`,
          },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("[api/admin/users] action failed:", err);
    return Response.json({ error: "Action failed." }, { status: 500 });
  }
}
