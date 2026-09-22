"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  Code2,
  Compass,
  Copy,
  Eye,
  Globe,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Play,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatMessage, ToolActivity } from "@/lib/models/types";
import { getModel } from "@/lib/models/catalog";
import { useChatStore } from "@/store/chat-store";
import { useDebugStore } from "@/store/debug-store";
import { MarkdownContent } from "./MarkdownContent";
import { ProviderLogo } from "./ProviderLogo";
import { HighlightText } from "./highlight";
import { formatBytes } from "./Composer";
import { ImageIcon, FileText, FileCode2, FileJson, FileUp } from "lucide-react";

function kindIcon(kind: string) {
  switch (kind) {
    case "image":
      return ImageIcon;
    case "pdf":
      return FileUp;
    case "code":
      return FileCode2;
    case "data":
      return FileJson;
    default:
      return FileText;
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Hides internal tool-protocol blocks (<tool_call>…</tool_call>) that may be
 * baked into messages stored before the server began filtering them.
 */
function stripToolCallBlocks(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>\s*/g, "")
    .replace(/<tool_call>[\s\S]*$/g, "");
}

function MessageTimestamp({ ts }: { ts: number }) {
  return (
    <span
      className="select-none text-[10.5px] tabular-nums text-muted-foreground/0 transition-colors duration-200 group-hover:text-muted-foreground/80"
      title={new Date(ts).toLocaleString()}
    >
      {formatTimestamp(ts)}
    </span>
  );
}

function MessageAttachments({
  message,
  highlight,
}: {
  message: ChatMessage;
  highlight?: string;
}) {
  if (!message.attachments?.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {message.attachments.map((a) => {
        const Icon = kindIcon(a.kind);
        return (
          <span
            key={a.id}
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 py-1.5 pl-1.5 pr-3"
          >
            {a.dataUrl ? (
              <img
                src={a.dataUrl}
                alt={a.name}
                className="size-8 rounded-lg object-cover"
              />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Icon className="size-4" />
              </span>
            )}
            <span className="leading-tight">
              <span className="block max-w-44 truncate text-[12px] font-medium">
                <HighlightText text={a.name} query={highlight} />
              </span>
              <span className="text-[10.5px] text-muted-foreground">
                {formatBytes(a.size)}
                {a.visionAnalysis
                  ? ` · analyzed via ${a.visionAnalysis.viaModelName}`
                  : a.extractedText
                    ? " · text extracted"
                    : ""}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function UserMessage({
  message,
  highlight,
}: {
  message: ChatMessage;
  highlight?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editUserMessage = useChatStore((s) => s.editUserMessage);
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%] rounded-2xl border border-clay/40 bg-surface-3 p-3">
          <MessageAttachments message={message} highlight={highlight} />
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(10, Math.ceil(draft.length / 60) + 1)}
            className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[12px]"
              onClick={() => {
                setDraft(message.content);
                setEditing(false);
              }}
            >
              <X className="size-3" /> Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 rounded-lg bg-clay px-4 text-[12px] text-white hover:bg-clay-emphasized"
              onClick={() => {
                setEditing(false);
                if (draft.trim() && draft !== message.content) {
                  editUserMessage(message.id, draft);
                }
              }}
            >
              <Check className="size-3" /> Save & regenerate
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="group flex justify-end"
    >
      <div className="max-w-[85%]">
        {/* Claude user bubble: bg-neutral ink over canvas, rounded-card 12px */}
        <div
          className="rounded-xl px-4 py-2.5"
          style={{ background: "var(--user-bubble)" }}
        >
          <MessageAttachments message={message} highlight={highlight} />
          {message.content && (
            <MarkdownContent
              content={message.content}
              highlight={highlight}
              variant="user"
            />
          )}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <MessageTimestamp ts={message.createdAt} />
          <button
            aria-label="Copy message"
            onClick={copy}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <button
            aria-label="Edit message"
            onClick={() => setEditing(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ToolActivitiesView({ activities }: { activities?: ToolActivity[] }) {
  if (!activities || activities.length === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {activities.map((act) => {
        const isSearch = act.tool === "web_search";
        const Icon = isSearch ? Globe : Compass;
        return (
          <div
            key={act.id}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/30 px-3 py-1.5 text-[12px] font-medium text-muted-foreground"
          >
            <Icon className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              {isSearch ? (
                <>
                  <span className="font-semibold text-foreground">Web Search:</span>{" "}
                  <span className="italic">"{act.input}"</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">Web Fetch:</span>{" "}
                  <span className="italic">{act.input}</span>
                </>
              )}
            </span>
            {act.status === "running" ? (
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-primary">
                <Loader2 className="size-3 animate-spin" />
                <span>{isSearch ? "Searching…" : "Fetching…"}</span>
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-500">
                <Check className="size-3" />
                <span>{act.resultSummary || "Completed"}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}


function ThinkingTrace({
  message,
  live,
  highlight,
}: {
  message: ChatMessage;
  live: boolean;
  highlight?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!message.thinking) return null;

  const searchHit =
    highlight && highlight.trim().length > 0
      ? message.thinking.toLowerCase().includes(highlight.trim().toLowerCase())
      : false;
  const expanded = open || live || searchHit;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={expanded}
        className="flex items-center gap-1.5 rounded-lg py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {live ? (
          <>
            <span className="flex items-center gap-1">
              <span className="thinking-dot inline-block size-1.5 rounded-full bg-primary" />
              <span className="thinking-dot inline-block size-1.5 rounded-full bg-primary" />
              <span className="thinking-dot inline-block size-1.5 rounded-full bg-primary" />
            </span>
            <span className="shimmer-text">Thinking…</span>
          </>
        ) : (
          <>
            <Brain className="size-3.5" />
            Thought for a moment
          </>
        )}
        <ChevronDown
          className={cn("size-3 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="prose-thinking-wrapper mt-1.5 rounded-xl border border-border/50 bg-secondary/30 px-3.5 py-2.5">
          <MarkdownContent
            content={message.thinking}
            highlight={highlight}
            variant="thinking"
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="press flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function AssistantMessage({
  message,
  isLastAssistant,
  highlight,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  highlight?: string;
}) {
  const [copied, setCopied] = useState(false);
  const regenerateMessage = useChatStore((s) => s.regenerateMessage);
  const retryMessage = useChatStore((s) => s.retryMessage);
  const continueMessage = useChatStore((s) => s.continueMessage);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const generatingMessageId = useChatStore((s) => s.generatingMessageId);

  const openDebugModal = useDebugStore((s) => s.openDebugModal);

  const model = message.modelId ? getModel(message.modelId) : undefined;
  const live = generatingMessageId === message.id;
  const streaming = message.status === "streaming" || message.status === "thinking";

  const copy = async () => {
    await navigator.clipboard.writeText(stripToolCallBlocks(message.content));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="group"
    >
      {/* Model badge row — Claude shows no avatar/name on assistant turns */}
      {message.routedThrough && message.routedThrough.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          {model ? <ProviderLogo provider={model.provider} size={16} /> : null}
          <span className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10.5px] text-muted-foreground">
            <Eye className="size-2.5" /> via {message.routedThrough.join(", ")}
          </span>
        </div>
      )}

      {message.status === "error" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-medium text-destructive">
            <AlertTriangle className="size-4" />
            Generation failed
          </span>
          <p className="text-[12.5px] leading-snug text-muted-foreground">
            {message.error}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full border-destructive/40 text-[12px] text-destructive hover:bg-destructive/10"
              onClick={() => retryMessage(message.id)}
            >
              <RefreshCw className="size-3" /> Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ToolActivitiesView activities={message.toolActivities} />

          <ThinkingTrace
            message={message}
            live={message.status === "thinking"}
            highlight={highlight}
          />

          {message.status === "pending" && !message.thinking && (!message.toolActivities || message.toolActivities.length === 0) && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="thinking-dot size-1.5 rounded-full bg-primary" />
              <span className="thinking-dot size-1.5 rounded-full bg-primary" />
              <span className="thinking-dot size-1.5 rounded-full bg-primary" />
            </div>
          )}

          {(message.content || message.status === "streaming") && (
            <div className="min-w-0">
              <MarkdownContent
                content={stripToolCallBlocks(message.content)}
                highlight={highlight}
              />
              {message.status === "streaming" && <span className="stream-caret" />}
            </div>
          )}

          {message.status === "stopped" && message.content === "" && (
            <p className="text-[12.5px] italic text-muted-foreground">
              Generation stopped before any output.
            </p>
          )}
          {message.status === "stopped" && message.content !== "" && (
            <p className="mt-1 text-[11.5px] italic text-muted-foreground">
              Stopped by you.
            </p>
          )}

          {/* Memory indicator */}
          {message.status === "done" &&
            (message.memoryEntriesUsed ?? 0) > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Brain className="size-3" />
                Memory · {message.memoryEntriesUsed}{" "}
                {message.memoryEntriesUsed === 1 ? "entry" : "entries"} used
              </p>
            )}

          {/* Actions — Claude's quiet icon row, hairline separators */}
          {["done", "stopped"].includes(message.status) && !isGenerating && (
            <div className="mt-1 flex flex-wrap items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <MessageTimestamp ts={message.createdAt} />
              <ActionButton
                icon={copied ? Check : Copy}
                label={copied ? "Copied" : "Copy"}
                onClick={copy}
              />
              <ActionButton
                icon={RefreshCw}
                label="Regenerate"
                onClick={() => regenerateMessage(message.id)}
              />
              {message.status === "done" && message.content && isLastAssistant && (
                <ActionButton
                  icon={Play}
                  label="Continue"
                  onClick={() => continueMessage(message.id)}
                />
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="press flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => openDebugModal(message.id, "request")}>
                    <Code2 className="size-3.5" /> Check Raw Request
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openDebugModal(message.id, "response")}>
                    <Code2 className="size-3.5" /> Check Raw Response
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {live && streaming && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              Generating…{" "}
              <button
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => useChatStore.getState().stopGeneration()}
              >
                Stop
              </button>
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

export function MessageItem({
  message,
  isLastAssistant,
  highlight,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  highlight?: string;
}) {
  if (message.role === "user")
    return <UserMessage message={message} highlight={highlight} />;
  return (
    <AssistantMessage
      message={message}
      isLastAssistant={isLastAssistant}
      highlight={highlight}
    />
  );
}
