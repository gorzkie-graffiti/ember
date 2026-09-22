"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProviderId } from "@/lib/models/types";

interface ProviderKeyStatus {
  id: ProviderId;
  name: string;
  accent: string;
  envVar: string | null;
  source: "personal" | "shared" | "none";
  hint: string | null;
  live: boolean;
}

export function ApiKeysCard() {
  const [providers, setProviders] = useState<ProviderKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [reveal, setReveal] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [busy, setBusy] = useState<ProviderId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/keys", { cache: "no-store" });
      const json = (await resp.json()) as { providers?: ProviderKeyStatus[]; error?: string };
      if (!resp.ok) {
        setError(json.error ?? "Failed to load your keys.");
        return;
      }
      setProviders(json.providers ?? []);
    } catch {
      setError("Network error while loading your keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(provider: ProviderId) {
    const key = (drafts[provider] ?? "").trim();
    if (!key) return;
    setBusy(provider);
    try {
      const resp = await fetch("/api/keys", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const json = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !json.ok) {
        toast.error(json.error ?? "Failed to save key.");
        return;
      }
      setDrafts((d) => ({ ...d, [provider]: "" }));
      toast.success("Key saved", { description: `${provider} will use your key.` });
      await load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: ProviderId) {
    setBusy(provider);
    try {
      const resp = await fetch(`/api/keys?provider=${provider}`, { method: "DELETE" });
      const json = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !json.ok) {
        toast.error(json.error ?? "Failed to remove key.");
        return;
      }
      toast.success("Key removed", { description: provider });
      await load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-border/60 bg-card px-4 py-4">
      <header className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--clay-soft)] text-primary">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">Your API keys</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Keys you add here are yours alone — they&apos;re stored on the server and used
            for your requests before the shared server keys. Leave a provider empty to
            fall back to the server&apos;s key when one exists.
          </p>
        </div>
      </header>

      {loading && providers.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading providers…
        </p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {providers.map((provider) => {
            const draft = drafts[provider.id] ?? "";
            const revealed = reveal[provider.id] === true;
            return (
              <div
                key={provider.id}
                className="rounded-lg border border-border/50 bg-background/60 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: provider.accent }}
                  />
                  <span className="text-[13.5px] font-medium">{provider.name}</span>

                  {provider.source === "personal" ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" /> your key {provider.hint}
                    </span>
                  ) : provider.source === "shared" ? (
                    <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      <ShieldCheck className="size-3" /> server key
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      not configured
                    </span>
                  )}

                  {provider.envVar ? (
                    <code className="ml-auto hidden rounded bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground sm:inline">
                      {provider.envVar}
                    </code>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type={revealed ? "text" : "password"}
                      value={draft}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        provider.source === "personal"
                          ? "Replace your key…"
                          : `Paste your ${provider.name} key…`
                      }
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [provider.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void save(provider.id);
                      }}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-9 font-mono text-[12.5px] outline-none placeholder:font-sans placeholder:text-muted-foreground/70 focus:border-primary/60"
                    />
                    {draft ? (
                      <button
                        type="button"
                        aria-label={revealed ? "Hide key" : "Show key"}
                        onClick={() =>
                          setReveal((r) => ({ ...r, [provider.id]: !revealed }))
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {revealed ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>

                  <Button
                    size="sm"
                    className="h-8 shrink-0 rounded-full px-4 text-[12.5px]"
                    disabled={!draft.trim() || busy === provider.id}
                    onClick={() => void save(provider.id)}
                  >
                    {busy === provider.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Save
                  </Button>

                  {provider.source === "personal" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0 gap-1.5 rounded-full text-[12.5px] text-muted-foreground hover:text-destructive"
                      disabled={busy === provider.id}
                      onClick={() => void remove(provider.id)}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Changing a key takes effect on your next message. Connected providers light up
            in the model picker automatically.
          </p>
        </div>
      )}
    </section>
  );
}
