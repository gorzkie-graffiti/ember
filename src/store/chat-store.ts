"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type {
  Attachment,
  ChatMessage,
  Conversation,
  EffortLevel,
  ToolActivity,
} from "@/lib/models/types";
import { getModel, getModelOrThrow } from "@/lib/models/catalog";
import { useModelStore } from "./model-store";
import { useMemoryStore } from "./memory-store";
import { useArtifactsStore } from "./artifacts-store";
import { useComposerStore } from "./composer-store";
import { useDebugStore } from "./debug-store";

/* ------------------------------------------------------------------ */
/* Streaming + persistence plumbing (module-level, never serialized)   */
/* ------------------------------------------------------------------ */

let generationToken = 0;
let abortController: AbortController | null = null;
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let hydratePromise: Promise<void> | null = null;

const SYNC_DEBOUNCE_MS = 600;

function ensureModelConnected(modelId: string): boolean {
  if (useModelStore.getState().isModelLive(modelId)) return true;
  const model = getModel(modelId);
  const envVar = model
    ? useModelStore.getState().providerEnvVars[model.provider]
    : undefined;
  toast.error("Model not connected", {
    description: envVar
      ? `Add ${envVar} to .env and restart the dev server, or pick a connected model.`
      : "This provider isn't wired to the backend. Pick a connected model.",
  });
  return false;
}

type ChatStreamEvent =
  | { type: "thinking"; content?: string }
  | { type: "content"; content?: string }
  | { type: "truncate"; content?: string }
  | { type: "tool_start"; id?: string; tool?: "web_search" | "web_fetch"; input?: string }
  | { type: "tool_end"; id?: string; tool?: "web_search" | "web_fetch"; resultSummary?: string }
  | { type: "debug"; turnIndex?: number; request?: Record<string, unknown>; response?: string | Record<string, unknown> }
  | { type: "error"; message?: string }
  | { type: "done" };

interface ChatAttachmentPayload {
  name: string;
  mime: string;
  textContent?: string;
  visionAnalysis?: string;
  extractedText?: string;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatStore {
  conversations: Conversation[];
  currentConversationId: string | null;
  isGenerating: boolean;
  generatingMessageId: string | null;
  hydrated: boolean;

  newChat: (opts?: { incognito?: boolean }) => string;
  openChat: (id: string) => void;
  closeChat: () => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;

  sendMessage: (text: string) => Promise<void>;
  stopGeneration: () => void;
  regenerateMessage: (messageId: string) => void;
  retryMessage: (messageId: string) => void;
  continueMessage: (messageId: string) => void;
  editUserMessage: (messageId: string, newText: string) => void;

  hydrateFromServer: () => Promise<void>;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean || "New chat";
  return `${clean.slice(0, 48).trimEnd()}…`;
}

function isGeneratingIn(conversationId: string): boolean {
  const s = useChatStore.getState();
  if (!s.isGenerating || !s.generatingMessageId) return false;
  const generatingMessageId = s.generatingMessageId;
  return s.conversations.some(
    (c) =>
      c.id === conversationId &&
      c.messages.some((m) => m.id === generatingMessageId),
  );
}

function getHistory(
  conversationId: string,
  excludeMessageId?: string,
): HistoryMessage[] {
  const convo = useChatStore
    .getState()
    .conversations.find((c) => c.id === conversationId);
  if (!convo) return [];
  return convo.messages
    .filter((m) => m.id !== excludeMessageId)
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
}

function toChatAttachments(
  attachments: Attachment[],
): ChatAttachmentPayload[] {
  return attachments.map((a) => ({
    name: a.name,
    mime: a.mime,
    ...(a.textContent ? { textContent: a.textContent } : {}),
    ...(a.visionAnalysis ? { visionAnalysis: a.visionAnalysis.result } : {}),
    ...(a.extractedText ? { extractedText: a.extractedText } : {}),
  }));
}

function scheduleSync(conversationId: string) {
  const s = useChatStore.getState();
  const convo = s.conversations.find((c) => c.id === conversationId);
  if (!convo || convo.incognito || !s.hydrated || isGeneratingIn(conversationId)) return;

  const existing = syncTimers.get(conversationId);
  if (existing) clearTimeout(existing);
  syncTimers.set(
    conversationId,
    setTimeout(() => {
      syncTimers.delete(conversationId);
      void syncConversation(conversationId);
    }, SYNC_DEBOUNCE_MS),
  );
}

async function syncConversation(conversationId: string) {
  const s = useChatStore.getState();
  const convo = s.conversations.find((c) => c.id === conversationId);
  if (!convo || convo.incognito || !s.hydrated || isGeneratingIn(conversationId)) return;
  try {
    await fetch("/api/conversations", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation: convo }),
    });
  } catch {
    // Offline-tolerant
  }
}

function patchMessage(
  conversationId: string,
  messageId: string,
  patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>),
) {
  useChatStore.setState((s) => ({
    conversations: s.conversations.map((c) =>
      c.id !== conversationId
        ? c
        : {
            ...c,
            updatedAt: Date.now(),
            messages: c.messages.map((m) =>
              m.id !== messageId
                ? m
                : { ...m, ...(typeof patch === "function" ? patch(m) : patch) },
            ),
          },
    ),
  }));
  scheduleSync(conversationId);
}

function appendMessage(conversationId: string, message: ChatMessage) {
  useChatStore.setState((s) => ({
    conversations: s.conversations.map((c) =>
      c.id !== conversationId
        ? c
        : { ...c, updatedAt: Date.now(), messages: [...c.messages, message] },
    ),
  }));
  scheduleSync(conversationId);
}

function truncateAfter(conversationId: string, messageId: string) {
  useChatStore.setState((s) => ({
    conversations: s.conversations.map((c) => {
      if (c.id !== conversationId) return c;
      const idx = c.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return c;
      return { ...c, messages: c.messages.slice(0, idx) };
    }),
  }));
  scheduleSync(conversationId);
}

function persistAttachments(
  attachments: Attachment[],
  conversation: Conversation,
) {
  if (attachments.length === 0) return;
  useArtifactsStore.getState().addArtifacts(
    attachments.map((a) => ({
      name: a.name,
      kind: a.kind,
      size: a.size,
      origin: "user" as const,
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      mime: a.mime,
      textContent: a.textContent,
      dataUrl: a.dataUrl,
    })),
  );
}

const REMEMBER_RE = /remember\s+(?:that\s+|this[,:]?\s+)?(.+)/i;
const FORGET_RE = /forget\s+(?:that\s+|about\s+)?(.+)/i;

function maybeWriteMemory(prompt: string, incognito: boolean) {
  if (incognito) return;
  const memoryStore = useMemoryStore.getState();
  if (memoryStore.prefs.paused) return;

  const remember = prompt.match(REMEMBER_RE);
  if (remember && remember[1].trim().length > 2) {
    memoryStore.addMemory(remember[1].trim(), undefined, "user");
    toast.success("Saved to Memory", {
      description: remember[1].trim().slice(0, 80),
    });
    return;
  }

  const forget = prompt.match(FORGET_RE);
  if (forget) {
    const needle = forget[1].trim().toLowerCase();
    const match = memoryStore.memories.find((m) =>
      m.content.toLowerCase().includes(needle),
    );
    if (match) {
      memoryStore.deleteMemory(match.id);
      toast.success("Removed from Memory", {
        description: match.content.slice(0, 80),
      });
    } else {
      toast("No matching memory found", {
        description: `Nothing in Memory matches “${needle.slice(0, 60)}”.`,
      });
    }
  }
}

async function maybeExtractMemory(conversationId: string, incognito: boolean) {
  if (incognito) return;
  const memoryStore = useMemoryStore.getState();
  if (memoryStore.prefs.paused) return;

  const conversation = useChatStore
    .getState()
    .conversations.find((c) => c.id === conversationId);
  if (!conversation) return;

  const messages = conversation.messages
    .slice(-8)
    .filter(
      (m): m is ChatMessage & { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.length === 0) return;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  try {
    const resp = await fetch("/api/memories/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, userText: lastUser?.content ?? "" }),
    });
    if (!resp.ok) return;
    const json = (await resp.json()) as {
      saved?: number;
      touchedSensitive?: boolean;
    };
    if ((json.saved ?? 0) > 0) {
      void memoryStore.hydrateFromServer();
      toast.success("Memory updated", {
        description: "New durable facts were saved from this conversation.",
      });
    }
    if (json.touchedSensitive && !memoryStore.prefs.includeSensitive) {
      useMemoryStore.setState({ pendingSensitiveNotice: true });
    }
  } catch {
    /* fire-and-forget */
  }
}

/**
 * Auto-names the conversation once the first exchange completes. The server
 * runs a cheap curator model (see /api/conversations/title); the client's
 * first-message truncation stays as the immediate fallback and is only
 * replaced when server-side naming succeeds.
 */
async function maybeAutoTitle(
  conversationId: string,
  incognito: boolean,
  fallbackTitle: string,
) {
  if (incognito) return;
  const convo = useChatStore
    .getState()
    .conversations.find((c) => c.id === conversationId);
  if (!convo || convo.title !== fallbackTitle) return;

  const messages = convo.messages
    .filter(
      (m): m is ChatMessage & { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") &&
        m.content.trim().length > 0,
    )
    .slice(0, 2)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (messages.length === 0) return;

  try {
    const resp = await fetch("/api/conversations/title", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!resp.ok) return;
    const json = (await resp.json()) as { ok?: boolean; title?: string };
    if (!json.ok || typeof json.title !== "string") return;
    const title = json.title.trim();
    if (!title) return;

    // Don't clobber a title the user set while the request was in flight.
    const current = useChatStore
      .getState()
      .conversations.find((c) => c.id === conversationId);
    if (!current || current.title !== fallbackTitle) return;

    useChatStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, title } : c,
      ),
    }));
    scheduleSync(conversationId);
  } catch {
    // fire-and-forget — the truncation fallback title stays.
  }
}

interface RunGenerationArgs {
  token: number;
  conversationId: string;
  assistantMessageId: string;
  history: HistoryMessage[];
  modelId: string;
  thinking: boolean;
  effort: EffortLevel;
  memories: string[];
  attachments: ChatAttachmentPayload[];
  memoryEntriesUsed: number;
  routedThrough: string[];
  incognito: boolean;
  continuation?: boolean;
  append?: boolean;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function runGeneration(args: RunGenerationArgs) {
  const {
    token,
    conversationId,
    assistantMessageId,
    history,
    modelId,
    thinking,
    effort,
    memories,
    attachments,
    memoryEntriesUsed,
    routedThrough,
    incognito,
    continuation,
  } = args;

  const alive = () => generationToken === token;
  if (!alive()) return;

  if (abortController) abortController.abort();
  const controller = new AbortController();
  abortController = controller;

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: history,
        thinking,
        effort,
        ...(memories.length > 0 ? { memories } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(continuation ? { continuation: true } : {}),
      }),
      signal: controller.signal,
    });

    if (!alive()) return;

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(
        text.trim() || `The server returned an error (${resp.status}).`,
      );
    }
    if (!resp.body) throw new Error("The response stream is unavailable.");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawDone = false;
    let sawError = false;
    let errorMessage = "";

    const handleLine = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return false;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        sawDone = true;
        return false;
      }
      if (!payload) return false;

      let event: ChatStreamEvent;
      try {
        event = JSON.parse(payload) as ChatStreamEvent;
      } catch {
        return false;
      }

      switch (event.type) {
        case "thinking":
          if (!alive()) return true;
          patchMessage(conversationId, assistantMessageId, (m) => ({
            status: "thinking",
            memoryEntriesUsed: incognito ? 0 : memoryEntriesUsed,
            routedThrough,
            thinking: (m.thinking ?? "") + (event.content ?? ""),
          }));
          return false;
        case "content":
          if (!alive()) return true;
          patchMessage(conversationId, assistantMessageId, (m) => ({
            status: "streaming",
            memoryEntriesUsed: incognito ? 0 : memoryEntriesUsed,
            routedThrough,
            content: m.content + (event.content ?? ""),
          }));
          return false;
        case "truncate":
          // Server detected a degenerate loop / output cap and replaced the
          // message content with its trimmed version.
          if (!alive()) return true;
          patchMessage(conversationId, assistantMessageId, (m) => ({
            status: "streaming",
            content: typeof event.content === "string" ? event.content : m.content,
            thinking: m.thinking,
          }));
          if (typeof event.content === "string") {
            toast.info("Repetitive output trimmed", {
              description: "The model got stuck repeating itself; the loop was cut off.",
            });
          }
          return false;
        case "tool_start":
          if (!alive()) return true;
          patchMessage(conversationId, assistantMessageId, (m) => {
            const current = m.toolActivities ?? [];
            const newActivity: ToolActivity = {
              id: event.id || `tool-${Date.now()}`,
              tool: event.tool || "web_search",
              input: event.input || "",
              status: "running",
            };
            return {
              status: "streaming",
              toolActivities: [
                ...current.filter((a) => a.id !== newActivity.id),
                newActivity,
              ],
            };
          });
          return false;
        case "tool_end":
          if (!alive()) return true;
          patchMessage(conversationId, assistantMessageId, (m) => {
            const current = m.toolActivities ?? [];
            return {
              toolActivities: current.map((a) =>
                a.id === event.id
                  ? { ...a, status: "done", resultSummary: event.resultSummary }
                  : a
              ),
            };
          });
          return false;
        case "debug":
          if (!alive()) return true;
          if (event.request && event.response) {
            useDebugStore.getState().appendDebugTurn(assistantMessageId, {
              turnIndex: event.turnIndex ?? 0,
              request: event.request,
              response: event.response,
            });
          }
          return false;
        case "error":
          sawError = true;
          errorMessage = event.message || "The model failed to respond.";
          return true;
        case "done":
          sawDone = true;
          return false;
        default:
          return false;
      }
    };

    const readLoop = async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!alive()) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (handleLine(line)) return;
        }
      }
      if (buffer) handleLine(buffer);
    };

    await readLoop();

    if (sawError && !reader.closed) {
      void reader.cancel().catch(() => {});
    }

    if (!alive()) return;

    if (sawError) {
      patchMessage(conversationId, assistantMessageId, {
        status: "error",
        error: errorMessage,
      });
      useChatStore.setState({ isGenerating: false, generatingMessageId: null });
      toast.error("Generation failed", { description: errorMessage });
      scheduleSync(conversationId);
      return;
    }

    patchMessage(conversationId, assistantMessageId, { status: "done" });
    useChatStore.setState({ isGenerating: false, generatingMessageId: null });
    scheduleSync(conversationId);
    void maybeExtractMemory(conversationId, incognito);
  } catch (err) {
    if (isAbortError(err)) {
      scheduleSync(conversationId);
      return;
    }
    if (!alive()) return;
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Something went wrong while generating a response.";
    patchMessage(conversationId, assistantMessageId, {
      status: "error",
      error: message,
    });
    useChatStore.setState({ isGenerating: false, generatingMessageId: null });
    toast.error("Generation failed", { description: message });
    scheduleSync(conversationId);
  } finally {
    if (abortController === controller) abortController = null;
  }
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  isGenerating: false,
  generatingMessageId: null,
  hydrated: false,

  newChat: (opts) => {
    const { incognito = false } = opts ?? {};
    const id = uid("chat");
    const conversation: Conversation = {
      id,
      title: "New chat",
      incognito,
      modelId: useModelStore.getState().selectedModelId,
      effort: useModelStore.getState().effort,
      thinkingEnabled: useModelStore.getState().thinkingEnabled,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      currentConversationId: id,
    }));
    scheduleSync(id);
    return id;
  },

  openChat: (id) => set({ currentConversationId: id }),
  closeChat: () => set({ currentConversationId: null }),

  renameChat: (id, title) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title: title.trim() || c.title } : c,
      ),
    }));
    scheduleSync(id);
  },

  deleteChat: (id) => {
    const convo = get().conversations.find((c) => c.id === id);
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      return {
        conversations,
        currentConversationId:
          s.currentConversationId === id ? null : s.currentConversationId,
      };
    });
    const timer = syncTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      syncTimers.delete(id);
    }
    if (convo && !convo.incognito && get().hydrated) {
      void fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    const composer = useComposerStore.getState();
    const attachments = [...composer.draftAttachments];
    if (!trimmed && attachments.length === 0) return;

    if (!ensureModelConnected(useModelStore.getState().selectedModelId)) {
      return;
    }

    let conversation = get().conversations.find(
      (c) => c.id === get().currentConversationId,
    );
    if (!conversation) {
      const id = get().newChat({ incognito: false });
      conversation = get().conversations.find((c) => c.id === id);
    }
    if (!conversation) return;

    const modelStore = useModelStore.getState();
    const model = getModelOrThrow(modelStore.selectedModelId);

    const userMessage: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: trimmed,
      attachments: attachments.length ? attachments : undefined,
      status: "done",
      createdAt: Date.now(),
    };
    appendMessage(conversation.id, userMessage);
    persistAttachments(attachments, conversation);

    let titleFallback = "New chat";
    if (conversation.messages.length === 0 && trimmed) {
      titleFallback = deriveTitle(trimmed);
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversation!.id ? { ...c, title: titleFallback } : c,
        ),
      }));
      scheduleSync(conversation.id);
    }

    composer.clearAttachments();
    maybeWriteMemory(trimmed, conversation.incognito);

    const memoryStore = useMemoryStore.getState();
    const relevant = conversation.incognito
      ? []
      : memoryStore.relevantMemories(trimmed);
    const routedThrough = attachments
      .filter((a) => a.visionAnalysis)
      .map((a) => a.visionAnalysis!.viaModelName);

    const assistantMessage: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content: "",
      status: "pending",
      modelId: model.id,
      modelDisplayName: model.displayName,
      createdAt: Date.now(),
    };
    appendMessage(conversation.id, assistantMessage);

    generationToken += 1;
    set({
      isGenerating: true,
      generatingMessageId: assistantMessage.id,
    });

    await runGeneration({
      token: generationToken,
      conversationId: conversation.id,
      assistantMessageId: assistantMessage.id,
      history: getHistory(conversation.id, assistantMessage.id),
      modelId: model.id,
      thinking: modelStore.thinkingEnabled && model.capabilities.thinking,
      effort: modelStore.effort,
      memories: relevant.map((m) => m.content),
      attachments: toChatAttachments(attachments),
      memoryEntriesUsed: relevant.length,
      routedThrough,
      incognito: conversation.incognito,
    });

    void maybeAutoTitle(
      conversation.id,
      conversation.incognito,
      titleFallback,
    );
  },

  stopGeneration: () => {
    generationToken += 1;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    const { generatingMessageId, conversations, currentConversationId } =
      get();
    if (generatingMessageId && currentConversationId) {
      const msg = conversations
        .find((c) => c.id === currentConversationId)
        ?.messages.find((m) => m.id === generatingMessageId);
      if (msg && ["pending", "thinking", "streaming"].includes(msg.status)) {
        patchMessage(currentConversationId, generatingMessageId, {
          status: "stopped",
        });
      }
    }
    set({ isGenerating: false, generatingMessageId: null });
    scheduleSync(currentConversationId ?? "");
  },

  regenerateMessage: (messageId) => {
    if (!ensureModelConnected(useModelStore.getState().selectedModelId)) {
      return;
    }

    const { currentConversationId } = get();
    if (!currentConversationId) return;
    const conversation = get().conversations.find(
      (c) => c.id === currentConversationId,
    );
    if (!conversation) return;

    const idx = conversation.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const target = conversation.messages[idx];
    if (target.role !== "assistant") return;

    let userIdx = idx - 1;
    while (userIdx >= 0 && conversation.messages[userIdx].role !== "user") {
      userIdx -= 1;
    }
    const userMessage = userIdx >= 0 ? conversation.messages[userIdx] : null;

    truncateAfter(conversation.id, messageId);

    const modelStore = useModelStore.getState();
    const model = getModelOrThrow(modelStore.selectedModelId);
    const memoryStore = useMemoryStore.getState();
    const relevant = conversation.incognito
      ? []
      : memoryStore.relevantMemories(userMessage?.content ?? "");
    const attachments = userMessage?.attachments ?? [];

    const assistantMessage: ChatMessage = {
      ...target,
      content: "",
      thinking: undefined,
      toolActivities: undefined,
      status: "pending",
      error: undefined,
      modelId: model.id,
      modelDisplayName: model.displayName,
      createdAt: Date.now(),
    };
    appendMessage(conversation.id, assistantMessage);

    generationToken += 1;
    set({ isGenerating: true, generatingMessageId: assistantMessage.id });

    void runGeneration({
      token: generationToken,
      conversationId: conversation.id,
      assistantMessageId: assistantMessage.id,
      history: getHistory(conversation.id, assistantMessage.id),
      modelId: model.id,
      thinking: modelStore.thinkingEnabled && model.capabilities.thinking,
      effort: modelStore.effort,
      memories: relevant.map((m) => m.content),
      attachments: toChatAttachments(attachments),
      memoryEntriesUsed: relevant.length,
      routedThrough: attachments
        .filter((a) => a.visionAnalysis)
        .map((a) => a.visionAnalysis!.viaModelName),
      incognito: conversation.incognito,
    });
  },

  retryMessage: (messageId) => get().regenerateMessage(messageId),

  continueMessage: (messageId) => {
    const { currentConversationId } = get();
    if (!currentConversationId) return;
    const conversation = get().conversations.find(
      (c) => c.id === currentConversationId,
    );
    if (!conversation) return;
    const target = conversation.messages.find((m) => m.id === messageId);
    if (!target || target.role !== "assistant" || target.status !== "done")
      return;

    const modelStore = useModelStore.getState();
    const continueModelId =
      target.modelId && getModel(target.modelId)
        ? target.modelId
        : modelStore.selectedModelId;
    if (!ensureModelConnected(continueModelId)) return;
    const model = getModelOrThrow(continueModelId);
    const firstUser = conversation.messages.find((m) => m.role === "user");
    const memoryStore = useMemoryStore.getState();
    const relevant = conversation.incognito
      ? []
      : memoryStore.relevantMemories(firstUser?.content ?? "");
    const lastUser = [...conversation.messages]
      .reverse()
      .find((m) => m.role === "user");
    const attachments = lastUser?.attachments ?? [];

    const history: HistoryMessage[] = [
      ...getHistory(currentConversationId),
      {
        role: "user",
        content: "Continue exactly where you left off, do not repeat.",
      },
    ];

    generationToken += 1;
    set({ isGenerating: true, generatingMessageId: messageId });

    void runGeneration({
      token: generationToken,
      conversationId: conversation.id,
      assistantMessageId: messageId,
      history,
      modelId: model.id,
      thinking: modelStore.thinkingEnabled && model.capabilities.thinking,
      effort: modelStore.effort,
      memories: relevant.map((m) => m.content),
      attachments: toChatAttachments(attachments),
      memoryEntriesUsed: relevant.length,
      routedThrough: [],
      incognito: conversation.incognito,
      continuation: true,
      append: true,
    });
  },

  editUserMessage: (messageId, newText) => {
    if (!ensureModelConnected(useModelStore.getState().selectedModelId)) {
      return;
    }

    const { currentConversationId } = get();
    if (!currentConversationId) return;
    const conversation = get().conversations.find(
      (c) => c.id === currentConversationId,
    );
    if (!conversation) return;
    const idx = conversation.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const target = conversation.messages[idx];
    if (target.role !== "user") return;

    const trimmed = newText.trim();
    if (!trimmed) return;

    patchMessage(currentConversationId, messageId, { content: trimmed });
    truncateAfter(currentConversationId, messageId);

    const modelStore = useModelStore.getState();
    const model = getModelOrThrow(modelStore.selectedModelId);
    const memoryStore = useMemoryStore.getState();
    const relevant = conversation.incognito
      ? []
      : memoryStore.relevantMemories(trimmed);
    const attachments = target.attachments ?? [];

    const assistantMessage: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content: "",
      status: "pending",
      modelId: model.id,
      modelDisplayName: model.displayName,
      createdAt: Date.now(),
    };
    appendMessage(currentConversationId, assistantMessage);

    generationToken += 1;
    set({ isGenerating: true, generatingMessageId: assistantMessage.id });

    void runGeneration({
      token: generationToken,
      conversationId: currentConversationId,
      assistantMessageId: assistantMessage.id,
      history: getHistory(currentConversationId, assistantMessage.id),
      modelId: model.id,
      thinking: modelStore.thinkingEnabled && model.capabilities.thinking,
      effort: modelStore.effort,
      memories: relevant.map((m) => m.content),
      attachments: toChatAttachments(attachments),
      memoryEntriesUsed: relevant.length,
      routedThrough: attachments
        .filter((a) => a.visionAnalysis)
        .map((a) => a.visionAnalysis!.viaModelName),
      incognito: conversation.incognito,
    });
  },

  hydrateFromServer: () => {
    if (get().hydrated) return Promise.resolve();
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const resp = await fetch("/api/conversations");
        if (!resp.ok) return;
        const json = (await resp.json()) as { conversations?: Conversation[] };
        const docs = Array.isArray(json?.conversations)
          ? json.conversations
          : [];

        const healed = docs.map((c) => ({
          ...c,
          messages: (Array.isArray(c.messages) ? c.messages : []).map((m) =>
            ["pending", "thinking", "streaming"].includes(m.status)
              ? { ...m, status: "stopped" as const }
              : m,
          ),
        }));

        useChatStore.setState((s) => ({
          conversations: [
            ...s.conversations.filter((c) => c.incognito),
            ...healed,
          ].sort((a, b) => b.updatedAt - a.updatedAt),
          isGenerating: false,
          generatingMessageId: null,
          hydrated: true,
        }));
      } catch {
        // Offline-tolerant
      } finally {
        hydratePromise = null;
      }
    })();
    return hydratePromise;
  },
}));

/* ------------------------------------------------------------------ */
/* History helpers                                                     */
/* ------------------------------------------------------------------ */

export type HistoryGroup =
  | "Incognito"
  | "Today"
  | "Yesterday"
  | "Previous 7 days"
  | "Older";

export function groupConversationsByDate(
  conversations: Conversation[],
): Array<{ label: HistoryGroup; items: Conversation[] }> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const DAY = 86_400_000;

  const groups: Record<HistoryGroup, Conversation[]> = {
    Incognito: [],
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const c of conversations) {
    if (c.incognito) {
      groups.Incognito.push(c);
      continue;
    }
    const t = c.updatedAt;
    if (t >= startOfToday) groups.Today.push(c);
    else if (t >= startOfToday - DAY) groups.Yesterday.push(c);
    else if (t >= startOfToday - 7 * DAY) groups["Previous 7 days"].push(c);
    else groups.Older.push(c);
  }

  const order: HistoryGroup[] = [
    "Incognito",
    "Today",
    "Yesterday",
    "Previous 7 days",
    "Older",
  ];
  return order
    .filter((label) => groups[label].length > 0)
    .map((label) => ({
      label,
      items: groups[label].sort((a, b) => b.updatedAt - a.updatedAt),
    }));
}

export function searchConversations(
  conversations: Conversation[],
  query: string,
): Conversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations.filter((c) => !c.incognito);
  return conversations
    .filter((c) => !c.incognito)
    .filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
}
