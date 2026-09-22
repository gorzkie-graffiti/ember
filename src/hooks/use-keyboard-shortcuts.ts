"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { useUIStore } from "@/store/ui-store";
import { useModelStore } from "@/store/model-store";
import { RECOMMENDED_MODEL_IDS } from "@/lib/models/catalog";

/**
 * Global keyboard shortcuts:
 *   ⌘K / Ctrl+K  — open model picker
 *   ⌘F / Ctrl+F  — find in conversation
 *   ⌘B / Ctrl+B  — collapse / expand sidebar rail (desktop)
 *   ⌘⇧O          — new chat
 *   ⌘⇧I          — new incognito chat
 *   ⌘/  or ?     — shortcuts help dialog
 *   Esc          — close search, else stop generating (when streaming)
 *
 * Meta-combos are ignored while typing in inputs, EXCEPT ⌘K-style
 * browser-reserved combos which work anywhere.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      const ui = useUIStore.getState();
      const chat = useChatStore.getState();

      /* ⌘K — model picker (works even while typing) */
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setModelPickerOpen(true);
        return;
      }

      /* ⌘F — find in conversation (works even while typing) */
      if (mod && e.key.toLowerCase() === "f") {
        if (ui.activeView === "chat" && chat.currentConversationId) {
          e.preventDefault();
          ui.setChatSearchOpen(true);
        }
        return;
      }

      /* ⌘B — toggle sidebar rail (desktop) */
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        ui.toggleSidebarCollapsed();
        return;
      }

      /* ⌘⇧O — new chat */
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        chat.newChat({ incognito: false });
        ui.goToChat();
        return;
      }

      /* ⌘⇧I — new incognito chat */
      if (mod && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        chat.newChat({ incognito: true });
        ui.goToChat();
        return;
      }

      /* ? or ⌘/ — shortcuts help (not while typing) */
      if (!typing && !mod && (e.key === "?" || (e.key === "/" && e.shiftKey))) {
        e.preventDefault();
        ui.setShortcutsOpen(true);
        return;
      }

      /* Esc — close in-chat search first, else stop generation */
      if (e.key === "Escape") {
        if (ui.chatSearchOpen) {
          ui.setChatSearchOpen(false);
          return;
        }
        if (chat.isGenerating) {
          chat.stopGeneration();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** Keyboard-first model search inside the picker: number keys 1–4 pick recommended. */
export function useRecommendedModelHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ui = useUIStore.getState();
      if (!ui.modelPickerOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (!/^[1-4]$/.test(e.key)) return;

      e.preventDefault();
      const modelId = RECOMMENDED_MODEL_IDS[Number(e.key) - 1];
      if (modelId) {
        useModelStore.getState().selectModel(modelId);
        ui.setModelPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
