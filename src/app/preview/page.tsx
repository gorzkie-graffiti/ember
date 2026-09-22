import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Brain,
  ChevronDown,
  Code2,
  FileText,
  Globe,
  ImageIcon,
  Lock,
  MessageSquare,
  Paperclip,
  PlayCircle,
  Settings2,
  Sparkles,
  SquarePen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Preview — Ember",
  description:
    "A read-only look at the Ember workspace: streaming chat, thinking, web tools, artifacts and memory.",
};

const SIDEBAR_NAV = [
  { icon: MessageSquare, label: "Chats", active: true },
  { icon: Box, label: "Projects" },
  { icon: Code2, label: "Code mode" },
  { icon: FileText, label: "Artifacts" },
  { icon: Brain, label: "Memory" },
  { icon: Settings2, label: "Settings" },
];

const CONVERSATIONS = [
  "Debugging a Prisma migration",
  "Trip plan: Lisbon in October",
  "Rewrite my resume bullet points",
  "Explain WebSockets vs SSE",
  "Regex for log parsing",
];

export default function PreviewPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Preview banner */}
      <div className="z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border/70 bg-secondary/60 px-4 py-2 text-[12.5px] backdrop-blur">
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <PlayCircle className="size-3.5 text-primary" />
          Preview mode — a static, read-only look. Nothing here is editable.
        </span>
        <Link
          href="/register"
          className="flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Request access <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="hidden w-[268px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 md:flex">
          <div className="flex items-center justify-between px-1.5 py-1">
            <span className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="size-5" />
              <span className="font-display text-[17px] tracking-tight">
                Ember
              </span>
            </span>
            <SquarePen className="size-4 text-muted-foreground" />
          </div>

          <div className="mt-3 space-y-0.5">
            {SIDEBAR_NAV.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </div>
            ))}
          </div>

          <p className="mt-5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Recent
          </p>
          <div className="mt-1.5 space-y-0.5">
            {CONVERSATIONS.map((title, i) => (
              <div
                key={title}
                className={`truncate rounded-lg px-2.5 py-1.5 text-[12.5px] ${
                  i === 0 ? "text-sidebar-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {title}
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-2 rounded-xl border border-sidebar-border bg-card/60 px-2.5 py-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-[var(--clay-soft)] text-[11.5px] font-semibold text-primary">
              Y
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium">you@example.com</p>
              <p className="text-[11px] text-muted-foreground">Approved account</p>
            </div>
            <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </div>
        </aside>

        {/* Main area */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
            <span className="truncate text-[14px] font-medium">
              Debugging a Prisma migration
            </span>
            <span className="ml-auto flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-[12px] text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              Groq · GPT-OSS 120B
              <ChevronDown className="size-3" />
            </span>
          </header>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
              {/* User turn */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-xl bg-[var(--user-bubble)] px-4 py-2.5 text-[14px] leading-relaxed">
                  My Prisma enum migration fails on SQLite. What am I doing wrong?
                </div>
              </div>

              {/* Thinking */}
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Brain className="size-3.5 text-primary" />
                <span className="italic">
                  Thought for 3s — SQLite has no native enum…
                </span>
              </div>

              {/* Tool call */}
              <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2 text-[12.5px]">
                <Globe className="size-3.5 text-primary" />
                <span className="text-muted-foreground">
                  Searched the web for{" "}
                  <span className="text-foreground">
                    “prisma sqlite enum migration”
                  </span>
                </span>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  5 results
                </span>
              </div>

              {/* Assistant turn */}
              <div className="text-[14px] leading-relaxed">
                <p>
                  SQLite doesn&apos;t have an enum type. Prisma emulates it with a{" "}
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[12.5px]">
                    TEXT
                  </code>{" "}
                  column plus a{" "}
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[12.5px]">
                    CHECK
                  </code>{" "}
                  constraint, so a migration that emits a bare{" "}
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[12.5px]">
                    CREATE TYPE
                  </code>{" "}
                  will blow up.
                </p>
                <p className="mt-3 text-muted-foreground">
                  Source:{" "}
                  <span className="text-primary underline decoration-primary/40">
                    Prisma docs — SQLite feature matrix
                  </span>
                </p>

                {/* Artifact card */}
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--clay-soft)] text-primary">
                    <Code2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">
                      enum-migration.ts
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      Artifact · TypeScript · 24 lines
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full border border-border/70 px-2.5 py-1 text-[11.5px] text-muted-foreground">
                    Preview
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-border/60 px-4 pb-5 pt-3 sm:px-6">
            <div className="mx-auto max-w-3xl rounded-xl border border-border/60 bg-composer px-3.5 py-3">
              <div className="text-[13.5px] text-muted-foreground/80">
                Ask Ember anything…
              </div>
              <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                <Paperclip className="size-4" />
                <ImageIcon className="size-4" />
                <Globe className="size-4" />
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[12px]">
                  <Sparkles className="size-3 text-primary" />
                  GPT-OSS 120B
                  <ChevronDown className="size-3" />
                </span>
              </div>
            </div>
            <p className="mx-auto mt-3 max-w-3xl text-center text-[11.5px] text-muted-foreground">
              Ember can make mistakes. Check important information.
            </p>
          </div>
        </main>
      </div>

      {/* Floating CTA */}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-30 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-2 py-1.5 shadow-[0_18px_40px_-20px_rgba(11,11,11,0.5)] backdrop-blur">
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3 text-[12.5px]">
            <Link href="/">
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 rounded-full px-4 text-[12.5px]">
            <Link href="/register">
              Request access <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
