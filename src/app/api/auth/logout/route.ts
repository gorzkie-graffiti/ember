import { clearSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/logout — clears the session cookie. */
export async function POST() {
  await clearSession();
  return Response.json({ ok: true });
}
