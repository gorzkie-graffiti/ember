import { getAuthUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/session → the current account (or null). */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ user: null });
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
}
