"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL_ID,
  DEFAULT_THINKING,
  getModel,
} from "@/lib/models/catalog";
import { PROVIDER_IDS } from "@/lib/models/providers";
import type { EffortLevel, ProviderId } from "@/lib/models/types";

/**
 * Live flags before /api/providers responds. There is no built-in provider —
 * every provider starts locked and is unlocked by `hydrateProviders()` when
 * its API key exists in server env.
 */
const DEFAULT_LIVE_PROVIDERS = Object.fromEntries(
  PROVIDER_IDS.map((id) => [id, false]),
) as Record<ProviderId, boolean>;

interface ProviderStatus {
  id: ProviderId;
  live: boolean;
  envVar: string | null;
}

/**
 * Global model selection + per-user model metadata (favorites, recents).
 * Thinking/Effort live here too; they are clamped against the selected
 * model's capabilities whenever the selection changes (capability-driven).
 *
 * Provider availability is runtime state hydrated from the server env
 * (`GET /api/providers`) — NOT persisted. The static `connected` flag in
 * the catalog is only the baseline; `isModelLive()` is the source of truth
 * used by every guard (picker, model store, chat store).
 */
interface ModelStore {
  selectedModelId: string;
  thinkingEnabled: boolean;
  effort: EffortLevel;
  favoriteModelIds: string[];
  recentModelIds: string[];
  /** Runtime provider availability — hydrated from /api/providers. */
  liveProviders: Record<ProviderId, boolean>;
  /** Env var that would enable a provider, e.g. "GROQ_API_KEY". */
  providerEnvVars: Partial<Record<ProviderId, string>>;

  selectModel: (modelId: string) => void;
  setThinking: (enabled: boolean) => void;
  setEffort: (level: EffortLevel) => void;
  toggleFavorite: (modelId: string) => void;
  isFavorite: (modelId: string) => boolean;
  noteModelUsed: (modelId: string) => void;
  hydrateProviders: () => Promise<void>;
  isModelLive: (modelId: string) => boolean;
}

function clampAgainstModel(
  modelId: string,
  thinkingEnabled: boolean,
  effort: EffortLevel,
): { thinkingEnabled: boolean; effort: EffortLevel } {
  const model = getModel(modelId);
  if (!model) return { thinkingEnabled, effort };

  const caps = model.capabilities;
  let nextThinking = thinkingEnabled;
  let nextEffort = effort;

  // Reasoning-only models: thinking can never be turned off.
  if (caps.reasoningRequired) nextThinking = true;
  if (!caps.thinking) nextThinking = false;

  // Effort: fall back to default level supported by this model.
  if (caps.effortLevels.length > 0 && !caps.effortLevels.includes(nextEffort)) {
    nextEffort = caps.effortLevels.includes("medium")
      ? "medium"
      : caps.effortLevels[0];
  }

  return { thinkingEnabled: nextThinking, effort: nextEffort };
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      selectedModelId: DEFAULT_MODEL_ID,
      thinkingEnabled: DEFAULT_THINKING,
      effort: DEFAULT_EFFORT,
      favoriteModelIds: [],
      recentModelIds: [DEFAULT_MODEL_ID],
      liveProviders: { ...DEFAULT_LIVE_PROVIDERS },
      providerEnvVars: {},

      selectModel: (modelId) =>
        set((s) => {
          // Honesty guard: models whose provider has no key configured can
          // never be selected — ignore the request and keep the selection.
          if (!get().isModelLive(modelId)) return {};

          const clamped = clampAgainstModel(
            modelId,
            s.thinkingEnabled,
            s.effort,
          );
          return {
            selectedModelId: modelId,
            ...clamped,
            recentModelIds: [
              modelId,
              ...s.recentModelIds.filter((id) => id !== modelId),
            ].slice(0, 6),
          };
        }),

      setThinking: (enabled) =>
        set((s) => {
          const model = getModel(s.selectedModelId);
          if (model?.capabilities.reasoningRequired && !enabled) {
            // Locked ON for reasoning-only models — ignore the request.
            return { thinkingEnabled: true };
          }
          if (!model?.capabilities.thinking) return { thinkingEnabled: false };
          return { thinkingEnabled: enabled };
        }),

      setEffort: (level) =>
        set((s) => {
          const model = getModel(s.selectedModelId);
          if (!model) return {};
          if (!model.capabilities.effortLevels.includes(level)) return {};
          return { effort: level };
        }),

      toggleFavorite: (modelId) =>
        set((s) => ({
          favoriteModelIds: s.favoriteModelIds.includes(modelId)
            ? s.favoriteModelIds.filter((id) => id !== modelId)
            : [...s.favoriteModelIds, modelId],
        })),

      isFavorite: (modelId) => get().favoriteModelIds.includes(modelId),

      noteModelUsed: (modelId) =>
        set((s) => ({
          recentModelIds: [
            modelId,
            ...s.recentModelIds.filter((id) => id !== modelId),
          ].slice(0, 6),
        })),

      /**
       * Fetch which providers the server can currently serve. Missing key →
       * provider stays locked; key present in env → all of its models light
       * up. Offline-tolerant: on failure the defaults are kept.
       */
      hydrateProviders: async () => {
        try {
          const resp = await fetch("/api/providers", { cache: "no-store" });
          if (!resp.ok) return;
          const json = (await resp.json()) as { providers?: ProviderStatus[] };
          if (!Array.isArray(json?.providers)) return;

          const liveProviders = { ...DEFAULT_LIVE_PROVIDERS };
          const providerEnvVars: Partial<Record<ProviderId, string>> = {};
          for (const status of json.providers) {
            if (!(status.id in liveProviders)) continue;
            liveProviders[status.id] = status.live === true;
            if (status.envVar) providerEnvVars[status.id] = status.envVar;
          }
          set({ liveProviders, providerEnvVars });
        } catch {
          // Server unreachable — keep defaults; retried on next mount.
        }
      },

      /** Source of truth for "can this deployment generate with this model". */
      isModelLive: (modelId) => {
        const model = getModel(modelId);
        if (!model) return false;
        return get().liveProviders[model.provider] === true;
      },
    }),
    {
      name: "ember.model-store",
      version: 3,
      // Rehydrate only after mount (AppShell calls persist.rehydrate()) so the
      // first client render matches SSR exactly — otherwise a persisted
      // model/effort selection shifts the composer's radix useId sequence and
      // triggers a hydration mismatch.
      skipHydration: true,
      // Persist ONLY user preferences — runtime provider status must never
      // leak into localStorage (it would go stale after .env edits).
      partialize: (s) => ({
        selectedModelId: s.selectedModelId,
        thinkingEnabled: s.thinkingEnabled,
        effort: s.effort,
        favoriteModelIds: s.favoriteModelIds,
        recentModelIds: s.recentModelIds,
      }),
      // v2 stored model ids from a retired provider catalog.
      // Drop them so clamping helpers and getModelOrThrow stay valid.
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Partial<ModelStore>;
        return {
          selectedModelId: DEFAULT_MODEL_ID,
          thinkingEnabled: base.thinkingEnabled ?? DEFAULT_THINKING,
          effort: base.effort ?? DEFAULT_EFFORT,
          favoriteModelIds: [],
          recentModelIds: [DEFAULT_MODEL_ID],
        };
      },
      // Validate persisted ids against the CURRENT catalog on every
      // rehydration. The catalog changes over time (providers removed,
      // ids renamed) — without this, a stale localStorage selection
      // reaches getModelOrThrow and crashes the composer render.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ModelStore>;
        const merged: ModelStore = { ...current, ...p };

        if (!getModel(merged.selectedModelId)) {
          merged.selectedModelId = DEFAULT_MODEL_ID;
        }
        merged.favoriteModelIds = merged.favoriteModelIds.filter((id) =>
          getModel(id),
        );
        merged.recentModelIds = merged.recentModelIds.filter((id) =>
          getModel(id),
        );
        if (!merged.recentModelIds.includes(merged.selectedModelId)) {
          merged.recentModelIds = [
            merged.selectedModelId,
            ...merged.recentModelIds,
          ].slice(0, 6);
        }

        return merged;
      },
    },
  ),
);
