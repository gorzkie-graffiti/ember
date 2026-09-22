"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  FileText,
  MessageSquareQuote,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PromptDoc, PromptOrigin, PromptType } from "@/lib/models/types";
import { promptGroupMeta } from "@/lib/constants";
import { usePromptsStore } from "@/store/prompts-store";
import { MobileNavButton } from "../MobileNavButton";
import { ApiKeysCard } from "./ApiKeysCard";

const MAX_TEXT = 48_000;

function OriginBadge({ origin }: { origin: PromptOrigin }) {
  return origin === "leaked" ? (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
      title="Captured from another product"
    >
      <ShieldAlert className="size-2.5" /> leaked
    </span>
  ) : (
    <span
      className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground"
      title="Authored here"
    >
      user
    </span>
  );
}

function TypeBadge({ type }: { type: PromptType }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-primary">
      {type === "style" ? (
        <Sparkles className="size-2.5" />
      ) : (
        <MessageSquareQuote className="size-2.5" />
      )}
      {type === "style" ? "style" : "prompt"}
    </span>
  );
}

function PromptEditor({
  draft,
  onClose,
}: {
  /** Full doc when editing; id-less stub when creating. */
  draft: PromptDoc;
  onClose: () => void;
}) {
  const savePrompt = usePromptsStore((s) => s.savePrompt);
  const [name, setName] = useState(draft.name);
  const [type, setType] = useState<PromptType>(draft.type);
  const [origin, setOrigin] = useState<PromptOrigin>(draft.origin);
  const [text, setText] = useState(draft.text);

  const isEditing = Boolean(draft.id);
  const canSave = name.trim().length > 0 && text.trim().length > 0;

  const save = () => {
    savePrompt({
      id: draft.id || undefined,
      name: name.trim(),
      type,
      origin,
      text,
    });
    onClose();
    toast.success(isEditing ? "Prompt updated" : "Prompt created", {
      description: name.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name — e.g. My first system prompt"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/70"
        />
        <Select value={type} onValueChange={(v) => setType(v as PromptType)}>
          <SelectTrigger className="h-9 w-[150px] shrink-0 rounded-full text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system-prompt">System Prompt</SelectItem>
            <SelectItem value="style">Style</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={origin}
          onValueChange={(v) => setOrigin(v as PromptOrigin)}
          disabled={isEditing}
        >
          <SelectTrigger
            className="h-9 w-[110px] shrink-0 rounded-full text-[12px]"
            title={isEditing ? "Origin is fixed after creation" : "Where is it from?"}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="leaked">Leaked</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
        rows={8}
        placeholder={"Paste or type the prompt/style text here…"}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-muted-foreground">
          {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()} chars
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[12.5px]"
            onClick={onClose}
          >
            <X className="size-3" /> Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full px-4 text-[12.5px]"
            disabled={!canSave}
            onClick={save}
          >
            <Check className="size-3" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function PromptCard({ doc }: { doc: PromptDoc }) {
  const setActive = usePromptsStore((s) => s.setActive);
  const activeSystemPromptId = usePromptsStore((s) => s.activeSystemPromptId);
  const activeInstructionsId = usePromptsStore((s) => s.activeInstructionsId);
  const deletePrompt = usePromptsStore((s) => s.deletePrompt);

  const [editing, setEditing] = useState(false);

  const isSystemActive = activeSystemPromptId === doc.id;
  const isInstructionsActive = activeInstructionsId === doc.id;
  const group = promptGroupMeta(doc.group);

  return (
    <div
      className={cn(
        "group rounded-xl border bg-card px-3.5 py-3",
        isSystemActive || isInstructionsActive
          ? "border-primary/50 shadow-[0_0_0_1px_oklch(0.665_0.185_40/25%)]"
          : "border-border/60",
      )}
    >
      {editing ? (
        <PromptEditor draft={doc} onClose={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
              {doc.name}
            </p>
            <TypeBadge type={doc.type} />
            <OriginBadge origin={doc.origin} />
            {group ? (
              <span
                className="hidden shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline"
                title={group.description || "Prompt collection"}
              >
                {group.label}
              </span>
            ) : null}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                aria-label={`Edit ${doc.name}`}
                onClick={() => setEditing(true)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Edit"
              >
                <Pencil className="size-3.5" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    aria-label={`Delete ${doc.name}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete “{doc.name}”?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the{" "}
                      {doc.type === "style" ? "style" : "system prompt"}. If it
                      is currently active, that slot falls back to the built-in
                      behavior.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => {
                        deletePrompt(doc.id);
                        toast.success("Deleted");
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted-foreground">
            {doc.text || "Empty — no text yet."}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Button
              variant={isSystemActive ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1.5 rounded-full text-[11.5px]"
              onClick={() => {
                const next = !isSystemActive;
                setActive("system-prompt", next ? doc.id : null);
                toast[next ? "success" : "info"](
                  next ? "Active system prompt set" : "Built-in system prompt restored",
                  { description: doc.name },
                );
              }}
            >
              {isSystemActive ? <Check className="size-3" /> : null}
              {isSystemActive ? "Active system prompt" : "Use as System Prompt"}
            </Button>
            <Button
              variant={isInstructionsActive ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1.5 rounded-full text-[11.5px]"
              onClick={() => {
                const next = !isInstructionsActive;
                setActive("instructions", next ? doc.id : null);
                toast[next ? "success" : "info"](
                  next ? "User instructions set" : "User instructions cleared",
                  { description: doc.name },
                );
              }}
            >
              {isInstructionsActive ? <Check className="size-3" /> : null}
              {isInstructionsActive
                ? "Active instructions"
                : "Use as User Instructions"}
            </Button>
            <span className="ml-auto hidden text-[10.5px] text-muted-foreground/70 sm:inline">
              edited{" "}
              {new Date(doc.updatedAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function SlotRow({
  label,
  hint,
  active,
  fallback,
}: {
  label: string;
  hint: string;
  active: PromptDoc | null;
  fallback: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium">{label}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>
      </div>
      <span
        className={cn(
          "max-w-[50%] shrink-0 truncate rounded-full px-2.5 py-1 text-[11.5px] font-medium",
          active
            ? "bg-primary/10 text-primary"
            : "bg-secondary text-muted-foreground",
        )}
        title={active?.text ? active.text.slice(0, 200) : undefined}
      >
        {active ? active.name : fallback}
        {active ? <ChevronDown className="ml-1 inline size-3" /> : null}
      </span>
    </div>
  );
}

const EMPTY_DRAFT: PromptDoc = {
  id: "",
  name: "",
  type: "system-prompt",
  origin: "user",
  text: "",
  createdAt: 0,
  updatedAt: 0,
};

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function SettingsView() {
  const prompts = usePromptsStore((s) => s.prompts);
  const hydrated = usePromptsStore((s) => s.hydrated);
  const hydrateFromServer = usePromptsStore((s) => s.hydrateFromServer);
  const activeSystemPromptId = usePromptsStore((s) => s.activeSystemPromptId);
  const activeInstructionsId = usePromptsStore((s) => s.activeInstructionsId);

  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<"all" | PromptOrigin>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | PromptType>("all");

  useEffect(() => {
    if (!hydrated) void hydrateFromServer();
  }, [hydrated, hydrateFromServer]);

  const systemActive = useMemo(
    () => prompts.find((p) => p.id === activeSystemPromptId) ?? null,
    [prompts, activeSystemPromptId],
  );
  const instructionsActive = useMemo(
    () => prompts.find((p) => p.id === activeInstructionsId) ?? null,
    [prompts, activeInstructionsId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (originFilter !== "all" && p.origin !== originFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (q &&
          !p.name.toLowerCase().includes(q) &&
          !(p.group ? promptGroupMeta(p.group)?.label.toLowerCase().includes(q) : false))
        return false;
      return true;
    });
  }, [prompts, query, originFilter, typeFilter]);
  const filtersActive =
    query.trim().length > 0 || originFilter !== "all" || typeFilter !== "all";

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-start gap-2">
          <MobileNavButton />
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-semibold">
              <Settings2 className="size-5 text-primary" /> Settings
            </h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
              Manage System Prompts and Styles. A System Prompt replaces Ember’s
              built-in one; a Style shapes how replies are written and can also
              serve as User Instructions.
            </p>
          </div>
        </header>

        {/* Per-account provider credentials */}
        <ApiKeysCard />

        {/* Active selection summary */}
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-4">
          <SlotRow
            label="System Prompt"
            hint="Replaces the built-in Ember system prompt entirely."
            active={systemActive}
            fallback="Built-in Ember prompt"
          />
          <div className="h-px bg-border/60" role="presentation" />
          <SlotRow
            label="User Instructions"
            hint="Appended after the system prompt on every message."
            active={instructionsActive}
            fallback="None"
          />
        </div>

        {/* Create */}
        {creating ? (
          <div className="mb-6 rounded-xl border border-primary/40 bg-primary/5 p-3.5">
            <PromptEditor draft={EMPTY_DRAFT} onClose={() => setCreating(false)} />
          </div>
        ) : (
          <div className="mb-6 flex justify-end">
            <Button
              className="h-8 gap-1.5 rounded-full text-[12.5px]"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-3.5" /> New prompt / style
            </Button>
          </div>
        )}

        {/* Search + filters */}
        {prompts.length > 0 ? (
          <div className="mb-4 flex flex-col gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${prompts.length} prompts & styles…`}
                className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-9 text-[13px] outline-none placeholder:text-muted-foreground/70"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                active={originFilter === "all"}
                onClick={() => setOriginFilter("all")}
              >
                All
              </FilterChip>
              <FilterChip
                active={originFilter === "leaked"}
                onClick={() => setOriginFilter("leaked")}
              >
                Leaked
              </FilterChip>
              <FilterChip
                active={originFilter === "user"}
                onClick={() => setOriginFilter("user")}
              >
                User
              </FilterChip>
              <span
                className="mx-1 h-4 w-px bg-border"
                role="presentation"
              />
              <FilterChip
                active={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
              >
                Any type
              </FilterChip>
              <FilterChip
                active={typeFilter === "system-prompt"}
                onClick={() => setTypeFilter("system-prompt")}
              >
                Prompts
              </FilterChip>
              <FilterChip
                active={typeFilter === "style"}
                onClick={() => setTypeFilter("style")}
              >
                Styles
              </FilterChip>
              {filtersActive ? (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {filtered.length} of {prompts.length}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* List */}
        {prompts.length === 0 && !creating ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <FileText className="size-5" />
            </span>
            <div>
              <p className="text-[14px] font-medium">
                No prompts or styles yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                Create one here, or import the library with{" "}
                <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
                  node scripts/import-prompt-copy.mjs
                </code>{" "}
                (source files in{" "}
                <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
                  sys_prompts_copy/
                </code>).
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-[13px] text-muted-foreground">
            No matches — try a different search or filter.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((doc) => (
              <PromptCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
