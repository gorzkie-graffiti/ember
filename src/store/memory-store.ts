"use client";

import { create } from "zustand";
import type { MemoryCategory, MemoryEntry } from "@/lib/models/types";
import {
  scoreMemory,
  screenMemoryContent,
  SENSITIVE_PATTERNS,
  matchesAny,
  MEMORY_CATEGORY_LABELS,
  MEMORY_CATEGORIES,
} from "@/lib/memory";

export { MEMORY_CATEGORY_LABELS };
export const MEMORY_CATEGORY_ORDER = MEMORY_CATEGORIES;

/**
 * Claude-style Memory — a distilled, account-wide knowledge layer captured in
 * real time from conversations. Incognito chats never read or write here.
 *
 * The server (/api/memories) is the source of truth for BOTH the entries and
 * the prefs (/api/memories/prefs). Every mutation is mirrored with
 * fire-and-forget requests; GET /api/memories re-syncs everything.
 */
export interface MemoryPrefs {
  /** Pause: keep memory, stop using it and stop making new memories. */
  paused: boolean;
  /** Opt-in: allow sensitive topics (health, religion, politics...) to be stored. */
  includeSensitive: boolean;
}

interface MemoryStore {
  memories: MemoryEntry[];
  prefs: MemoryPrefs;
  /** True once memories have been loaded from the server. */
  hydrated: boolean;
  /** Set when a capture touched a sensitive topic while the toggle is off —
   *  powers the Claude-style review notice. Cleared on dismiss. */
  pendingSensitiveNotice: boolean;

  hydrateFromServer: () => Promise<void>;
  addMemory: (
    content: string,
    category?: MemoryCategory,
    source?: "user" | "auto",
    opts?: { force?: boolean },
  ) => MemoryEntry | null;
  updateMemory: (id: string, content: string, category?: MemoryCategory) => void;
  deleteMemory: (id: string) => void;
  resetAll: () => void;
  setPrefs: (patch: Partial<MemoryPrefs>) => void;
  dismissSensitiveNotice: () => void;
  /** Relevance-weighted memories consulted for a (non-incognito) generation. */
  relevantMemories: (query?: string, limit?: number) => MemoryEntry[];
  /** True when the given text touches sensitive topics (for the notice). */
  touchesSensitive: (text: string) => boolean;
}

function upsertOnServer(memory: MemoryEntry, includeSensitive: boolean) {
  void fetch("/api/memories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memory: { ...memory, includeSensitive } }),
  }).catch(() => {});
}

function deleteOnServer(id: string) {
  void fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {});
}

function guessCategory(content: string): MemoryCategory {
  const lower = content.toLowerCase();
  if (/\b(name is|my name|call me|lives in|based in)\b/.test(lower))
    return "people";
  if (/\b(prefer|like|dislike|hate|concise|short|verbose|style|tone)\b/.test(lower))
    return "preferences";
  if (/\b(work|job|role|team|company|title|colleague|boss)\b/.test(lower))
    return "work-role";
  if (/\b(project|building|app|prototype|migration|startup)\b/.test(lower))
    return "projects";
  if (
    /\b(typescript|python|react|rust|go|linux|mac|windows|stack|tool|editor|neovim|vscode)\b/.test(
      lower,
    )
  )
    return "technical";
  if (
    /\b(friend|wife|husband|partner|mother|father|sister|brother|lives in|based in|city|country)\b/.test(
      lower,
    )
  )
    return "people";
  return "preferences";
}

function makeEntry(
  content: string,
  category: MemoryCategory,
  source: "user" | "auto",
): MemoryEntry {
  const now = Date.now();
  return {
    id: `mem-${now}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    content,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

/** Double-invoke guard for hydrateFromServer(). */
let hydratePromise: Promise<void> | null = null;

export const useMemoryStore = create<MemoryStore>()((set, get) => ({
  memories: [],
  prefs: { paused: false, includeSensitive: false },
  hydrated: false,
  pendingSensitiveNotice: false,

  hydrateFromServer: () => {
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const resp = await fetch("/api/memories", { cache: "no-store" });
        if (!resp.ok) return;
        const json = (await resp.json()) as {
          memories?: MemoryEntry[];
          prefs?: Partial<MemoryPrefs>;
        };
        set({
          memories: Array.isArray(json?.memories) ? json.memories : [],
          prefs: {
            paused: json?.prefs?.paused === true,
            includeSensitive: json?.prefs?.includeSensitive === true,
          },
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

  addMemory: (content, category, source = "user", opts) => {
    const trimmed = content.trim();
    if (trimmed.length < 2) return null;

    const { prefs, memories } = get();
    // Hard-never is absolute; sensitive requires the opt-in toggle. When the
    // gate blocks, show the Claude-style review notice instead of saving.
    const screen = screenMemoryContent(trimmed, prefs.includeSensitive);
    if (screen) {
      if (screen === "sensitive") set({ pendingSensitiveNotice: true });
      return null;
    }

    // Dedupe (Claude keeps memory curated): exact or containment match.
    const lower = trimmed.toLowerCase();
    const dupe = memories.find(
      (m) =>
        m.content.toLowerCase() === lower ||
        m.content.toLowerCase().includes(lower) ||
        lower.includes(m.content.toLowerCase()),
    );
    if (dupe && !opts?.force) return dupe;

    const entry = makeEntry(trimmed, category ?? guessCategory(trimmed), source);
    set((s) => ({ memories: [entry, ...s.memories] }));
    upsertOnServer(entry, prefs.includeSensitive);
    return entry;
  },

  updateMemory: (id, content, category) => {
    const { prefs } = get();
    const trimmed = content.trim();
    if (trimmed.length < 2) return;

    // Re-screen edited content against the same gates (hard-never is absolute).
    const screen = screenMemoryContent(trimmed, prefs.includeSensitive);
    if (screen === "hard-never") return;

    let updated: MemoryEntry | undefined;
    set((s) => ({
      memories: s.memories.map((m) =>
        m.id === id
          ? (updated = {
              ...m,
              content: trimmed,
              category: category ?? m.category,
              updatedAt: Date.now(),
            })
          : m,
      ),
    }));
    if (updated) upsertOnServer(updated, prefs.includeSensitive);
  },

  deleteMemory: (id) => {
    set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }));
    deleteOnServer(id);
  },

  resetAll: () => {
    set({ memories: [] });
    void fetch("/api/memories?id=all", { method: "DELETE" }).catch(() => {});
  },

  setPrefs: (patch) => {
    set((s) => ({ prefs: { ...s.prefs, ...patch } }));
    void fetch("/api/memories/prefs", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
    // Turning sensitive topics OFF removes already-saved sensitive entries,
    // mirroring Claude ("Claude removes any sensitive items already saved").
    if (patch.includeSensitive === false) {
      const { memories } = get();
      const sensitiveIds = memories
        .filter((m) => matchesAny(m.content, SENSITIVE_PATTERNS))
        .map((m) => m.id);
      if (sensitiveIds.length > 0) {
        set((s) => ({
          memories: s.memories.filter((m) => !sensitiveIds.includes(m.id)),
        }));
        for (const id of sensitiveIds) deleteOnServer(id);
      }
    }
  },

  dismissSensitiveNotice: () => set({ pendingSensitiveNotice: false }),

  relevantMemories: (query = "", limit = 4) => {
    const { memories, prefs } = get();
    if (prefs.paused) return [];
    if (memories.length === 0) return [];
    if (!query.trim()) {
      // No query context (regenerate/continue paths): recency-ordered head.
      return memories.slice(0, limit);
    }
    const scored = memories
      .map((m) => ({ m, score: scoreMemory(m.content, query, m.updatedAt) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.m);
    // Relevance-weighting with graceful fallback: if nothing scores, inject
    // nothing rather than the whole list — Claude never dumps memory verbatim.
    return scored;
  },

  touchesSensitive: (text) => matchesAny(text, SENSITIVE_PATTERNS),
}));
