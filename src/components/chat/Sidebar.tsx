"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  ChevronDown,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  Settings2,
  Sun,
  Trash2,
  EyeOff,
  FolderKanban,
  Brain,
  SquareCode,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChatStore, groupConversationsByDate, searchConversations } from "@/store/chat-store";
import { useUIStore, type AppView } from "@/store/ui-store";
import { useComposerStore } from "@/store/composer-store";
import { useTheme } from "next-themes";
import { AccountMenu, type AccountInfo } from "./AccountMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Conversation } from "@/lib/models/types";

const NAV_ITEMS: Array<{
  view: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { view: "artifacts", label: "Artifacts", icon: Boxes },
  { view: "code", label: "Code", icon: SquareCode },
  { view: "projects", label: "Projects", icon: FolderKanban },
  { view: "memory", label: "Memory", icon: Brain },
  { view: "settings", label: "Settings", icon: Settings2 },
];

function HistoryRow({
  conversation,
  active,
  onOpen,
}: {
  conversation: Conversation;
  active: boolean;
  onOpen: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const renameChat = useChatStore((s) => s.renameChat);
  const deleteChat = useChatStore((s) => s.deleteChat);

  if (renaming) {
    return (
      <div className="px-1.5 py-0.5">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            renameChat(conversation.id, draft);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              renameChat(conversation.id, draft);
              setRenaming(false);
            }
            if (e.key === "Escape") setRenaming(false);
          }}
          className="h-7 border-primary/40 bg-background text-[13px]"
        />
      </div>
    );
  }

  return (
    <div        className={cn(
          "group/row relative flex items-center rounded-md pr-1 transition-colors",
          active ? "bg-sidebar-accent text-foreground" : "hover:bg-sidebar-accent",
        )}
      >
        <button
          onClick={onOpen}
          className="press flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
          title={conversation.title}
        >
          {conversation.incognito && (
            <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-[13px] leading-snug">
            {conversation.title}
          </span>
        </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Actions for ${conversation.title}`}
            className={cn(
              "rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100",
              active && "opacity-60",
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="w-40">
          <DropdownMenuItem
            onClick={() => {
              setDraft(conversation.title);
              setRenaming(true);
            }}
          >
            <Pencil className="size-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              deleteChat(conversation.id);
              toast.success("Chat deleted");
            }}
          >
            <Trash2 className="size-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      aria-label="Toggle color theme"
      title="Toggle light / dark"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
    >
      {/* CSS-driven icons — no hydration mismatch, no mounted state */}
      <Sun className="hidden size-4 dark:block" />
      <Moon className="block size-4 dark:hidden" />
    </button>
  );
}

/** Desktop icon rail shown when the sidebar is collapsed (⌘B). */
function SidebarRail({ account }: { account: AccountInfo }) {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const setAllConversationsOpen = useUIStore((s) => s.setAllConversationsOpen);
  const newChat = useChatStore((s) => s.newChat);
  const goToChat = useUIStore((s) => s.goToChat);
  const setMode = useComposerStore((s) => s.setMode);

  const railButton = (active: boolean) =>
    cn(
      "press flex size-10 items-center justify-center rounded-xl transition-colors",
      active
        ? "bg-sidebar-accent text-primary"
        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
    );

  return (
    <div className="flex h-full w-full flex-col items-center gap-1.5 bg-sidebar px-2 pb-4 pt-4 text-sidebar-foreground">
      {/* Brand — rail keeps a single spark mark */}
      <span
        className="mb-2.5 flex size-8 items-center justify-center text-primary"
        title="Ember"
      >
        <Sparkles className="size-5" />
      </span>

      {/* New chat — clay filled, Claude's primary action */}
      <button
        onClick={() => {
          newChat({ incognito: false });
          goToChat();
        }}
        aria-label="New chat"
        title="New chat (⌘⇧O)"
        className="flex size-10 items-center justify-center rounded-xl bg-clay text-white transition-colors hover:bg-clay-emphasized"
      >
        <Plus className="size-4.5" />
      </button>

      {/* Search all conversations */}
      <button
        onClick={() => setAllConversationsOpen(true)}
        aria-label="Search all conversations"
        title="Search all conversations"
        className={railButton(false)}
      >
        <Search className="size-4.5" />
      </button>

      <div className="my-1.5 h-px w-6 bg-sidebar-border" aria-hidden />

      {/* Nav items */}
      <nav aria-label="Primary" className="flex flex-col items-center gap-1.5">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => {
              if (view === "code") {
                if (activeView === "code") {
                  setMode("chat");
                  setActiveView("chat");
                } else {
                  setMode("code");
                  setActiveView("code");
                }
              } else {
                setActiveView(view);
              }
            }}
            aria-label={label}
            aria-current={activeView === view ? "page" : undefined}
            title={label}
            className={railButton(activeView === view)}
          >
            <Icon className="size-4.5" />
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Bottom cluster */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar (⌘B)"
          className={railButton(false)}
        >
          <PanelLeftOpen className="size-4.5" />
        </button>

        <ThemeToggle />

        <AccountMenu account={account} compact />
      </div>
    </div>
  );
}

export function SidebarContent({ account }: { account: AccountInfo }) {
  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const newChat = useChatStore((s) => s.newChat);
  const openChat = useChatStore((s) => s.openChat);
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const goToChat = useUIStore((s) => s.goToChat);
  const setMode = useComposerStore((s) => s.setMode);
  const setAllConversationsOpen = useUIStore((s) => s.setAllConversationsOpen);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const filtered = search.trim()
      ? searchConversations(conversations, search)
      : conversations;
    return groupConversationsByDate(filtered);
  }, [conversations, search]);

  const artifactCount = 0; // wired visually via ArtifactsView itself

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand — Claude's serif wordmark, 20px, wght 500 */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="claude-wordmark text-foreground">Ember</span>
        <button
          onClick={() => setSidebarCollapsed(true)}
          aria-label="Collapse sidebar"
          title="Collapse sidebar (⌘B)"
          className="ml-auto rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* New chat — Claude's row style: plus circle + "New", NOT a filled pill */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        <button
          onClick={() => {
            newChat({ incognito: false });
            goToChat();
          }}
          className="group/new flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-[14px] text-secondary-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          aria-keyshortcuts="Control+Shift+O"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/15 transition-colors group-hover/new:bg-muted-foreground/25">
            <Plus className="size-3.5" />
          </span>
          New
        </button>
        <button
          aria-label="New incognito chat"
          title="New incognito chat — won't touch Memory or history"
          onClick={() => {
            newChat({ incognito: true });
            goToChat();
            toast("Incognito chat started", {
              description:
                "No Memory will be created or read. This chat disappears on reload.",
            });
          }}
          className="size-8 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <EyeOff className="mx-auto size-4" />
        </button>
      </div>

      {/* Primary nav */}
      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-3 pb-2 pt-1">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => {
              if (view === "code") {
                // Toggle behavior: Code is both a nav item and a composer mode.
                if (activeView === "code") {
                  setMode("chat");
                  setActiveView("chat");
                } else {
                  setMode("code");
                  setActiveView("code");
                }
              } else {
                setActiveView(view);
              }
            }}
            aria-current={activeView === view ? "page" : undefined}
            className={cn(
              "press flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] transition-colors",
              activeView === view
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-secondary-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
            {view === "artifacts" && artifactCount > 0 && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                {artifactCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Search */}
      <div className="px-3 pb-1 pt-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-8 rounded-lg border-transparent bg-sidebar-accent/50 pl-8 text-[13px] placeholder:text-muted-foreground/70 focus-visible:border-primary/40 focus-visible:bg-background/40"
          />
        </div>
      </div>

      {/* History — "Chats and tasks" label like Claude */}
      <div className="mt-1.5 flex min-h-0 flex-1 flex-col px-3">
        <div className="px-1.5 pb-1 text-[13px] text-muted-foreground">
          Chats and tasks
        </div>
        <div className="scrollbar-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-sidebar-border px-3 py-6 text-center">
              <Search className="size-4 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">
                {search.trim()
                  ? `No chats matching “${search.trim()}”`
                  : "No chats yet — start a new one"}
              </p>
            </div>
          ) : (
        <div className="flex flex-col gap-3 pb-2">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-1.5 pb-1 pt-0.5 text-[12px] text-muted-foreground/90">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((c) => (
                      <HistoryRow
                        key={c.id}
                        conversation={c}
                        active={c.id === currentConversationId && activeView === "chat"}
                        onOpen={() => {
                          openChat(c.id);
                          goToChat();
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setAllConversationsOpen(true)}
          className="mt-1 flex items-center justify-between rounded-lg px-1.5 py-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          View all conversations
          <ChevronDown className="size-3.5 -rotate-90" />
        </button>
      </div>

      {/* Account — flat row opening a menu (settings, admin, sign out) */}
      <div className="mt-1 flex items-center gap-1 px-2 pb-3 pt-2">
        <AccountMenu account={account} />
        <ThemeToggle />
      </div>
    </div>
  );
}

/** Desktop sidebar shell — full panel or collapsed icon rail (⌘B). */
export function Sidebar({ account }: { account: AccountInfo }) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  return (
    <aside
      className={cn(
        "hidden shrink-0 lg:block",
        collapsed ? "w-[60px]" : "w-[288px]",
      )}
    >
      {collapsed ? (
        <SidebarRail account={account} />
      ) : (
        <SidebarContent account={account} />
      )}
    </aside>
  );
}
