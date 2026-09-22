"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Cog,
  FileText,
  FolderTree,
  MessageSquareQuote,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { promptGroupMeta } from "@/lib/constants";
import type { PromptDoc, PromptType } from "@/lib/models/types";
import { usePromptsStore } from "@/store/prompts-store";
import { useUIStore } from "@/store/ui-store";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function TypeIcon({ type, className }: { type: PromptType; className?: string }) {
  return type === "style" ? (
    <Sparkles className={className} />
  ) : (
    <MessageSquareQuote className={className} />
  );
}

/** Doc badge: sparkles = style, quote = system prompt. */
function TypeChip({ doc }: { doc: PromptDoc }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
        doc.type === "style"
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-muted-foreground",
      )}
      title={doc.type === "style" ? "Style" : "System prompt"}
    >
      <TypeIcon type={doc.type} className="size-2.5" />
      {doc.type === "style" ? "style" : "prompt"}
    </span>
  );
}

function GroupHeader({
  label,
  description,
  count,
}: {
  label: string;
  description: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline gap-2 px-1 pb-1.5 pt-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 truncate text-[10.5px] text-muted-foreground/60">
        {description}
      </span>
      <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-muted-foreground/60">
        {count}
      </span>
    </div>
  );
}

/** One selectable prompt/style row, shared by list & search results. */
function PromptRow({
  doc,
  slot,
  onSelect,
  showGroup,
}: {
  doc: PromptDoc;
  slot: "system-prompt" | "instructions";
  onSelect: () => void;
  showGroup?: boolean;
}) {
  const activeSystemPromptId = usePromptsStore((s) => s.activeSystemPromptId);
  const activeInstructionsId = usePromptsStore((s) => s.activeInstructionsId);
  const active = slot === "system-prompt" ? activeSystemPromptId : activeInstructionsId;
  const isActive = active === doc.id;
  const group = promptGroupMeta(doc.group);

  return (
    <button
      type="button"
      onClick={onSelect}
      title={doc.text.slice(0, 240)}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all",
        isActive
          ? "border-primary/50 bg-primary/8"
          : "border-transparent hover:border-border/60 hover:bg-secondary/50",
      )}
    >
      <TypeIcon
        type={doc.type}
        className={cn(
          "size-4 shrink-0",
          doc.type === "style" ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">{doc.name}</span>
          <TypeChip doc={doc} />
          {isActive && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
              <Check className="size-3" /> Active
            </span>
          )}
        </span>
        {showGroup && group ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {group.label}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog body                                                         */
/* ------------------------------------------------------------------ */

type Slot = "system-prompt" | "instructions";

const SLOT_LABELS: Record<Slot, string> = {
  "system-prompt": "System Prompt",
  instructions: "Style / Instructions",
};

function PromptsPickerBody() {
  const setOpen = useUIStore((s) => s.setPromptsPickerOpen);
  const prompts = usePromptsStore((s) => s.prompts);
  const hydrated = usePromptsStore((s) => s.hydrated);
  const hydrateFromServer = usePromptsStore((s) => s.hydrateFromServer);
  const setActive = usePromptsStore((s) => s.setActive);
  const activeSystemPromptId = usePromptsStore((s) => s.activeSystemPromptId);
  const activeInstructionsId = usePromptsStore((s) => s.activeInstructionsId);

  const [slot, setSlot] = useState<Slot>("system-prompt");
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!hydrated) void hydrateFromServer();
  }, [hydrated, hydrateFromServer]);

  /** Version → doc[] preserving import order, ungrouped docs last. */
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, PromptDoc[]>();
    for (const p of prompts) {
      const key = p.group ?? "";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(p);
    }
    return order.map((key) => ({ key, docs: map.get(key)! }));
  }, [prompts]);

  /** Docs for the active slot — styles can't fill the system-prompt slot. */
  const slotDocs = useMemo(
    () =>
      prompts.filter((p) =>
        slot === "instructions" ? true : p.type === "system-prompt",
      ),
    [prompts, slot],
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return slotDocs.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.group ? promptGroupMeta(p.group)?.label.toLowerCase().includes(q) : false),
    );
  }, [query, slotDocs]);

  const activeDoc =
    slot === "system-prompt"
      ? (prompts.find((p) => p.id === activeSystemPromptId) ?? null)
      : (prompts.find((p) => p.id === activeInstructionsId) ?? null);

  const choose = (id: string | null) => {
    setActive(slot, id);
    setOpen(false);
  };

  return (
    <>
      <DialogHeader className="border-b border-border/60 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <DialogTitle className="text-base">Prompts & Styles</DialogTitle>
          {/* Slot switcher */}
          <div
            role="tablist"
            aria-label="Prompt slot"
            className="ml-auto flex h-7 items-center gap-0.5 rounded-full bg-secondary/70 p-0.5"
          >
            {(Object.keys(SLOT_LABELS) as Slot[]).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={slot === s}
                onClick={() => {
                  setSlot(s);
                  setQuery("");
                  setOpenGroupId(null);
                }}
                className={cn(
                  "h-6 rounded-full px-2.5 text-[11.5px] font-medium transition-all",
                  slot === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <DialogDescription className="sr-only">
          Browse the prompt library by version and pick what applies to your
          chats: the system prompt, or a style injected as user instructions.
        </DialogDescription>

        {/* Active selection line */}
        <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="shrink-0">
            {SLOT_LABELS[slot]}:
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium",
              activeDoc ? "text-foreground" : "text-muted-foreground/70",
            )}
          >
            {activeDoc ? activeDoc.name : slot === "system-prompt" ? "Built-in Ember prompt" : "None"}
          </span>
          {activeDoc ? (
            <button
              type="button"
              onClick={() => choose(null)}
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={
                slot === "system-prompt"
                  ? "Clear — restore the built-in Ember prompt"
                  : "Clear style"
              }
            >
              <X className="size-3" /> Clear
            </button>
          ) : null}
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${slotDocs.length} docs…`}
            aria-label="Search prompts and styles"
            className="h-9 w-full rounded-xl border border-border/70 bg-secondary/40 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
          />
        </div>
      </DialogHeader>

      <div className="scrollbar-thin max-h-[60vh] min-h-[240px] overflow-y-auto px-4 py-3">
        {/* ---------- Search results (flat) ---------- */}
        {searchResults ? (
          searchResults.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
              </p>
              {searchResults.map((doc) => (
                <PromptRow
                  key={doc.id}
                  doc={doc}
                  slot={slot}
                  showGroup
                  onSelect={() => choose(doc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="size-5 text-muted-foreground/50" />
              <p className="text-[13.5px] font-medium">No matches</p>
              <p className="max-w-xs text-[12px] text-muted-foreground">
                Nothing matches “{query.trim()}”.
              </p>
            </div>
          )
        ) : (
          /* ---------- Version → prompt hierarchy ---------- */
          <div className="flex flex-col gap-2">
            {groups.map(({ key, docs }) => {
              const meta = promptGroupMeta(key);
              const label = meta?.label ?? (key || "Ungrouped");
              const description = meta?.description ?? "";
              const open = openGroupId === key;
              const activeInGroup = docs.some(
                (d) => d.id === (slot === "system-prompt" ? activeSystemPromptId : activeInstructionsId),
              );
              return (
                <div
                  key={key}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card/40"
                >
                  <button
                    type="button"
                    onClick={() => setOpenGroupId(open ? null : key)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-90",
                      )}
                    />
                    <FolderTree className="size-3.5 shrink-0 text-muted-foreground/70" />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-medium">
                        {label}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {description}
                      </span>
                    </span>
                    {activeInGroup && (
                      <span
                        className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-primary"
                        title="Your current selection is in here"
                      >
                        active
                      </span>
                    )}
                    <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground/60">
                      {docs.length}
                    </span>
                  </button>

                  {open ? (
                    <div className="flex flex-col gap-0.5 border-t border-border/50 px-2 py-2">
                      {docs.map((doc) => (
                        <PromptRow
                          key={doc.id}
                          doc={doc}
                          slot={slot}
                          onSelect={() => choose(doc.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <FileText className="size-5 text-muted-foreground/50" />
                <p className="text-[13.5px] font-medium">Library is empty</p>
                <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground">
                  Import the library with{" "}
                  <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
                    node scripts/import-prompt-copy.mjs
                  </code>{" "}
                  or add prompts in Settings.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 border-t border-border/60 px-5 py-2.5 text-[11px] leading-snug text-muted-foreground">
        <Cog className="size-3 shrink-0" />
        Applies to every new message. Full management lives in Settings →
        Prompts.
      </p>
    </>
  );
}

export function PromptsPickerDialog() {
  const open = useUIStore((s) => s.promptsPickerOpen);
  const setOpen = useUIStore((s) => s.setPromptsPickerOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Content unmounts on close, so slot/search state resets naturally. */}
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <PromptsPickerBody />
      </DialogContent>
    </Dialog>
  );
}
