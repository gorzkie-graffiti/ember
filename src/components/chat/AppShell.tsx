"use client";

import { useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUIStore } from "@/store/ui-store";
import { useChatStore } from "@/store/chat-store";
import { useMemoryStore } from "@/store/memory-store";
import { useArtifactsStore } from "@/store/artifacts-store";
import {
  useKeyboardShortcuts,
  useRecommendedModelHotkeys,
} from "@/hooks/use-keyboard-shortcuts";
import { Sidebar, SidebarContent } from "./Sidebar";
import { ChatView } from "./ChatView";
import { ArtifactsView, ArtifactPreviewDialog } from "./artifacts/ArtifactsView";
import { MemoryView } from "./memory/MemoryView";
import { SettingsView } from "./settings/SettingsView";
import { ProjectsView } from "./panels/ProjectsView";
import { CodeModeView } from "./panels/CodeModeView";
import { ModelPickerDialog } from "./ModelPickerDialog";
import { PromptsPickerDialog } from "./PromptsPickerDialog";
import { VisionFallbackDialog } from "./VisionFallbackDialog";
import { LargePasteDialog } from "./LargePasteDialog";
import { AllConversationsDialog } from "./AllConversationsDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { RawDebugModal } from "./RawDebugModal";
import { useModelStore } from "@/store/model-store";
import type { AccountInfo } from "./AccountMenu";

/**
 * Single-route application shell. Views switch inside the main area —
 * no additional routes (per prototype constraints).
 */
export function AppShell({ account }: { account: AccountInfo }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const activeView = useUIStore((s) => s.activeView);

  useKeyboardShortcuts();
  useRecommendedModelHotkeys();

  /* Load persisted state from the server once on mount. */
  useEffect(() => {
    void useChatStore.getState().hydrateFromServer();
    void useMemoryStore.getState().hydrateFromServer();
    void useArtifactsStore.getState().hydrateFromServer();
    // Which providers have API keys in server env — lights up picker rows.
    void useModelStore.getState().hydrateProviders();
    // Deferred localStorage rehydration — keeps the first client render
    // identical to SSR (see skipHydration note in model-store).
    void useModelStore.persist.rehydrate();
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar account={account} />

      {/* Mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[288px] gap-0 border-sidebar-border bg-sidebar p-0"
        >
          <SidebarContent account={account} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {activeView === "chat" && <ChatView account={account} />}
        {activeView === "artifacts" && <ArtifactsView />}
        {activeView === "memory" && <MemoryView />}
        {activeView === "settings" && <SettingsView />}
        {activeView === "projects" && <ProjectsView />}
        {activeView === "code" && <CodeModeView />}
      </main>

      {/* Global dialogs */}
      <ModelPickerDialog />
      <PromptsPickerDialog />
      <VisionFallbackDialog />
      <LargePasteDialog />
      <AllConversationsDialog />
      <ArtifactPreviewDialog />
      <ShortcutsDialog />
      <RawDebugModal />
    </div>
  );
}
