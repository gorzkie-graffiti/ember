"use client";

import { ArrowLeft, Cloud, MessageSquare, SquareCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { MobileNavButton } from "../MobileNavButton";

/**
 * Code mode placeholder — visible and reachable, intentionally inert.
 * A future cloud sandbox plugs in here without UI rewrites.
 */
export function CodeModeView() {
  const goToChat = useUIStore((s) => s.goToChat);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile header */}
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-border/50 px-3 lg:hidden">
        <MobileNavButton />
        <span className="text-[14px] font-medium">Code mode</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-secondary/40 text-muted-foreground">
            <SquareCode className="size-7" />
          </span>

          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">
              Code mode
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              Cloud sandbox execution is coming soon.
            </p>
          </div>

          <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-[11.5px] font-medium text-primary">
            <Cloud className="size-3.5" />
            Coming soon
          </span>

          <p className="max-w-sm text-[11.5px] leading-relaxed text-muted-foreground/80">
            When it lands, you&apos;ll write a prompt, get real code, and run it
            against a live sandbox — with artifacts for every generated file.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-8 gap-1.5 rounded-full text-[12.5px]"
            onClick={goToChat}
          >
            <ArrowLeft className="size-3.5" />
            <MessageSquare className="size-3.5" /> Back to chat
          </Button>
        </div>
      </div>
    </div>
  );
}
