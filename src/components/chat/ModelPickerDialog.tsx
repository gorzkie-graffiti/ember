"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Paperclip,
  Search,
  Star,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getModel,
  getModelsGroupedByProvider,
  getRecommendedModels,
  RECOMMENDED_MODEL_IDS,
  RECOMMENDATION_LABELS,
  searchChatModels,
} from "@/lib/models/catalog";
import { getProvider } from "@/lib/models/providers";
import type { ModelInfo } from "@/lib/models/types";
import { useModelStore } from "@/store/model-store";
import { useUIStore } from "@/store/ui-store";
import { ModelDetailPopover } from "./ModelDetailPopover";
import { ProviderLogo } from "./ProviderLogo";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function CapabilityIcons({ model }: { model: ModelInfo }) {
  const caps = model.capabilities;
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground/70">
      {caps.vision && (
        <span title="Vision" aria-label="Supports vision">
          <Eye className="size-3" />
        </span>
      )}
      {caps.files && (
        <span title="Files" aria-label="Supports files">
          <Paperclip className="size-3" />
        </span>
      )}
      {caps.thinking && (
        <span title="Thinking" aria-label="Supports thinking">
          <Brain className="size-3" />
        </span>
      )}
    </span>
  );
}

function ReliabilityBadge({ model }: { model: ModelInfo }) {
  const tone =
    model.reliability >= 96
      ? "text-emerald-500"
      : model.reliability >= 92
        ? "text-amber-500"
        : "text-rose-500";
  return (
    <span className={cn("text-[11px] font-medium tabular-nums", tone)}>
      {model.reliability}% reliability
    </span>
  );
}

/** Muted chip marking catalog-only models (backend can't serve them). */
function NotConnectedChip() {
  return (
    <span
      title="Not wired to this deployment's backend"
      className="shrink-0 rounded border border-border/60 px-1.5 py-px text-[10px] font-medium leading-none text-muted-foreground"
    >
      Not connected
    </span>
  );
}

function StarButton({ model }: { model: ModelInfo }) {
  const favoriteModelIds = useModelStore((s) => s.favoriteModelIds);
  const toggleFavorite = useModelStore((s) => s.toggleFavorite);
  const isFavorite = favoriteModelIds.includes(model.id);
  return (
    <button
      aria-label={isFavorite ? `Unfavorite ${model.displayName}` : `Favorite ${model.displayName}`}
      aria-pressed={isFavorite}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(model.id);
      }}
      onKeyDown={(e) => {
        // Keep Enter/Space on the star from also selecting the row.
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      }}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        isFavorite
          ? "text-amber-400 hover:text-amber-300"
          : "text-muted-foreground/50 hover:bg-secondary hover:text-muted-foreground",
      )}
    >
      <Star className={cn("size-3.5", isFavorite && "fill-current")} />
    </button>
  );
}

/** Wrapper so rows are divs (not buttons) — stars stay valid HTML inside. */
function selectableRowProps(onSelect: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onSelect,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
  };
}

/** Inert props for catalog-only rows — present but never interactive. */
function disabledRowProps() {
  return {
    "aria-disabled": true,
    tabIndex: -1,
  } as const;
}

function ModelRow({
  model,
  onSelect,
  compact,
}: {
  model: ModelInfo;
  onSelect: () => void;
  compact?: boolean;
}) {
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  const isSelected = selectedModelId === model.id;
  const provider = getProvider(model.provider);
  // Runtime truth: the provider's API key in server env decides liveness,
  // not the catalog's static baseline flag.
  const connected = useModelStore((s) => s.isModelLive(model.id));

  return (
    <div
      {...(connected ? selectableRowProps(onSelect) : disabledRowProps())}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl border px-3 text-left transition-all",
        compact ? "py-2" : "py-2.5",
        connected ? "cursor-pointer" : "cursor-default opacity-55",
        isSelected
          ? "border-primary/50 bg-primary/8"
          : connected
            ? "border-transparent hover:border-border/60 hover:bg-secondary/50"
            : "border-transparent",
      )}
    >
      <ProviderLogo provider={model.provider} size={18} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium">
            {model.displayName}
          </span>
          <CapabilityIcons model={model} />
          {isSelected && (
            <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-primary">
              <Check className="size-3" /> Selected
            </span>
          )}
          {!connected && !isSelected && (
            <span className="ml-auto">
              <NotConnectedChip />
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: provider.accent }}
            aria-hidden
          />
          {provider.name}
          <span aria-hidden>·</span>
          <ReliabilityBadge model={model} />
        </span>
        {model.caveat && (
          <span className="mt-0.5 flex items-start gap-1 text-[10.5px] leading-snug text-amber-600 dark:text-amber-400/90">
            <AlertTriangle className="mt-px size-2.5 shrink-0" />
            {model.caveat}
          </span>
        )}
      </span>
      <ModelDetailPopover model={model} />
      {connected && <StarButton model={model} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recommended card                                                    */
/* ------------------------------------------------------------------ */

function RecommendedCard({
  model,
  category,
  index,
  onSelect,
}: {
  model: ModelInfo;
  category: keyof typeof RECOMMENDATION_LABELS;
  /** 1-based position, shown as a hotkey badge */
  index: number;
  onSelect: () => void;
}) {
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  const isSelected = selectedModelId === model.id;
  const provider = getProvider(model.provider);

  return (
    <div
      {...selectableRowProps(onSelect)}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-xl border p-3 pl-3.5 text-left transition-all",
        isSelected
          ? "border-primary/60 bg-primary/8 shadow-[0_0_0_1px_var(--primary)]/10"
          : "border-border/60 bg-secondary/30 hover:border-border hover:bg-secondary/60",
      )}
    >
      {/* Provider accent stripe — color comes from provider config */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] transition-opacity"
        style={{
          backgroundColor: provider.accent,
          opacity: isSelected ? 0.95 : 0.45,
        }}
      />
      <div className="flex items-center justify-between">
        <ProviderLogo provider={model.provider} size={18} />
        <div className="flex items-center gap-0.5">
          <span
            title={`Press ${index} to select`}
            className="hidden rounded-md border border-border/60 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/70 transition-opacity group-hover:opacity-0 sm:block"
          >
            {index}
          </span>
          <ModelDetailPopover model={model} />
          <StarButton model={model} />
        </div>
      </div>
      <div>
        <div className="text-[13.5px] font-semibold leading-tight">
          {model.displayName}
        </div>
        <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
          {RECOMMENDATION_LABELS[category].title}
        </div>
      </div>
      {isSelected && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
          <Check className="size-3" /> Selected
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export function ModelPickerDialog() {
  const open = useUIStore((s) => s.modelPickerOpen);
  const setOpen = useUIStore((s) => s.setModelPickerOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Content unmounts on close, so search state resets naturally. */}
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <ModelPickerBody />
      </DialogContent>
    </Dialog>
  );
}

function ModelPickerBody() {
  const setOpen = useUIStore((s) => s.setModelPickerOpen);
  const selectModel = useModelStore((s) => s.selectModel);
  const recentModelIds = useModelStore((s) => s.recentModelIds);
  const favoriteModelIds = useModelStore((s) => s.favoriteModelIds);

  const [query, setQuery] = useState("");

  const recommended = useMemo(() => getRecommendedModels(), []);
  const grouped = useMemo(() => getModelsGroupedByProvider(), []);
  const results = useMemo(() => searchChatModels(query), [query]);

  const recentModels = useMemo(
    () =>
      recentModelIds
        .map((id) => getModel(id))
        .filter((m): m is ModelInfo => Boolean(m))
        .slice(0, 4),
    [recentModelIds],
  );

  const favoriteModels = useMemo(
    () =>
      favoriteModelIds
        .map((id) => getModel(id))
        .filter((m): m is ModelInfo => Boolean(m)),
    [favoriteModelIds],
  );

  const handleSelect = (modelId: string) => {
    // Models whose provider has no key are never selectable (store ignores
    // them too) — this keeps the dialog open on a no-op.
    const model = getModel(modelId);
    if (!model || !useModelStore.getState().isModelLive(modelId)) return;
    selectModel(modelId);
    setOpen(false);
  };

  return (
    <>
        <DialogHeader className="border-b border-border/60 px-5 pb-3 pt-4">
          <DialogTitle className="text-base">Select a model</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a chat model. Recommended models first, then the full
            catalog grouped by provider.
          </DialogDescription>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // When the search is empty, 1–4 jump-select a recommended model.
                if (
                  query === "" &&
                  /^[1-4]$/.test(e.key) &&
                  !e.metaKey &&
                  !e.ctrlKey &&
                  !e.altKey
                ) {
                  const modelId =
                    RECOMMENDED_MODEL_IDS[Number(e.key) - 1];
                  if (modelId) {
                    e.preventDefault();
                    handleSelect(modelId);
                  }
                }
              }}
              placeholder="Search models, providers, or capabilities…"
              aria-label="Search models"
              className="h-10 w-full rounded-xl border border-border/70 bg-secondary/40 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
            />
          </div>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[62vh] overflow-y-auto px-4 py-4">
          {/* ---------- Search results ---------- */}
          {query.trim() ? (
            results.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {results.length} result{results.length === 1 ? "" : "s"} · sorted by reliability
                </p>
                {results.map((m) => (
                  <ModelRow key={m.id} model={m} onSelect={() => handleSelect(m.id)} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Search className="size-5 text-muted-foreground/50" />
                <p className="text-[13.5px] font-medium">No models found</p>
                <p className="max-w-xs text-[12px] text-muted-foreground">
                  Nothing matches “{query.trim()}”. Try a model name, provider,
                  or a capability like “vision”.
                </p>
              </div>
            )
          ) : (
            <>
              {/* ---------- Recommended ---------- */}
              <section aria-label="Recommended models">
                <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Recommended
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {recommended.map(({ model, category }, i) => (
                    <RecommendedCard
                      key={`${category}-${model.id}`}
                      model={model}
                      category={category}
                      index={i + 1}
                      onSelect={() => handleSelect(model.id)}
                    />
                  ))}
                </div>
              </section>

              {/* ---------- Recently used ---------- */}
              {recentModels.length > 0 && (
                <section aria-label="Recently used models" className="mt-4">
                  <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Clock3 className="size-3" /> Recently used
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {recentModels
                      .filter((m) => !recommended.some((r) => r.model.id === m.id))
                      .map((m) => (
                        <ModelRow
                          key={m.id}
                          model={m}
                          compact
                          onSelect={() => handleSelect(m.id)}
                        />
                      ))}
                  </div>
                </section>
              )}

              {/* ---------- Favorites ---------- */}
              {favoriteModels.length > 0 && (
                <section aria-label="Favorite models" className="mt-4">
                  <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Star className="size-3" /> Favorites
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {favoriteModels.map((m) => (
                      <ModelRow
                        key={m.id}
                        model={m}
                        compact
                        onSelect={() => handleSelect(m.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ---------- More models (by provider) ---------- */}
              <section aria-label="More models" className="mt-5">
                <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  More models
                </p>
                <div className="flex flex-col gap-3">
                  {grouped.map(({ providerId, models }) => {
                    const provider = getProvider(providerId);
                    return (
                      <div key={providerId}>
                        <div className="flex items-center gap-2 px-1 pb-1">
                          <ProviderLogo provider={providerId} size={14} />
                          <span className="text-[12.5px] font-semibold">
                            {provider.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {models.length} model{models.length === 1 ? "" : "s"}
                          </span>
                          <span className="ml-1 hidden text-[11px] text-muted-foreground/70 sm:inline">
                            {provider.tagline}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {models.map((m) => (
                            <ModelRow
                              key={m.id}
                              model={m}
                              onSelect={() => handleSelect(m.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                <FileText className="mt-0.5 size-3 shrink-0" />
                Reliability blends latency and error rate per provider. The same
                model from different providers is a separate choice — compare
                their scores.
                <ChevronRight className="mt-0.5 size-3 shrink-0" />
              </p>
            </>
          )}
        </div>
    </>
  );
}
