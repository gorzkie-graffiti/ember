"use client";

import { Brain, ChevronDown, Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/store/model-store";
import { getModelOrThrow } from "@/lib/models/catalog";
import type { EffortLevel } from "@/lib/models/types";

const EFFORT_LABELS: Record<EffortLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
};

/**
 * Thinking + Effort controls.
 *
 * Capability rules (derived, never hardcoded per model):
 * - No thinking support  → the whole chip is hidden.
 * - reasoningRequired    → switch is locked ON with an explanation.
 * - effortLevels empty   → Effort control hidden entirely.
 * - Only supported effort levels are rendered.
 */
export function ThinkingControls() {
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  const thinkingEnabled = useModelStore((s) => s.thinkingEnabled);
  const effort = useModelStore((s) => s.effort);
  const setThinking = useModelStore((s) => s.setThinking);
  const setEffort = useModelStore((s) => s.setEffort);

  const model = getModelOrThrow(selectedModelId);
  const caps = model.capabilities;

  // Capability-driven: hide the control entirely when unsupported.
  if (!caps.thinking) return null;

  const effortChip =
    caps.effortLevels.length > 0 ? ` · ${EFFORT_LABELS[effort]}` : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Thinking controls"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors",
            thinkingEnabled
              ? "bg-primary/12 text-primary hover:bg-primary/20"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Brain className="size-3.5" />
          <span className="hidden sm:inline">
            Thinking{effortChip}
          </span>
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-64 rounded-xl border-border/70 p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            <span className="text-[13px] font-medium">Thinking</span>
          </div>
          <Switch
            checked={thinkingEnabled || caps.reasoningRequired}
            disabled={caps.reasoningRequired}
            onCheckedChange={(checked) => setThinking(checked)}
            aria-label="Toggle thinking"
          />
        </div>

        {caps.reasoningRequired && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-2 text-[11.5px] leading-snug text-muted-foreground">
            <Lock className="mt-0.5 size-3 shrink-0" />
            Thinking is required for this model.
          </p>
        )}

        {caps.effortLevels.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Effort
              </span>
              <span className="text-[11px] text-muted-foreground">
                Independent of Thinking
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label="Effort level"
              className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-secondary/60 p-1"
            >
              {caps.effortLevels.map((level) => (
                <button
                  key={level}
                  role="radio"
                  aria-checked={effort === level}
                  onClick={() => setEffort(level)}
                  className={cn(
                    "h-7 rounded-md text-[12px] font-medium transition-all",
                    effort === level
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {EFFORT_LABELS[level]}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
