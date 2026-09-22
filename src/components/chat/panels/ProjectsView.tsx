"use client";

import { toast } from "sonner";
import { Brain, FolderKanban, MessageSquare, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/models/types";
import { MobileNavButton } from "../MobileNavButton";

/** Placeholder dataset — Projects are a preview feature. */
const PLACEHOLDER_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Chat Prototype",
    description: "The AI chat client you are building right now.",
    chatCount: 4,
    fileCount: 3,
    memoryCount: 2,
    color: "#F0653F",
  },
  {
    id: "proj-2",
    name: "Infra Migration",
    description: "Moving internal services to the new gateway.",
    chatCount: 7,
    fileCount: 12,
    memoryCount: 1,
    color: "#22C5A9",
  },
];

/**
 * Projects placeholder — visible in the product structure, deliberately
 * shallow. The architecture leaves room for Chats / Files / Project Memory
 * per project.
 */
export function ProjectsView() {
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-start gap-2">
          <MobileNavButton />
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-semibold">
              <FolderKanban className="size-5 text-primary" /> Projects
            </h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
              Group chats, files, and an isolated project Memory around one
              initiative. Full functionality is on the roadmap.
            </p>
          </div>
        </header>

        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Preview · structure shown, interactions limited
          </span>
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-full text-[12.5px]"
            onClick={() =>
              toast.info("Projects are coming soon", {
                description:
                  "You'll be able to create projects with their own chats, files, and memory.",
              })
            }
          >
            <Plus className="size-3.5" /> New project
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PLACEHOLDER_PROJECTS.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                toast.info("Project workspaces are coming soon", {
                  description: `${p.name} · ${p.chatCount} chats, ${p.fileCount} files, ${p.memoryCount} project memories.`,
                })
              }
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex size-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${p.color}22`, color: p.color }}
                >
                  <FolderKanban className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{p.name}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {p.description}
                  </div>
                </div>
              </div>

              {/* Future structure preview */}
              <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-1">
                  <MessageSquare className="size-3" /> {p.chatCount} chats
                </span>
                <span className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-1">
                  <Sparkles className="size-3" /> {p.fileCount} files
                </span>
                <span className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-1">
                  <Brain className="size-3" /> {p.memoryCount} memories
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-border px-4 py-3.5 text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Planned shape:</span>{" "}
          Project → Chats, Files, and Project Memory — with project memory
          isolated from your account-wide Memory.
        </div>
      </div>
    </div>
  );
}
