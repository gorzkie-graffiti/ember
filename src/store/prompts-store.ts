"use client";

import { create } from "zustand";
import type { PromptDoc, PromptOrigin, PromptType } from "@/lib/models/types";

/**
 * Client store for System Prompts & Styles (Settings view).
 * The server file `sys_prompts/prompts.json` is the source of truth; every
 * mutation is mirrored fire-and-forget and hydrateFromServer() re-syncs.
 */
interface PromptsStore {
  prompts: PromptDoc[];
  /** Active doc replacing the built-in system prompt (null = built-in). */
  activeSystemPromptId: string | null;
  /** Active doc injected as User Instructions (null = none). */
  activeInstructionsId: string | null;
  hydrated: boolean;

  hydrateFromServer: () => Promise<void>;
  savePrompt: (
    doc: Omit<PromptDoc, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => PromptDoc;
  deletePrompt: (id: string) => void;
  setActive: (slot: "system-prompt" | "instructions", id: string | null) => void;
}

let hydratePromise: Promise<void> | null = null;

function upsertOnServer(doc: PromptDoc) {
  void fetch("/api/prompts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: doc }),
  }).catch(() => {});
}

function deleteOnServer(id: string) {
  void fetch(`/api/prompts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {});
}

export const usePromptsStore = create<PromptsStore>()((set, get) => ({
  prompts: [],
  activeSystemPromptId: null,
  activeInstructionsId: null,
  hydrated: false,

  hydrateFromServer: () => {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      try {
        const resp = await fetch("/api/prompts", { cache: "no-store" });
        if (!resp.ok) return;
        const json = (await resp.json()) as {
          prompts?: PromptDoc[];
          activeSystemPromptId?: string | null;
          activeInstructionsId?: string | null;
        };
        set({
          prompts: Array.isArray(json?.prompts) ? json.prompts : [],
          activeSystemPromptId: json?.activeSystemPromptId ?? null,
          activeInstructionsId: json?.activeInstructionsId ?? null,
          hydrated: true,
        });
      } catch {
        // Offline-tolerant: keep local state; a reload retries.
      } finally {
        hydratePromise = null;
      }
    })();
    return hydratePromise;
  },

  savePrompt: (input) => {
    const now = Date.now();
    const existing = input.id
      ? get().prompts.find((p) => p.id === input.id)
      : undefined;

    const doc: PromptDoc = {
      id: existing?.id ?? `p-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      type: input.type,
      // Origin is fixed at creation (Claude-style provenance integrity).
      origin: existing?.origin ?? input.origin,
      text: input.text,
      // Group membership survives edits (imported library collections).
      group: input.group ?? existing?.group ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    set((s) => ({
      prompts: existing
        ? s.prompts.map((p) => (p.id === doc.id ? doc : p))
        : [doc, ...s.prompts],
    }));
    upsertOnServer(doc);
    return doc;
  },

  deletePrompt: (id) => {
    set((s) => ({
      prompts: s.prompts.filter((p) => p.id !== id),
      activeSystemPromptId:
        s.activeSystemPromptId === id ? null : s.activeSystemPromptId,
      activeInstructionsId:
        s.activeInstructionsId === id ? null : s.activeInstructionsId,
    }));
    deleteOnServer(id);
  },

  setActive: (slot, id) => {
    set(
      slot === "system-prompt"
        ? { activeSystemPromptId: id }
        : { activeInstructionsId: id },
    );
    void fetch("/api/prompts/active", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, id }),
    }).catch(() => {});
  },
}));
