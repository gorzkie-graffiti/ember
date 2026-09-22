"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Mail, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !secret.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setErrorCode(null);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), secret }),
      });
      const json = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        redirect?: string;
      };
      if (!resp.ok || !json.ok) {
        setError(json.error ?? "Sign-in failed.");
        setErrorCode(json.code ?? null);
        return;
      }
      const destination = next && next.startsWith("/") ? next : (json.redirect ?? "/chat");
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-[0_20px_50px_-30px_rgba(11,11,11,0.35)]">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--clay-soft)] text-primary">
          <LogIn className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-2xl tracking-tight">Sign in</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Use your email and the sign-in code you got when you registered.
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Email</span>
            <span className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Sign-in code</span>
            <span className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                autoComplete="one-time-code"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="EMBER-XXXX-XXXX-XXXX"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 font-mono text-[14px] tracking-wide outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
              />
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              Admins can use their admin password here instead.
            </span>
          </label>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              {error}
              {errorCode === "unknown-email" || errorCode === "rejected" ? (
                <>
                  {" "}
                  <Link href="/register" className="font-medium underline">
                    Request access
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!email.trim() || !secret.trim() || submitting}
            className="h-10 w-full gap-2 rounded-full text-[13.5px]"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Request access
        </Link>
      </p>
    </div>
  );
}
