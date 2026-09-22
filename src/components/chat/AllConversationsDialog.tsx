"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EyeOff, MessageSquare, Search, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChatStore, searchConversations } from "@/store/chat-store";
import { useUIStore } from "@/store/ui-store";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function AllConversationsDialog() {
  const open = useUIStore((s) => s.allConversationsOpen);
  const setOpen = useUIStore((s) => s.setAllConversationsOpen);
  const conversations = useChatStore((s) => s.conversations);
  const openChat = useChatStore((s) => s.openChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const [query, setQuery] = useState("");

  const results = useMemo(
    () =>
      searchConversations(conversations, query).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    [conversations, query],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-5 pb-3 pt-4">
          <DialogTitle className="text-base">All conversations</DialogTitle>
          <DialogDescription className="sr-only">
            Search and browse every saved conversation. Incognito chats are
            excluded.
          </DialogDescription>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles and messages…"
              aria-label="Search conversations"
              className="h-10 w-full rounded-xl border border-border/70 bg-secondary/40 pl-9 pr-3 text-[13.5px] outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
            />
          </div>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[58vh] overflow-y-auto px-3 py-3">
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="size-5 text-muted-foreground/50" />
              <p className="text-[13.5px] font-medium">No conversations found</p>
              <p className="max-w-xs text-[12px] text-muted-foreground">
                {query.trim()
                  ? `Nothing matches “${query.trim()}”.`
                  : "Start chatting and history will appear here."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {results.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-secondary/50"
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground/60" />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      openChat(c.id);
                      setActiveView("chat");
                      setOpen(false);
                    }}
                  >
                    <span className="block truncate text-[13.5px] font-medium">
                      {c.title}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">
                      {timeAgo(c.updatedAt)} · {c.messages.length} message
                      {c.messages.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  <button
                    aria-label={`Delete ${c.title}`}
                    onClick={() => {
                      deleteChat(c.id);
                      toast.success("Chat deleted");
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="flex items-center gap-1.5 border-t border-border/60 px-5 py-2.5 text-[11px] text-muted-foreground">
          <EyeOff className="size-3" />
          Incognito chats stay out of search and history — they vanish on
          reload.
        </p>
      </DialogContent>
    </Dialog>
  );
}
