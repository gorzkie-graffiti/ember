"use client";

import { useState } from "react";
import { Check, Copy, Code2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDebugStore } from "@/store/debug-store";

export function RawDebugModal() {
  const activeModal = useDebugStore((s) => s.activeModal);
  const debugMap = useDebugStore((s) => s.debugMap);
  const closeDebugModal = useDebugStore((s) => s.closeDebugModal);
  const [copied, setCopied] = useState(false);
  const [selectedTurn, setSelectedTurn] = useState<number>(0);

  if (!activeModal) return null;

  const debugData = debugMap[activeModal.messageId];
  const isRequest = activeModal.type === "request";
  const title = isRequest ? "Raw Request Payload" : "Raw Response Stream";

  let displayText = "No debug data recorded for this message.";

  if (debugData) {
    if (debugData.turns && debugData.turns.length > 0) {
      const turnIdx = Math.min(selectedTurn, debugData.turns.length - 1);
      const turn = debugData.turns[turnIdx] || debugData.turns[0];
      const targetObj = isRequest ? turn.request : turn.response;
      displayText =
        typeof targetObj === "string"
          ? targetObj
          : JSON.stringify(targetObj, null, 2);
    } else {
      const targetObj = isRequest ? debugData.rawRequest : debugData.rawResponse;
      displayText =
        typeof targetObj === "string"
          ? targetObj
          : JSON.stringify(targetObj, null, 2);
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasTurns = debugData?.turns && debugData.turns.length > 1;

  return (
    <Dialog open={Boolean(activeModal)} onOpenChange={(open) => !open && closeDebugModal()}>
      <DialogContent className="max-w-3xl border border-border/60 bg-background/95 p-6 backdrop-blur-xl sm:rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Code2 className="size-4 text-primary" />
            <span>{title}</span>
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copy}
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy JSON
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeDebugModal}
              className="size-8 rounded-full"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {hasTurns && (
          <div className="mt-3 flex gap-1 border-b border-border/40 pb-2">
            {debugData.turns.map((t, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedTurn(idx)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedTurn === idx
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                Turn {idx + 1} {t.toolCall ? `(${t.toolCall.tool})` : ""}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-border/50 bg-black/60 p-4 font-mono text-[12px] leading-relaxed text-emerald-400/90 shadow-inner">
          <pre className="whitespace-pre-wrap break-words">{displayText}</pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
