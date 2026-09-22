"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "outline";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      disabled={busy}
      className={cn("h-9 gap-1.5 rounded-full text-[13px]", className)}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Clearing the cookie failed — the redirect below still ends the UI.
        }
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut className="size-3.5" />
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
