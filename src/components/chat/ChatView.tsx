"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  Boxes,
  Brain,
  BrainCog,
  ChevronDown,
  ChevronUp,
  Download,
  EyeOff,
  Keyboard as KeyboardIcon,
  Menu,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadConversationMarkdown } from "@/lib/export";
import { useChatStore } from "@/store/chat-store";
import { useUIStore } from "@/store/ui-store";
import { useArtifactsStore } from "@/store/artifacts-store";
import { useMemoryStore } from "@/store/memory-store";
import { useComposerStore } from "@/store/composer-store";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";
import { MobileNavButton } from "./MobileNavButton";
import { computeSearchMatches } from "./highlight";
import { displayNameFor, type AccountInfo } from "./AccountMenu";

/* ------------------------------------------------------------------ */

const subscribeNoop = () => () => {};

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Time-of-day greeting, resolved on the client only so SSR and hydration agree. */
function useGreeting(): string {
  return useSyncExternalStore(
    subscribeNoop,
    () => greetingForNow(),
    () => "",
  );
}

const SUGGESTIONS = [
  "Summarize a document for me",
  "Write a TypeScript utility function",
  "Explain how the model picker works",
  "Draft a report with an artifact",
];

function WelcomeState({ account }: { account: AccountInfo }) {
  const requestTextInsert = useComposerStore((s) => s.requestTextInsert);
  const newChat = useChatStore((s) => s.newChat);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const greeting = useGreeting();
  const name = displayNameFor(account.email);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Claude-style empty state: serif greeting with spark, composer centered */}
      {/* Mobile-only header so the drawer stays reachable */}
      <div className="relative z-10 flex h-[52px] shrink-0 items-center px-3 lg:hidden">
        <MobileNavButton />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-8">
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex items-center justify-center gap-1.5"
      >
        <Sparkles className="size-[0.72em] text-clay sm:size-6" aria-hidden />
        <h1 className="claude-greeting text-center text-balance">
          {greeting ? `${greeting}, ${name}` : name}
        </h1>
      </motion.div>
      <div className="w-full">
        <Composer />
      </div>
      <div className="mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.06, ease: [0.23, 1, 0.32, 1] }}
            onClick={() => {
              newChat({ incognito: false });
              requestTextInsert(s);
            }}
            className="press rounded-full border border-border bg-transparent px-3.5 py-1.5 text-[12.5px] text-muted-foreground transition-[background-color,border-color,color,transform] duration-200 ease-expo hover:-translate-y-0.5 hover:bg-surface-3 hover:text-foreground"
          >
            {s}
          </motion.button>
        ))}
      </div>

      {/* Shortcut hint */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="press mt-6 hidden items-center gap-2 text-[11.5px] text-muted-foreground/70 transition-colors hover:text-muted-foreground sm:flex"
      >
        <kbd className="rounded-md border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px]">⌘K</kbd>
        models
        <span aria-hidden>·</span>
        <kbd className="rounded-md border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px]">?</kbd>
        shortcuts
      </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface TopBarSearchProps {
  searchOpen: boolean;
  onOpenSearch: () => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  matchCursor: number;
  matchTotal: number;
  onNavigateMatch: (delta: number) => void;
  onCloseSearch: () => void;
}

function TopBar({ searchProps }: { searchProps: TopBarSearchProps }) {
  const conversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.currentConversationId),
  );
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const artifacts = useArtifactsStore((s) => s.artifacts);
  const memoryPaused = useMemoryStore((s) => s.prefs.paused);
  const memoryCount = useMemoryStore((s) => s.memories.length);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const renameChat = useChatStore((s) => s.renameChat);

  const convArtifacts = useMemo(
    () =>
      conversation
        ? artifacts.filter((a) => a.conversationId === conversation.id)
        : [],
    [artifacts, conversation],
  );

  if (!conversation) return null;

  /* ---------- Search mode header ---------- */
  if (searchProps.searchOpen) {
    const counter =
      searchProps.searchQuery.trim().length === 0
        ? ""
        : searchProps.matchTotal > 0
          ? `${searchProps.matchCursor + 1} / ${searchProps.matchTotal}`
          : "No matches";
    return (
      <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-1.5 bg-background/90 px-3 backdrop-blur-md sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open sidebar"
          className="size-9 rounded-lg lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="size-4.5" />
        </Button>
        <div className="relative flex h-9 min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            autoFocus
            value={searchProps.searchQuery}
            onChange={(e) => searchProps.onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                searchProps.onNavigateMatch(e.shiftKey ? -1 : 1);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                searchProps.onCloseSearch();
              }
            }}
            placeholder="Find in conversation…"
            aria-label="Search messages in this conversation"
            className="h-9 w-full rounded-lg border border-border-strong bg-surface-2 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-clay/50"
          />
        </div>
        <span
          className="shrink-0 whitespace-nowrap px-1 text-[11.5px] tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {counter}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous match (Shift+Enter)"
            disabled={searchProps.matchTotal === 0}
            onClick={() => searchProps.onNavigateMatch(-1)}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next match (Enter)"
            disabled={searchProps.matchTotal === 0}
            onClick={() => searchProps.onNavigateMatch(1)}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close search (Esc)"
            onClick={searchProps.onCloseSearch}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>
    );
  }

  /* ---------- Rename mode header ---------- */
  if (renaming) {
    return (
      <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-2 bg-background/90 px-3 backdrop-blur-md sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open sidebar"
          className="size-9 rounded-lg lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="size-4.5" />
        </Button>
        <input
          autoFocus
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameDraft.trim()) {
              renameChat(conversation.id, renameDraft);
              setRenaming(false);
            }
            if (e.key === "Escape") setRenaming(false);
          }}
          className="h-8 min-w-0 flex-1 rounded-lg border border-clay/50 bg-surface-2 px-3 text-[14px] outline-none"
          aria-label="Rename conversation"
        />
        <Button
          size="sm"
          className="h-8 rounded-lg bg-clay px-4 text-[12px] text-white hover:bg-clay-emphasized"
          onClick={() => {
            if (renameDraft.trim()) renameChat(conversation.id, renameDraft);
            setRenaming(false);
          }}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-[12px]"
          onClick={() => setRenaming(false)}
        >
          Cancel
        </Button>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-2 bg-background/90 px-3 backdrop-blur-md sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open sidebar"
        className="size-9 rounded-lg lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="size-4.5" />
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <h2
          className="cursor-text truncate rounded-md px-1 -mx-1 text-[14px] font-medium transition-colors hover:bg-secondary/70"
          title="Click to rename"
          onClick={() => {
            setRenameDraft(conversation.title);
            setRenaming(true);
          }}
        >
          {conversation.title}
        </h2>
        {conversation.incognito && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-500">
            <EyeOff className="size-2.5" /> Incognito
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Find in conversation"
          title="Find in conversation (⌘F)"
          onClick={searchProps.onOpenSearch}
          className="size-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Search className="size-4" />
        </Button>
        <button
          onClick={() => setActiveView("memory")}
          className={cn(
            "press flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium transition-colors",
            memoryPaused
              ? "text-muted-foreground hover:bg-secondary"
              : "bg-primary/10 text-primary hover:bg-primary/15",
          )}
          title={
            memoryPaused
              ? "Memory is paused — nothing new is saved"
              : `${memoryCount} memories active`
          }
        >
          {memoryPaused ? (
            <BrainCog className="size-3.5" />
          ) : (
            <Brain className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {memoryPaused ? "Memory paused" : `Memory · ${memoryCount}`}
          </span>
        </button>
        <button
          onClick={() => setActiveView("artifacts")}
          className="press relative flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Open Artifacts"
        >
          <Boxes className="size-3.5" />
          <span className="hidden sm:inline">Artifacts</span>
          {convArtifacts.length > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9.5px] font-bold text-primary-foreground">
              {convArtifacts.length}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Conversation menu"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                setRenameDraft(conversation.title);
                setRenaming(true);
              }}
            >
              <Pencil className="size-3.5" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                downloadConversationMarkdown(conversation);
                toast.success("Conversation exported", {
                  description: "Saved as a markdown file with thinking traces included.",
                });
              }}
            >
              <Download className="size-3.5" /> Export as markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
              <KeyboardIcon className="size-3.5" /> Keyboard shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function MessageList({
  searchQuery,
  activeMatchMessageId,
  matchKey,
}: {
  searchQuery: string;
  activeMatchMessageId: string | null;
  /** Changes on every match navigation so the flash re-triggers */
  matchKey: string;
}) {
  const conversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.currentConversationId),
  );
  const isGenerating = useChatStore((s) => s.isGenerating);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const messages = conversation?.messages ?? [];
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  /* Auto-scroll while pinned to bottom */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isGenerating]);

  /* Jump to + flash the active search match */
  useEffect(() => {
    if (!activeMatchMessageId) return;
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLDivElement>(
      `[data-message-id="${CSS.escape(activeMatchMessageId)}"]`,
    );
    if (!target) return;
    // Don't let the streaming auto-scroll fight the jump.
    pinnedRef.current = false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("match-flash");
    // Restart the animation even when jumping within the same message.
    void target.offsetWidth;
    target.classList.add("match-flash");
    const t = setTimeout(() => target.classList.remove("match-flash"), 1500);
    return () => clearTimeout(t);
  }, [matchKey, activeMatchMessageId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    pinnedRef.current = pinned;
    // Only show the jump button when there's content below the fold.
    setShowJump(!pinned && el.scrollHeight > el.clientHeight + 200);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  if (!conversation) return null;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-thin h-full overflow-y-auto"
      >
        {/* Claude transcript: max-w-3xl (48rem), tight 1.5rem message rhythm */}
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 pt-4 md:px-4">
          {messages.map((m) => (
            <div key={m.id} data-message-id={m.id}>
              <MessageItem
                message={m}
                isLastAssistant={m.id === lastAssistantId}
                highlight={searchQuery || undefined}
              />
            </div>
          ))}
          <div className="h-1 shrink-0" />
        </div>
      </div>

      {/* Scroll-to-bottom */}
      <button
        aria-label="Scroll to latest message"
        onClick={jumpToBottom}
        className={cn(
          "absolute bottom-3 left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border/70 bg-composer text-foreground shadow-lg backdrop-blur transition-all duration-200",
          showJump
            ? "pointer-events-auto translate-y-0 opacity-100 hover:bg-secondary"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <ArrowDown className="size-4" />
        {isGenerating && (
          <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ChatView({ account }: { account: AccountInfo }) {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.currentConversationId),
  );
  const chatSearchOpen = useUIStore((s) => s.chatSearchOpen);
  const setChatSearchOpen = useUIStore((s) => s.setChatSearchOpen);

  /*
   * In-chat search state. `convId` stamps which conversation the query
   * belongs to — switching conversations simply makes the query inert
   * (derived), no reset effects needed.
   */
  const [search, setSearch] = useState({
    convId: "",
    query: "",
    cursor: 0,
  });
  const convId = currentConversationId ?? "";
  const searchActive = chatSearchOpen && Boolean(convId);
  const searchQuery = search.convId === convId ? search.query : "";
  const searchCursor = search.convId === convId ? search.cursor : 0;

  const messages = conversation?.messages ?? [];
  const activeQuery =
    searchActive && searchQuery.trim() ? searchQuery.trim() : "";
  const matchData = useMemo(
    () => computeSearchMatches(messages, activeQuery),
    [messages, activeQuery],
  );
  const clampedCursor =
    matchData.total > 0 ? Math.min(searchCursor, matchData.total - 1) : 0;
  const activeMatchMessageId =
    matchData.total > 0 ? matchData.messageIds[clampedCursor] : null;

  const navigateMatch = (delta: number) => {
    if (matchData.total === 0) return;
    setSearch((s) => {
      const cur = s.convId === convId ? s.cursor : 0;
      const raw = (cur + delta) % matchData.total;
      return {
        ...s,
        cursor: raw < 0 ? raw + matchData.total : raw,
      };
    });
  };

  const closeSearch = () => {
    setChatSearchOpen(false);
    setSearch({ convId: "", query: "", cursor: 0 });
  };

  if (!currentConversationId) {
    return <WelcomeState account={account} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        searchProps={{
          searchOpen: searchActive,
          onOpenSearch: () => setChatSearchOpen(true),
          searchQuery,
          onSearchQueryChange: (q) =>
            setSearch({ convId, query: q, cursor: 0 }),
          matchCursor: clampedCursor,
          matchTotal: matchData.total,
          onNavigateMatch: navigateMatch,
          onCloseSearch: closeSearch,
        }}
      />
      <MessageList
        searchQuery={activeQuery}
        activeMatchMessageId={activeMatchMessageId}
        matchKey={`${activeMatchMessageId ?? ""}:${clampedCursor}`}
      />
      <Composer />
    </div>
  );
}
