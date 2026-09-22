import { redirect } from "next/navigation";
import { AppShell } from "@/components/chat/AppShell";
import { getAuthUser } from "@/lib/auth/server";

/**
 * The workspace. Middleware already blocks anonymous visitors at the edge;
 * this server check is the authoritative one — it catches revoked accounts
 * and stale tokens (the edge only sees the signed cookie, not the database).
 */
export default async function ChatPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/chat");

  return (
    <AppShell account={{ email: user.email, role: user.role }} />
  );
}
