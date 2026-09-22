import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AdminPanel } from "./AdminPanel";

export const metadata: Metadata = {
  title: "Admin — Ember",
};

/**
 * Admin surface. Middleware already blocks non-admins using the token's role
 * claim; this server check is authoritative because it reads the database.
 */
export default async function AdminPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/chat");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="size-6" />
            <span className="font-display text-lg tracking-tight">Ember</span>
            <span className="ml-1 rounded-full bg-[var(--clay-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Admin
            </span>
          </Link>
          <LogoutButton />
        </div>
      </header>
      <AdminPanel adminEmail={user.email} />
    </div>
  );
}
