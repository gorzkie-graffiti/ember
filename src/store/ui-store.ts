"use client";

import { create } from "zustand";
import { useComposerStore } from "./composer-store";

export type AppView =
  | "chat"
  | "artifacts"
  | "memory"
  | "projects"
  | "code"
  | "settings";

interface UIStore {
  /** Mobile drawer / desktop panel */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  /** Desktop sidebar collapse-to-icon-rail */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;

  activeView: AppView;
  setActiveView: (view: AppView) => void;
  /** Jump to the chat view and make sure the composer is in chat mode. */
  goToChat: () => void;

  modelPickerOpen: boolean;
  setModelPickerOpen: (open: boolean) => void;

  /** In-chat prompt/style switcher (version → prompt hierarchy). */
  promptsPickerOpen: boolean;
  setPromptsPickerOpen: (open: boolean) => void;

  /** In-chat message search (⌘F). Query itself lives in ChatView. */
  chatSearchOpen: boolean;
  setChatSearchOpen: (open: boolean) => void;

  /** Keyboard-shortcuts help dialog */
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  allConversationsOpen: boolean;
  setAllConversationsOpen: (open: boolean) => void;

  /** Artifact currently being previewed (null = closed) */
  artifactPreviewId: string | null;
  setArtifactPreviewId: (id: string | null) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  activeView: "chat",
  setActiveView: (view) => set({ activeView: view, sidebarOpen: false }),

  goToChat: () => {
    const composer = useComposerStore.getState();
    if (composer.mode !== "chat") composer.setMode("chat");
    set({ activeView: "chat", sidebarOpen: false });
  },

  modelPickerOpen: false,
  setModelPickerOpen: (open) => set({ modelPickerOpen: open }),

  promptsPickerOpen: false,
  setPromptsPickerOpen: (open) => set({ promptsPickerOpen: open }),

  chatSearchOpen: false,
  setChatSearchOpen: (open) => set({ chatSearchOpen: open }),

  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  allConversationsOpen: false,
  setAllConversationsOpen: (open) => set({ allConversationsOpen: open }),

  artifactPreviewId: null,
  setArtifactPreviewId: (id) => set({ artifactPreviewId: id }),
}));
