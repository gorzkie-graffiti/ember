"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

export interface AccountInfo {
  email: string;
  role: "user" | "admin";
}

function initialsFor(email: string): string {
  const first = email.trim().match(/[a-z0-9]/i)?.[0];
  return (first ?? "?").toUpperCase();
}

/** A friendly name from an email local part, e.g. `ada.lovelace@x.io` → Ada. */
export function displayNameFor(email: string): string {
  const local = (email.split("@")[0] ?? "").split(/[+.]/)[0];
  const word = local.replace(/[^a-zA-Z0-9]/g, "");
  if (!word) return "there";
  return word[0].toUpperCase() + word.slice(1);
}

export function AccountMenu({
  account,
  compact = false,
}: {
  account: AccountInfo;
  /** Rail mode: a single circular avatar button instead of a full row. */
  compact?: boolean;
}) {
  const router = useRouter();
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request failed, the redirect below clears the workspace.
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            aria-label={`Account: ${account.email}`}
            title={account.email}
            className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-primary/15 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/25"
          >
            {initialsFor(account.email)}
          </button>
        ) : (
          <button
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-sidebar-accent"
            aria-label="Account menu"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-clay text-[13px] font-semibold text-white">
              {initialsFor(account.email)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium text-foreground">
                {account.email}
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {account.role === "admin" ? "Administrator" : "Approved account"}
              </div>
            </div>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={compact ? "right" : "top"}
        align="start"
        className="w-60"
      >
        <div className="truncate px-2 py-1.5 text-[11.5px] text-muted-foreground">
          {account.email}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-[13px]"
          onClick={() => setActiveView("settings")}
        >
          <Settings2 className="size-3.5" />
          Settings &amp; API keys
        </DropdownMenuItem>
        {account.role === "admin" ? (
          <DropdownMenuItem
            className="gap-2 text-[13px]"
            onClick={() => router.push("/admin")}
          >
            <LayoutDashboard className="size-3.5" />
            Admin panel
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn(
            "gap-2 text-[13px] text-destructive focus:text-destructive",
            signingOut && "opacity-60",
          )}
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          <LogOut className="size-3.5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
