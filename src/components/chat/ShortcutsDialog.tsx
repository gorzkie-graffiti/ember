"use client";

import {
  Command,
  EyeOff,
  PanelLeft,
  Plus,
  Search,
  Keyboard,
  TextSearch,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store/ui-store";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-secondary px-1.5 font-mono text-[11px] font-medium text-foreground shadow-[0_1px_0_var(--border)]">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  label,
  icon: Icon,
}: {
  keys: React.ReactNode;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/50">
      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </span>
      <span className="flex items-center gap-1">{keys}</span>
    </div>
  );
}

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="size-4.5 text-primary" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            Available keyboard shortcuts in Ember.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-0.5 pt-1">
          <ShortcutRow
            label="Open model picker"
            icon={Search}
            keys={
              <>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </>
            }
          />
          <ShortcutRow
            label="New chat"
            icon={Plus}
            keys={
              <>
                <Kbd>⌘</Kbd>
                <Kbd>⇧</Kbd>
                <Kbd>O</Kbd>
              </>
            }
          />
          <ShortcutRow
            label="New incognito chat"
            icon={EyeOff}
            keys={
              <>
                <Kbd>⌘</Kbd>
                <Kbd>⇧</Kbd>
                <Kbd>I</Kbd>
              </>
            }
          />
          <ShortcutRow
            label="Find in conversation"
            icon={TextSearch}
            keys={
              <>
                <Kbd>⌘</Kbd>
                <Kbd>F</Kbd>
              </>
            }
          />
          <ShortcutRow
            label="Collapse / expand sidebar"
            icon={PanelLeft}
            keys={
              <>
                <Kbd>⌘</Kbd>
                <Kbd>B</Kbd>
              </>
            }
          />
          <ShortcutRow
            label="Stop generating"
            keys={<Kbd>Esc</Kbd>}
          />
          <ShortcutRow
            label="Send message"
            keys={<Kbd>Enter</Kbd>}
          />
          <ShortcutRow
            label="New line"
            keys={
              <>
                <Kbd>⇧</Kbd>
                <Kbd>Enter</Kbd>
              </>
            }
          />
          <ShortcutRow
            label="Pick recommended model 1–4 (in picker)"
            icon={Command}
            keys={
              <>
                <Kbd>1</Kbd>–<Kbd>4</Kbd>
              </>
            }
          />
          <ShortcutRow label="This help" keys={<Kbd>?</Kbd>} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
