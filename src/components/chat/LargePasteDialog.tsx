"use client";

import { FileText, Type } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useComposerStore } from "@/store/composer-store";
import { LARGE_PASTE_THRESHOLD } from "@/lib/constants";

/**
 * Large-paste decision. Capability-driven:
 * - Only shown when the paste exceeds LARGE_PASTE_THRESHOLD.
 * - Only offered when the selected model supports files; otherwise the
 *   paste silently stays as text (handled in the Composer).
 */
export function LargePasteDialog() {
  const pendingPaste = useComposerStore((s) => s.pendingPaste);
  const setPendingPaste = useComposerStore((s) => s.setPendingPaste);
  const requestTextInsert = useComposerStore((s) => s.requestTextInsert);
  const pasteAsFile = useComposerStore((s) => s.pasteAsFile);

  const open = pendingPaste !== null;
  const charCount = pendingPaste?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setPendingPaste(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            This is a large amount of text.
          </DialogTitle>
          <DialogDescription className="text-left text-[13px]">
            Keep as text or turn it into a file?
            <span className="mt-1 block text-[11.5px] text-muted-foreground">
              {charCount.toLocaleString()} characters (threshold:{" "}
              {LARGE_PASTE_THRESHOLD.toLocaleString()})
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="outline"
            className="h-11 justify-start gap-3 rounded-xl"
            onClick={() => {
              if (pendingPaste) requestTextInsert(pendingPaste);
              setPendingPaste(null);
            }}
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-secondary">
              <Type className="size-3.5" />
            </span>
            <span className="text-left">
              <span className="block text-[13px] font-medium">Keep as text</span>
              <span className="block text-[11.5px] text-muted-foreground">
                Paste everything into the message
              </span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-11 justify-start gap-3 rounded-xl"
            onClick={() => pasteAsFile()}
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-secondary">
              <FileText className="size-3.5" />
            </span>
            <span className="text-left">
              <span className="block text-[13px] font-medium">
                Paste as file
              </span>
              <span className="block text-[11.5px] text-muted-foreground">
                Create pasted-context.txt and attach it
              </span>
            </span>
          </Button>
        </div>

        <DialogFooter className="mt-1 flex-col gap-1 sm:flex-col">
          <p className="text-center text-[11px] leading-snug text-muted-foreground">
            The file lands in your conversation&apos;s Artifacts, keeping the
            message itself short.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
