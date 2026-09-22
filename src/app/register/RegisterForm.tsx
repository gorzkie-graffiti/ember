"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_REASON = 10;
const MAX_REASON = 1000;

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyApproved, setAlreadyApproved] = useState(false);
  const [result, setResult] = useState<{ email: string; accessCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit =
    email.trim().length > 0 && reason.trim().length >= MIN_REASON && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setAlreadyApproved(false);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() }),
      });
      const json = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        email?: string;
        accessCode?: string;
      };
      if (!resp.ok || !json.ok) {
        setError(json.error ?? "Something went wrong. Try again.");
        if (json.code === "already-approved") setAlreadyApproved(true);
        return;
      }
      setResult({ email: json.email ?? email.trim(), accessCode: json.accessCode ?? "" });
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-[0_20px_50px_-30px_rgba(11,11,11,0.35)]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--clay-soft)] text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="mt-4 font-display text-2xl tracking-tight">
            Request received
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{result.email}</span> is now
            <span className="mx-1 rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium">
              pending review
            </span>
            . An admin will approve or decline it.
          </p>

          <div className="mt-5 rounded-xl border border-border/70 bg-secondary/50 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Your sign-in code
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[15px] tracking-wide">
                {result.accessCode}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1.5 rounded-full text-[12px]"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.accessCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    setError("Copy failed — select the code and copy it manually.");
                  }
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
              Save this now — it&apos;s shown only once, and it&apos;s what you&apos;ll
              sign in with once you&apos;re approved. Lose it and the admin can issue a
              new one.
            </p>
          </div>

          <Button asChild className="mt-5 h-10 w-full rounded-full text-[13.5px]">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-[0_20px_50px_-30px_rgba(11,11,11,0.35)]">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--clay-soft)] text-primary">
          <Sparkles className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-2xl tracking-tight">Request access</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Two fields, that&apos;s it. Your request goes to the admin for review.
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
            <span className="text-[13px] font-medium">
              Why do you want to use this AI interface?
            </span>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              placeholder="What are you planning to use it for? A sentence or two is plenty."
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
            />
            <span
              className={`text-[11.5px] ${
                reason.trim().length > 0 && reason.trim().length < MIN_REASON
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {reason.trim().length}/{MAX_REASON} characters
              {reason.trim().length > 0 && reason.trim().length < MIN_REASON
                ? ` — at least ${MIN_REASON}`
                : ""}
            </span>
          </label>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              {error}{" "}
              {alreadyApproved ? (
                <Link href="/login" className="font-medium underline">
                  Sign in
                </Link>
              ) : null}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-10 w-full gap-2 rounded-full text-[13.5px]"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Sending request…" : "Submit request"}
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
