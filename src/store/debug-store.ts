"use client";

import { create } from "zustand";

export interface DebugTurn {
  turnIndex: number;
  request: Record<string, unknown>;
  response: string | Record<string, unknown>;
  toolCall?: { tool: string; input: string };
  toolResult?: { tool: string; summary: string; detail?: string };
}

export interface MessageDebugData {
  messageId: string;
  turns: DebugTurn[];
  rawRequest: Record<string, unknown>;
  rawResponse: string;
  timestamp: number;
}

interface DebugStore {
  debugMap: Record<string, MessageDebugData>;
  activeModal: {
    messageId: string;
    type: "request" | "response";
  } | null;

  setDebugData: (messageId: string, data: MessageDebugData) => void;
  appendDebugTurn: (messageId: string, turn: DebugTurn) => void;
  openDebugModal: (messageId: string, type: "request" | "response") => void;
  closeDebugModal: () => void;
  clearDebugData: () => void;
}

const MAX_DEBUG_MESSAGES = 50;

export const useDebugStore = create<DebugStore>()((set) => ({
  debugMap: {},
  activeModal: null,

  setDebugData: (messageId, data) =>
    set((state) => {
      const keys = Object.keys(state.debugMap);
      const nextMap = { ...state.debugMap, [messageId]: data };

      // Cap size to MAX_DEBUG_MESSAGES
      if (keys.length >= MAX_DEBUG_MESSAGES && !keys.includes(messageId)) {
        const oldestKey = keys[0];
        delete nextMap[oldestKey];
      }

      return { debugMap: nextMap };
    }),

  appendDebugTurn: (messageId, turn) =>
    set((state) => {
      const existing = state.debugMap[messageId] || {
        messageId,
        turns: [],
        rawRequest: {},
        rawResponse: "",
        timestamp: Date.now(),
      };

      const updatedTurns = [...existing.turns.filter((t) => t.turnIndex !== turn.turnIndex), turn];
      const fullRequest = turn.request || existing.rawRequest;

      const responseString = updatedTurns
        .map(
          (t) =>
            `--- [Turn ${t.turnIndex + 1}] ---\nRequest:\n${JSON.stringify(
              t.request,
              null,
              2
            )}\n\nResponse:\n${
              typeof t.response === "string" ? t.response : JSON.stringify(t.response, null, 2)
            }`
        )
        .join("\n\n");

      return {
        debugMap: {
          ...state.debugMap,
          [messageId]: {
            ...existing,
            turns: updatedTurns,
            rawRequest: fullRequest,
            rawResponse: responseString,
            timestamp: Date.now(),
          },
        },
      };
    }),

  openDebugModal: (messageId, type) =>
    set({
      activeModal: { messageId, type },
    }),

  closeDebugModal: () => set({ activeModal: null }),

  clearDebugData: () => set({ debugMap: {}, activeModal: null }),
}));
