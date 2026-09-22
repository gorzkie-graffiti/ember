"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  Eye,
  FileCode2,
  FileJson,
  FileText,
  FileUp,
  ImageIcon,
  MessageSquareQuote,
  Paperclip,
  Plus,
  ScanText,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getModelOrThrow } from "@/lib/models/catalog";
import type { Attachment } from "@/lib/models/types";
import { useModelStore } from "@/store/model-store";
import { useChatStore } from "@/store/chat-store";
import { useComposerStore } from "@/store/composer-store";
import { usePromptsStore } from "@/store/prompts-store";
import { useUIStore } from "@/store/ui-store";
import { ThinkingControls } from "./ThinkingControls";
import { ProviderLogo } from "./ProviderLogo";
import { ACCEPTED_FILE_TYPES, LARGE_PASTE_THRESHOLD } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Attachment chips                                                    */
/* ------------------------------------------------------------------ */

function AttachmentKindIcon({
  kind,
  className,
}: {
  kind: Attachment["kind"];
  className?: string;
}) {
  switch (kind) {
    case "image":
      return <ImageIcon className={className} />;
    case "pdf":
      return <FileUp className={className} />;
    case "code":
      return <FileCode2 className={className} />;
    case "data":
      return <FileJson className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Parse a context-window string like "128k" / "1M" / "8" into tokens. */
function parseContextTokens(contextWindow: string): number | null {
  const match = /^([\d.]+)\s*([kKmM])?$/.exec(contextWindow.trim());
  if (!match) return null;
  const n = parseFloat(match[1]);
  if (Number.isNaN(n)) return null;
  const mult = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2] ? 1_000 : 1;
  return n * mult;
}

function formatTokens(t: number): string {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`;
  if (t >= 1_000) return `${Math.round(t / 1_000)}k`;
  return `${t}`;
}

/** Mocked context-usage meter derived from conversation size (≈4 chars/token). */
function ContextUsageMeter() {
  const model = useModelStore((s) => getModelOrThrow(s.selectedModelId));
  const conversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.currentConversationId),
  );

  const usedTokens = useMemo(() => {
    if (!conversation) return 0;
    let chars = 0;
    for (const m of conversation.messages) {
      chars += m.content.length + (m.thinking?.length ?? 0);
      for (const a of m.attachments ?? []) {
        chars += a.name.length + (a.textContent?.length ?? 0);
      }
    }
    return Math.round(chars / 4);
  }, [conversation]);

  const contextTokens = parseContextTokens(model.contextWindow);
  if (contextTokens === null) return null;
  const pct = Math.min(100, Math.round((usedTokens / contextTokens) * 100));
  // Stay quiet until the conversation actually uses a meaningful slice.
  if (usedTokens === 0 || pct < 1) return null;
  const barColor =
    pct > 92 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-primary/80";

  return (
    <span
      className="flex items-center gap-1.5"
      title={`≈ ${formatTokens(usedTokens)} of ${model.contextWindow} tokens used (mocked estimate)`}
    >
      <span aria-hidden>·</span>
      <span
        className="h-1 w-10 overflow-hidden rounded-full bg-secondary"
        aria-hidden
      >
        <span
          className={cn("block h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </span>
      <span className="tabular-nums">{pct}% used</span>
    </span>
  );
}

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const removeAttachment = useComposerStore((s) => s.removeAttachment);

  return (
    <div className="group/chip flex items-center gap-2 overflow-hidden rounded-xl border border-border/70 bg-secondary/50 py-1.5 pl-2 pr-1.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {attachment.dataUrl ? (
          <img
            src={attachment.dataUrl}
            alt=""
            className="size-7 rounded-lg object-cover"
          />
        ) : (
          <AttachmentKindIcon kind={attachment.kind} className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="max-w-40 truncate text-[12px] font-medium">
            {attachment.name}
          </span>
          <span className="shrink-0 text-[10.5px] text-muted-foreground">
            {formatBytes(attachment.size)}
          </span>
        </div>
        {attachment.visionAnalysis ? (
          <span className="flex items-center gap-1 text-[10.5px] text-primary">
            <Eye className="size-2.5" />
            via {attachment.visionAnalysis.viaModelName}
          </span>
        ) : attachment.extractedText ? (
          <span className="flex items-center gap-1 text-[10.5px] text-primary">
            <ScanText className="size-2.5" /> text extracted
          </span>
        ) : (
          <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
            {attachment.kind}
          </span>
        )}
      </div>
      <button
        aria-label={`Remove ${attachment.name}`}
        onClick={() => removeAttachment(attachment.id)}
        className="ml-0.5 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover/chip:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

/**
 * Composer chip showing the active style (or system prompt); click opens
 * the prompts picker for quick switching while chatting.
 */
function PromptQuickSwitch() {
  const prompts = usePromptsStore((s) => s.prompts);
  const hydrated = usePromptsStore((s) => s.hydrated);
  const hydrateFromServer = usePromptsStore((s) => s.hydrateFromServer);
  const activeInstructionsId = usePromptsStore((s) => s.activeInstructionsId);
  const activeSystemPromptId = usePromptsStore((s) => s.activeSystemPromptId);
  const setPromptsPickerOpen = useUIStore((s) => s.setPromptsPickerOpen);

  useEffect(() => {
    if (!hydrated) void hydrateFromServer();
  }, [hydrated, hydrateFromServer]);

  // Style takes display precedence; a custom system prompt is the fallback.
  const active =
    prompts.find((p) => p.id === activeInstructionsId) ??
    prompts.find((p) => p.id === activeSystemPromptId) ??
    null;

  return (
    <button
      onClick={() => setPromptsPickerOpen(true)}
      aria-label={
        active
          ? `Active style: ${active.name}. Change prompt or style`
          : "No style active. Choose a prompt or style"
      }
      title="Prompts & styles — switch while chatting"
      className="flex h-8 max-w-44 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <MessageSquareQuote
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "",
        )}
      />
      <span
        className={cn(
          "truncate",
          active && "text-primary/90",
        )}
      >
        {active ? active.name : "Prompt"}
      </span>
    </button>
  );
}

export function Composer() {
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModelId = useModelStore((s) => s.selectedModelId);
  const model = getModelOrThrow(selectedModelId);

  const mode = useComposerStore((s) => s.mode);
  const setMode = useComposerStore((s) => s.setMode);
  const value = useComposerStore((s) => s.draftText);
  const setValue = useComposerStore((s) => s.setDraftText);
  const draftAttachments = useComposerStore((s) => s.draftAttachments);
  const attachFiles = useComposerStore((s) => s.attachFiles);
  const setPendingPaste = useComposerStore((s) => s.setPendingPaste);

  const isGenerating = useChatStore((s) => s.isGenerating);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const setModelPickerOpen = useUIStore((s) => s.setModelPickerOpen);
  const setActiveView = useUIStore((s) => s.setActiveView);

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const canSend =
    !isGenerating && mode === "chat" && (value.trim().length > 0 || draftAttachments.length > 0);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const text = value;
    setValue("");
    void sendMessage(text);
  }, [canSend, value, setValue, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  /* Large paste detection — capability-driven */
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text/plain");
    if (!pasted || pasted.length <= LARGE_PASTE_THRESHOLD) return;

    if (!model.capabilities.files) {
      // Model can't take files — keep as plain text automatically.
      toast.info("Large paste kept as text", {
        description: `${model.displayName} doesn't support files, so the paste stays inline.`,
      });
      return;
    }

    e.preventDefault();
    setPendingPaste(pasted);
  };

  const processFiles = async (files: File[]) => {
    const supported = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const ok =
        f.type.startsWith("image/") || ACCEPTED_FILE_TYPES[ext] !== undefined;
      if (!ok) {
        toast.error(`Unsupported file: ${f.name}`, {
          description:
            "Try PDF, TXT, MD, CSV, JSON, DOCX, code files, or images.",
        });
      }
      return ok;
    });
    if (supported.length > 0) {
      await attachFiles(supported);
    }
  };

  /* Drag & drop (graceful no-op sources on mobile) */
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    await processFiles(files);
  };

  return (
    <div className="mx-auto w-full max-w-[40rem] px-3 pb-3 sm:px-4 sm:pb-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "composer-shell transition-[box-shadow] duration-300 ease-expo",
          dragging && "ring-2 ring-clay/40 ring-offset-2 ring-offset-background",
        )}
      >
        <div className="composer-core relative transition-colors duration-200">
        {/* Attachments */}
        {draftAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {draftAttachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
          </div>
        )}

        {/* Input */}
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder="How can I help you today?"
          className="max-h-[220px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[16px] leading-normal outline-none placeholder:text-muted-foreground/70"
        />

        {/* Controls — Claude's bottom row: plus left, model pill right, send last */}
        <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
          {/* Attach */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.doc,.ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.css,.html,.sql,.sh,.yml,.yaml,.xml,.log"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) void processFiles(files);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Attach files"
            title="Attach files (or drop them here)"
            onClick={() => fileInputRef.current?.click()}
            className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Plus className="size-4.5" />
          </Button>

          {/* Mode toggle */}
          <div
            role="tablist"
            aria-label="Composer mode"
            className="flex h-8 items-center gap-0.5 rounded-full bg-secondary/70 p-0.5"
          >
            {(["chat", "code"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setActiveView(m === "code" ? "code" : "chat");
                }}
                className={cn(
                  "h-7 rounded-full px-3 text-[12.5px] font-medium capitalize transition-all",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-0.5">
            {/* Prompt / style quick-switch trigger */}
            <PromptQuickSwitch />

            {/* Model picker trigger */}
            <button
              onClick={() => setModelPickerOpen(true)}
              aria-label={`Selected model: ${model.displayName}. Change model`}
              className="flex h-8 max-w-44 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ProviderLogo provider={model.provider} size={14} />
              <span className="truncate">{model.displayName}</span>
            </button>

            {/* Thinking + effort — hidden when unsupported */}
            <ThinkingControls />

            {/* Send / Stop — Claude's compact clay action button */}
            {isGenerating ? (
              <Button
                size="icon"
                aria-label="Stop generating"
                onClick={stopGeneration}
                className="size-8 rounded-lg bg-foreground text-background shadow-sm hover:bg-foreground/85"
              >
                <Square className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                aria-label="Send message"
                disabled={!canSend}
                onClick={handleSend}
                className="size-8 rounded-lg bg-clay text-white shadow-sm hover:bg-clay-emphasized disabled:bg-secondary disabled:text-muted-foreground"
              >
                <ArrowUp className="size-4.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Drag overlay hint */}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-[2px]">
            <span className="flex items-center gap-2 rounded-full border border-clay/40 bg-composer px-4 py-2 text-[13px] font-medium text-clay-dark">
              <Paperclip className="size-4" /> Drop files to attach
            </span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
