"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";

/** Hamburger shown only on mobile, for panels without their own top bar. */
export function MobileNavButton() {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open sidebar"
      className="size-9 shrink-0 rounded-lg lg:hidden"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu className="size-4.5" />
    </Button>
  );
}
