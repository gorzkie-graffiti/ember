"use client";

import { useState } from "react";
import { ArrowRight, Eye, Loader2, ScanText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getModel,
  getModelOrThrow,
  getVisionModels,
} from "@/lib/models/catalog";
import { useModelStore } from "@/store/model-store";
import { useComposerStore } from "@/store/composer-store";
import { ProviderLogo } from "./ProviderLogo";
import { formatBytes } from "./Composer";

/**
 * Vision fallback — shown when an image is attached while the selected
 * model can't see images. Capability-driven: only triggers off
 * `model.capabilities.vision === false`.
 */
export function VisionFallbackDialog() {
  const pendingFile = useComposerStore((s) => s.pendingVisionFile);
  const resolveVisionFallback = useComposerStore((s) => s.resolveVisionFallback);
  const resolvingVision = useComposerStore((s) => s.resolvingVision);
  const fallbackVisionModelId = useComposerStore(
    (s) => s.fallbackVisionModelId,
  );
  const setFallbackVisionModel = useComposerStore(
    (s) => s.setFallbackVisionModel,
  );
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  // Reactive liveness: only vision models whose provider key exists can be
  // chosen — this dialog must never offer a model the backend can't serve.
  const liveProviders = useModelStore((s) => s.liveProviders);

  const [choosingForId, setChoosingForId] = useState<string | null>(null);
  const visionModels = getVisionModels().filter(
    (m) => liveProviders[m.provider] === true,
  );
  const model = getModelOrThrow(selectedModelId);
  const chosenId = fallbackVisionModelId ?? visionModels[0]?.id;
  const chosen = chosenId ? getModel(chosenId) : undefined;
  // "Change model" view is per-file: resets automatically for a new image.
  const choosing =
    pendingFile !== null && choosingForId === pendingFile.id;

  const open = pendingFile !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !resolvingVision) void resolveVisionFallback("cancel");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="size-4.5 text-primary" />
            This model can&apos;t see images
          </DialogTitle>
          <DialogDescription className="pt-1 text-left text-[13px] leading-relaxed">
            <span className="font-medium text-foreground">
              {model.displayName}
            </span>{" "}
            has no vision capability, but you attached{" "}
            <span className="font-medium text-foreground">
              {pendingFile?.name}
            </span>
            {pendingFile ? ` (${formatBytes(pendingFile.size)})` : ""}. Choose
            how to proceed:
          </DialogDescription>
        </DialogHeader>

        {!choosing ? (
          <div className="flex flex-col gap-2.5 pt-1">
            <div
              role="button"
              tabIndex={0}
              aria-busy={resolvingVision}
              aria-disabled={resolvingVision}
              onClick={() => {
                if (!resolvingVision) void resolveVisionFallback("vision-model");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!resolvingVision) void resolveVisionFallback("vision-model");
                }
              }}
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5",
                resolvingVision && "pointer-events-none opacity-70",
              )}
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                {resolvingVision ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Eye className="size-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">
                  Use a vision model
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  Let a vision-capable model analyze the image and pass the
                  result to your selected model.
                </span>
                {chosen && (
                  <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <ProviderLogo provider={chosen.provider} size={13} />
                    {chosen.displayName} · {chosen.reliability}% reliability
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChoosingForId(pendingFile?.id ?? null);
                      }}
                      className="ml-1 rounded-full px-2 py-0.5 font-medium text-primary hover:bg-primary/10"
                    >
                      Change model
                    </button>
                  </span>
                )}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              aria-busy={resolvingVision}
              aria-disabled={resolvingVision}
              onClick={() => {
                if (!resolvingVision) void resolveVisionFallback("extract-text");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!resolvingVision) void resolveVisionFallback("extract-text");
                }
              }}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5",
                resolvingVision && "pointer-events-none opacity-70",
              )}
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                {resolvingVision ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ScanText className="size-4" />
                )}
              </span>
                  <span>
                <span className="block text-[13.5px] font-semibold">
                  Extract text only
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  Extract text from the image and pass the extracted text to
                  your selected model.
                </span>
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
              <ArrowRight className="size-3 shrink-0" />
              Image → vision model → result passed to {model.displayName} →
              your answer
            </div>

            <Button
              variant="ghost"
              disabled={resolvingVision}
              onClick={() => void resolveVisionFallback("cancel")}
              className="mx-auto mt-1 h-8 w-fit px-6 text-[13px] text-muted-foreground"
            >
              <X className="size-3.5" /> Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pt-1">
            <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Choose a vision model
            </p>
            <div className="scrollbar-thin flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
              {visionModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setFallbackVisionModel(m.id);
                    setChoosingForId(null);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                    m.id === chosenId
                      ? "border-primary/50 bg-primary/8"
                      : "border-transparent hover:bg-secondary/50",
                  )}
                >
                  <ProviderLogo provider={m.provider} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {m.displayName}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">
                      {m.reliability}% reliability · {m.contextWindow} context
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => setChoosingForId(null)}
              className="mx-auto mt-2 h-8 w-fit px-6 text-[13px] text-muted-foreground"
            >
              Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
