"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldOff,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProviderId } from "@/lib/models/types";

interface AdminUser {
  id: string;
  email: string;
  reason: string;
  status: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  keyProviders: ProviderId[];
  isSelf: boolean;
}

interface Counts {
  total: number;
  pending: number;
  approved: number;
  revoked: number;
  rejected: number;
}

type Filter = "all" | "pending" | "approved" | "rejected" | "revoked";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-secondary text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-secondary text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<{ email: string; code: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/users", { cache: "no-store" });
      const json = (await resp.json()) as {
        users?: AdminUser[];
        counts?: Counts;
        error?: string;
      };
      if (!resp.ok) {
        setError(json.error ?? "Failed to load users.");
        return;
      }
      setUsers(json.users ?? []);
      setCounts(json.counts ?? null);
    } catch {
      setError("Network error while loading users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(user: AdminUser, action: string) {
    setBusyId(user.id);
    try {
      const resp = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, action }),
      });
      const json = (await resp.json()) as { ok?: boolean; error?: string; accessCode?: string };
      if (!resp.ok || !json.ok) {
        toast.error(json.error ?? "Action failed.");
        return;
      }
      if (action === "reset-code" && json.accessCode) {
        setIssuedCode({ email: user.email, code: json.accessCode });
      } else if (action === "delete") {
        toast.success("Account deleted", { description: user.email });
      } else {
        toast.success(
          action === "approve" || action === "reactivate"
            ? "Approved"
            : action === "reject"
              ? "Rejected"
              : "Access revoked",
          { description: user.email },
        );
      }
      await load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(
    () => (filter === "all" ? users : users.filter((u) => u.status === filter)),
    [users, filter],
  );

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: counts?.pending ?? 0 },
    { id: "approved", label: "Approved", count: counts?.approved ?? 0 },
    { id: "rejected", label: "Rejected", count: counts?.rejected ?? 0 },
    { id: "revoked", label: "Revoked", count: counts?.revoked ?? 0 },
    { id: "all", label: "All", count: counts?.total ?? 0 },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Access requests</h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Signed in as <span className="text-foreground">{adminEmail}</span> · approve,
            decline or revoke anyone&apos;s access below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-9 rounded-full text-[13px]">
            <Link href="/chat">Workspace</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh"
            onClick={() => void load()}
            className="size-9 rounded-full"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pending", value: counts?.pending ?? 0, tone: "text-amber-600 dark:text-amber-400" },
          { label: "Approved", value: counts?.approved ?? 0, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Revoked", value: counts?.revoked ?? 0, tone: "text-destructive" },
          { label: "Total", value: counts?.total ?? 0, tone: "text-foreground" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <p className={cn("text-2xl font-semibold tabular-nums", stat.tone)}>{stat.value}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              filter === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="ml-1.5 opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      {/* Issued code */}
      {issuedCode ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
          <KeyRound className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-muted-foreground">
              New sign-in code for {issuedCode.email} — shown once:
            </p>
            <code className="font-mono text-[14px] tracking-wide">{issuedCode.code}</code>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-8 shrink-0 gap-1.5 rounded-full text-[12px]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(issuedCode.code);
                toast.success("Copied");
              } catch {
                toast.error("Copy failed — select it manually.");
              }
            }}
          >
            <Copy className="size-3.5" /> Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="size-8 shrink-0 rounded-full"
            aria-label="Dismiss"
            onClick={() => setIssuedCode(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      {/* List */}
      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading accounts…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-[13px] text-muted-foreground">
          Nothing here — no accounts with status{" "}
          <span className="font-medium text-foreground">{filter}</span>.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-border/60 bg-card px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium">{user.email}</span>
                <StatusBadge status={user.status} />
                {user.role === "admin" ? (
                  <span className="rounded-full bg-[var(--clay-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    admin
                  </span>
                ) : null}
                {user.isSelf ? (
                  <span className="text-[11.5px] text-muted-foreground">(you)</span>
                ) : null}
                <span className="ml-auto text-[11.5px] text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {user.reason ? (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-secondary/50 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
                  {user.reason}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(user.status === "pending" || user.status === "rejected" || user.status === "revoked") && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 rounded-full text-[12.5px]"
                    disabled={busyId === user.id}
                    onClick={() => void act(user, "approve")}
                  >
                    <Check className="size-3.5" />
                    {user.status === "pending" ? "Approve" : "Restore access"}
                  </Button>
                )}
                {user.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-full text-[12.5px]"
                    disabled={busyId === user.id}
                    onClick={() => void act(user, "reject")}
                  >
                    <X className="size-3.5" /> Reject
                  </Button>
                )}
                {user.status === "approved" && !user.isSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-full border-destructive/40 text-[12.5px] text-destructive hover:bg-destructive/10"
                    disabled={busyId === user.id}
                    onClick={() => void act(user, "revoke")}
                  >
                    <ShieldOff className="size-3.5" /> Revoke access
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 rounded-full text-[12.5px]"
                  disabled={busyId === user.id}
                  onClick={() => void act(user, "reset-code")}
                >
                  <KeyRound className="size-3.5" /> New sign-in code
                </Button>

                {user.keyProviders.length > 0 ? (
                  <span className="ml-auto flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    {user.keyProviders.length} key
                    {user.keyProviders.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="ml-auto text-[11.5px] text-muted-foreground/70">
                    no personal keys
                  </span>
                )}

                {!user.isSelf ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${user.email}`}
                    disabled={busyId === user.id}
                    onClick={() => setPendingDelete(user)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account and everything it owns —
              conversations, memory and artifacts. It cannot be undone. To block
              someone without deleting their data, revoke their access instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) void act(pendingDelete, "delete");
                setPendingDelete(null);
              }}
            >
              <UserCheck className="mr-1 size-3.5" /> Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
