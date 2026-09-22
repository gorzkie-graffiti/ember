"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Brain,
  BrainCog,
  Check,
  EyeOff,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemoryCategory, MemoryEntry } from "@/lib/models/types";
import {
  useMemoryStore,
  MEMORY_CATEGORY_LABELS,
  MEMORY_CATEGORY_ORDER,
} from "@/store/memory-store";
import { SENSITIVE_PATTERNS, matchesAny } from "@/lib/memory";
import { MobileNavButton } from "../MobileNavButton";

/** Order topics the way Claude's memory settings list them. */
const CATEGORY_ORDER: MemoryCategory[] = [...MEMORY_CATEGORY_ORDER];

function isSensitiveEntry(m: MemoryEntry): boolean {
  return matchesAny(m.content, SENSITIVE_PATTERNS);
}

function CategoryBlock({
  category,
  entries,
}: {
  category: MemoryCategory;
  entries: MemoryEntry[];
}) {
  const updateMemory = useMemoryStore((s) => s.updateMemory);
  const deleteMemory = useMemoryStore((s) => s.deleteMemory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (entries.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {MEMORY_CATEGORY_LABELS[category]}
      </h3>
      <div className="flex flex-col gap-1.5">
        {entries.map((m) => (
          <div
            key={m.id}
            className="group flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 py-2.5"
          >
            {editingId === m.id ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      updateMemory(m.id, draft);
                      setEditingId(null);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 rounded-lg border border-primary/40 bg-background px-2.5 py-1.5 text-[13px] outline-none"
                />
                <button
                  aria-label="Save memory"
                  onClick={() => {
                    if (draft.trim()) updateMemory(m.id, draft);
                    setEditingId(null);
                  }}
                  className="rounded-md p-1.5 text-emerald-500 hover:bg-secondary"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  aria-label="Cancel edit"
                  onClick={() => setEditingId(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
                  {m.content}
                </p>
                {isSensitiveEntry(m) && (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                    title="Sensitive topic — stored because you enabled sensitive topics"
                  >
                    <ShieldAlert className="size-2.5" /> sensitive
                  </span>
                )}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
                    m.source === "user"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                  title={
                    m.source === "user"
                      ? "You asked to remember this"
                      : "Captured automatically from your conversations"
                  }
                >
                  {m.source}
                </span>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    aria-label="Edit memory"
                    onClick={() => {
                      setDraft(m.content);
                      setEditingId(m.id);
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    aria-label="Delete memory"
                    onClick={() => {
                      deleteMemory(m.id);
                      toast.success("Memory deleted");
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MemoryView() {
  const memories = useMemoryStore((s) => s.memories);
  const prefs = useMemoryStore((s) => s.prefs);
  const setPrefs = useMemoryStore((s) => s.setPrefs);
  const pendingSensitiveNotice = useMemoryStore((s) => s.pendingSensitiveNotice);
  const dismissSensitiveNotice = useMemoryStore((s) => s.dismissSensitiveNotice);
  const resetAll = useMemoryStore((s) => s.resetAll);
  const addMemory = useMemoryStore((s) => s.addMemory);
  const hydrateFromServer = useMemoryStore((s) => s.hydrateFromServer);
  const hydrated = useMemoryStore((s) => s.hydrated);

  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("preferences");
  const [screenError, setScreenError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) void hydrateFromServer();
  }, [hydrated, hydrateFromServer]);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    entries: memories.filter((m) => m.category === cat),
  }));

  const handleAdd = () => {
    const result = addMemory(newContent, newCategory, "user", { force: true });
    if (!result) {
      const lower = newContent.toLowerCase();
      if (matchesAny(lower, SENSITIVE_PATTERNS) && !prefs.includeSensitive) {
        setScreenError(
          'Sensitive topics are excluded from memory. Turn on "Include sensitive topics" below to save this.',
        );
      } else {
        setScreenError("This kind of information is never saved to memory.");
      }
      return;
    }
    setNewContent("");
    setAdding(false);
    setScreenError(null);
    toast.success("Memory added");
  };

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-start gap-2">
          <MobileNavButton />
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-semibold">
              <Brain className="size-5 text-primary" /> Memory
            </h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
              Durable facts captured from your conversations as you chat — shown
              as individual topics you can edit or delete. Say{" "}
              <em className="not-italic text-foreground">“Remember this…”</em> in
              any chat to save something directly.
            </p>
          </div>
        </header>

        {/* Claude-style settings block */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border/60 bg-card px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label
                htmlFor="memory-enabled"
                className="flex items-center gap-1.5 text-[13.5px] font-medium"
              >
                {prefs.paused ? (
                  <BrainCog className="size-4 text-muted-foreground" />
                ) : (
                  <Brain className="size-4 text-primary" />
                )}
                Generate memory from chats
              </label>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {prefs.paused
                  ? "Memory is paused — existing memories are kept but not used, and nothing new is saved."
                  : "Durable facts are captured automatically as you chat."}
              </p>
            </div>
            <Switch
              id="memory-enabled"
              checked={!prefs.paused}
              onCheckedChange={(checked) => {
                setPrefs({ paused: !checked });
                toast[checked ? "success" : "info"](
                  checked ? "Memory resumed" : "Memory paused",
                  {
                    description: checked
                      ? "New memories will be captured again."
                      : "Existing memories are kept but not used. Nothing new is saved.",
                  },
                );
              }}
              aria-label="Generate memory from chats"
            />
          </div>

          <div className="h-px bg-border/60" role="presentation" />

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label
                htmlFor="memory-sensitive"
                className="flex items-center gap-1.5 text-[13.5px] font-medium"
              >
                <ShieldAlert className="size-4 text-amber-500" />
                Include sensitive topics
              </label>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Off by default: health, race, religion, politics and gender
                identity are never stored. Turning this on also removes any
                saved sensitive entries when switched off later.
              </p>
            </div>
            <Switch
              id="memory-sensitive"
              checked={prefs.includeSensitive}
              onCheckedChange={(checked) => {
                setPrefs({ includeSensitive: checked });
                toast[checked ? "success" : "info"](
                  checked
                    ? "Sensitive topics will be saved"
                    : "Sensitive topics excluded",
                  {
                    description: checked
                      ? "Entries on these topics will be stored going forward (not retroactively)."
                      : "Existing sensitive entries have been removed.",
                  },
                );
              }}
              aria-label="Include sensitive topics in memory"
            />
          </div>

          <div className="h-px bg-border/60" role="presentation" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              {memories.length}{" "}
              {memories.length === 1 ? "memory" : "memories"} stored
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-[12.5px]"
                onClick={() => {
                  setScreenError(null);
                  setAdding(true);
                }}
              >
                <Plus className="size-3.5" /> Add memory
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-full border-destructive/40 text-[12.5px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={memories.length === 0}
                  >
                    <RotateCcw className="size-3.5" /> Reset all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all Memory?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes all {memories.length} memor
                      {memories.length === 1 ? "y" : "ies"}. Chat history is not
                      affected. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => {
                        resetAll();
                        toast.success("All memory cleared");
                      }}
                    >
                      Reset Memory
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Claude-style sensitive-topics review notice */}
        {pendingSensitiveNotice && !prefs.includeSensitive && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/8 px-4 py-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">
                Claude-style memory: sensitive topic skipped
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Something in your conversation touched a sensitive topic, so it
                wasn’t saved to memory. Enable “Include sensitive topics” above
                if you’d like topics like this remembered.
              </p>
            </div>
            <button
              aria-label="Dismiss notice"
              onClick={dismissSensitiveNotice}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Add form */}
        {adding && (
          <div className="mb-6 flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3.5">
            <input
              autoFocus
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. Prefers dark mode and concise answers"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none placeholder:text-muted-foreground/70"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newContent.trim()) handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            {screenError && (
              <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-amber-600 dark:text-amber-400">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {screenError}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <Select
                value={newCategory}
                onValueChange={(v) => setNewCategory(v as MemoryCategory)}
              >
                <SelectTrigger className="h-8 w-44 rounded-full text-[12.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c} className="text-[13px]">
                      {MEMORY_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[12.5px]"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-full px-4 text-[12.5px]"
                  disabled={!newContent.trim()}
                  onClick={handleAdd}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Entries */}
        {memories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Brain className="size-5" />
            </span>
            <div>
              <p className="text-[14px] font-medium">No memories yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                {prefs.paused
                  ? "Memory is paused — resume it to start capturing again."
                  : "Chat normally and durable facts will collect here. You can also say “Remember that…” in any chat."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {grouped.map(({ category, entries }) => (
              <CategoryBlock key={category} category={category} entries={entries} />
            ))}
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-secondary/40 px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" />
          Incognito chats never read from or write to Memory. Government IDs,
          financial account numbers, criminal history and immigration status are
          never saved — even with sensitive topics enabled.
        </p>
      </div>
    </div>
  );
}
