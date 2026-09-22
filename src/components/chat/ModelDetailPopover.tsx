"use client";

import {
  AlertTriangle,
  Brain,
  Check,
  Eye,
  Info,
  Lock,
  MessageSquare,
  Mic,
  Paperclip,
  Volume2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { reliabilityTone } from "@/lib/models/catalog";
import { getProvider } from "@/lib/models/providers";
import type { ModelInfo } from "@/lib/models/types";
import { useModelStore } from "@/store/model-store";
import { cn } from "@/lib/utils";

import { ProviderLogo } from "./ProviderLogo";

/* ------------------------------------------------------------------ */
/* Capability-driven helpers — zero per-model special cases            */
/* ------------------------------------------------------------------ */

/**
 * Rows rendered in the capability matrix. Every entry maps straight to a
 * `ModelCapabilities` boolean, so the matrix is pure data projection.
 * (`reasoningRequired` is rendered as a full-width highlight row below
 * the grid because its "on" state carries a longer explanation.)
 */
const CAPABILITY_ROWS: Array<{
  key:
    | "vision"
    | "files"
    | "thinking"
    | "audioInput"
    | "audioOutput"
    | "chatCompatible";
  label: string;
  icon: LucideIcon;
}> = [
  { key: "vision", label: "Vision", icon: Eye },
  { key: "files", label: "File attachments", icon: Paperclip },
  { key: "thinking", label: "Thinking", icon: Brain },
  { key: "audioInput", label: "Audio input", icon: Mic },
  { key: "audioOutput", label: "Audio output", icon: Volume2 },
  { key: "chatCompatible", label: "Chat compatible", icon: MessageSquare },
];

/** Visual tones for the reliability stat — thresholds come from the catalog. */
const RELIABILITY_TONES = {
  high: { text: "text-emerald-500", bar: "bg-emerald-500" },
  medium: { text: "text-amber-500", bar: "bg-amber-500" },
  low: { text: "text-rose-500", bar: "bg-rose-500" },
} as const;

/** "≈ 480 ms" / "≈ 3.4 s" */
function formatLatency(ms: number): string {
  if (ms < 1000) return `≈ ${ms} ms`;
  const seconds = ms / 1000;
  return `≈ ${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

/* ------------------------------------------------------------------ */
/* Capability matrix cell                                              */
/* ------------------------------------------------------------------ */

function CapabilityCell({
  label,
  icon: Icon,
  supported,
}: {
  label: string;
  icon: LucideIcon;
  supported: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
        supported ? "border-border/40 bg-secondary/40" : "border-border/30",
      )}
    >
      <Icon
        className={cn(
          "size-3 shrink-0",
          supported ? "text-muted-foreground" : "text-muted-foreground/45",
        )}
      />
      <span
        className={cn(
          "truncate text-[11px] leading-none",
          supported ? "text-foreground/85" : "text-muted-foreground/55",
        )}
      >
        {label}
      </span>
      {supported ? (
        <Check className="ml-auto size-3 shrink-0 text-emerald-500" />
      ) : (
        <X className="ml-auto size-3 shrink-0 text-muted-foreground/35" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Popover                                                             */
/* ------------------------------------------------------------------ */

/**
 * Model detail card — opened via the small info button next to each model
 * row/card in the picker. Renders the full capability matrix, effort
 * levels, reliability/latency/context stats and aliases, all derived from
 * `ModelInfo`.
 *
 * `modal` is required because this Popover lives inside the (modal) model
 * picker Dialog: it makes the popover the top dismissable layer so clicks
 * inside it don't close the dialog underneath.
 */
export function ModelDetailPopover({ model }: { model: ModelInfo }) {
  const provider = getProvider(model.provider);
  const caps = model.capabilities;
  const tone = RELIABILITY_TONES[reliabilityTone(model.reliability)];
  // Runtime truth from the server env — not the static catalog baseline.
  const live = useModelStore((s) => s.isModelLive(model.id));
  const envVar = useModelStore((s) => s.providerEnvVars[model.provider]);

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`View details for ${model.displayName}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Keep Enter/Space for the trigger itself so the surrounding
            // row's keyboard selection doesn't fire while opening details.
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
          className={cn(
            "rounded-md p-1.5 text-muted-foreground/50 transition-all",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
            "hover:bg-secondary hover:text-muted-foreground",
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        aria-label={`Details for ${model.displayName}`}
        className="w-[min(340px,calc(100vw-3rem))] gap-0 rounded-xl border-border/60 p-0 shadow-xl"
      >
        {/* ---------- Header ---------- */}
        <div className="flex items-start gap-2.5 border-b border-border/50 p-3.5 pb-3">
          <ProviderLogo provider={model.provider} size={22} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">
              {model.displayName}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{ backgroundColor: provider.accent }}
              />
              {provider.name}
            </p>
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">
              {model.id}
            </p>
          </div>
        </div>

        {/* ---------- Description ---------- */}
        <p className="px-3.5 pt-3 text-[12px] leading-snug text-muted-foreground">
          {model.description}
        </p>

        {/* ---------- Caveat side note (optional) ---------- */}
        {model.caveat && (
          <p className="mx-3.5 mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            {model.caveat}
          </p>
        )}

        {/* ---------- Connection status (honesty row) ---------- */}
        <div className="px-3.5 pt-3">
          {live ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5">
              <span aria-hidden className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium leading-none text-emerald-600 dark:text-emerald-400">
                Connected
              </span>
              <span className="leading-none text-[10.5px] text-muted-foreground">
                {`Live via ${provider.name} (API key in .env)`}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-secondary/30 px-2 py-1.5">
              <span className="w-fit rounded border border-border/60 px-1.5 py-px text-[10px] font-medium leading-none text-muted-foreground">
                Not connected
              </span>
              <span className="text-[10.5px] leading-snug text-muted-foreground/80">
                {envVar
                  ? `Add ${envVar} to .env and restart the dev server to enable.`
                  : "Listed in the catalog — connect a provider key to enable."}
              </span>
            </div>
          )}
        </div>

        {/* ---------- Capability matrix ---------- */}
        <div className="grid grid-cols-2 gap-1 px-3.5 pt-3">
          {CAPABILITY_ROWS.map(({ key, label, icon }) => (
            <CapabilityCell
              key={key}
              label={label}
              icon={icon}
              supported={caps[key]}
            />
          ))}
        </div>

        {/* Reasoning required — full-width constraint row */}
        <div className="px-3.5 pt-1">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
              caps.reasoningRequired
                ? "border-primary/40 bg-primary/10"
                : "border-border/30",
            )}
          >
            <Lock
              className={cn(
                "size-3 shrink-0",
                caps.reasoningRequired
                  ? "text-primary"
                  : "text-muted-foreground/45",
              )}
            />
            <span
              className={cn(
                "text-[11px] leading-none",
                caps.reasoningRequired
                  ? "font-medium text-foreground/90"
                  : "text-muted-foreground/55",
              )}
            >
              Reasoning required
            </span>
            {caps.reasoningRequired ? (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium leading-none text-primary">
                <Check className="size-3 shrink-0" />
                Required — cannot be disabled
              </span>
            ) : (
              <X className="ml-auto size-3 shrink-0 text-muted-foreground/35" />
            )}
          </div>
        </div>

        {/* ---------- Effort levels ---------- */}
        <div className="px-3.5 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Effort levels
          </p>
          {caps.effortLevels.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {caps.effortLevels.map((level) => (
                <span
                  key={level}
                  className="rounded-md border border-border/60 bg-secondary/50 px-1.5 py-0.5 text-[10.5px] capitalize leading-none text-muted-foreground"
                >
                  {level}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] leading-none text-muted-foreground/70">
              No effort control
            </p>
          )}
        </div>

        {/* ---------- Stats ---------- */}
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 px-3.5 py-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Reliability
            </p>
            <p
              className={cn(
                "mt-1 text-[12.5px] font-semibold tabular-nums",
                tone.text,
              )}
            >
              {model.reliability}%
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full", tone.bar)}
                style={{ width: `${model.reliability}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Avg latency
            </p>
            <p className="mt-1 text-[12.5px] font-semibold tabular-nums">
              {formatLatency(model.avgLatencyMs)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Context
            </p>
            <p className="mt-1 text-[12.5px] font-semibold tabular-nums">
              {model.contextWindow}
            </p>
          </div>
        </div>

        {/* ---------- Aliases ---------- */}
        {model.aliases.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border/50 px-3.5 py-2.5">
            {model.aliases.map((alias) => (
              <span
                key={alias}
                className="rounded border border-border/50 bg-secondary/30 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/80"
              >
                {alias}
              </span>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
