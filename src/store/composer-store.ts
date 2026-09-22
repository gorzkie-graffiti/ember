"use client";

import { create } from "zustand";
import type { Attachment } from "@/lib/models/types";
import { getModel, getVisionModels } from "@/lib/models/catalog";
import { toast } from "sonner";
import { useModelStore } from "./model-store";

/**
 * Composer draft state: pending attachments, vision-fallback negotiation,
 * and the large-paste decision — all capability-driven.
 */
export type VisionFallbackChoice = "vision-model" | "extract-text" | "cancel";

/** Contract timeout for /api/vision (60s — see worklog, shared rules). */
const VISION_TIMEOUT_MS = 60_000;

interface ComposerStore {
  mode: "chat" | "code";
  setMode: (mode: "chat" | "code") => void;

  /** Composer textarea content (kept in the store so external inserts work) */
  draftText: string;
  setDraftText: (text: string) => void;

  draftAttachments: Attachment[];
  /** Image awaiting a vision-fallback decision (dialog open when set) */
  pendingVisionFile: Attachment | null;
  /** True while the /api/vision round-trip is in flight */
  resolvingVision: boolean;
  /** Chosen vision model for the fallback (defaults to best reliability) */
  fallbackVisionModelId: string | null;
  /** Paste content awaiting keep-as-text / paste-as-file decision */
  pendingPaste: string | null;
  /** Insert text into the composer draft from anywhere (chips, dialogs). */
  requestTextInsert: (text: string) => void;
  /** Turn the pending paste into a pasted-context.txt attachment. */
  pasteAsFile: () => void;

  /**
   * Attempt to attach files. Returns the files that were accepted or
   * flagged (vision fallback). Rejects unsupported files with a toast.
   */
  attachFiles: (files: File[]) => Promise<Attachment[]>;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  resolveVisionFallback: (
    choice: VisionFallbackChoice,
    visionModelId?: string,
  ) => Promise<void>;
  setFallbackVisionModel: (modelId: string) => void;

  setPendingPaste: (text: string | null) => void;

  reset: () => void;
}

/** Vision-capable models this deployment can currently serve. */
function getLiveVisionModels() {
  const isModelLive = useModelStore.getState().isModelLive;
  return getVisionModels().filter((m) => isModelLive(m.id));
}

/** Call POST /api/vision and return the model's result string. */
async function requestVisionResult(
  image: string | undefined,
  task: "analyze" | "ocr",
  modelId: string,
): Promise<string> {
  if (!image) throw new Error("The image data is unavailable.");
  const resp = await fetch("/api/vision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, task, modelId }),
    signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      text.trim() || `The vision request failed (${resp.status}).`,
    );
  }
  const json = (await resp.json()) as { result?: string };
  if (!json?.result) throw new Error("The vision model returned no result.");
  return json.result;
}

/** Read a File into our Attachment shape. */
async function toAttachment(file: File): Promise<Attachment> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);

  let kind: Attachment["kind"] = "text";
  if (isImage) kind = "image";
  else if (ext === "pdf") kind = "pdf";
  else if (["doc", "docx"].includes(ext)) kind = "doc";
  else if (["csv", "json"].includes(ext)) kind = "data";
  else if (["ts", "tsx", "js", "jsx", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "css", "html", "sql", "sh", "yml", "yaml", "xml"].includes(ext))
    kind = "code";

  const base: Attachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: file.name,
    size: file.size,
    mime: file.type || `application/${ext || "octet-stream"}`,
  };

  if (isImage) {
    base.dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  } else if (
    ["text", "code", "data"].includes(kind) &&
    file.size < 2 * 1024 * 1024
  ) {
    base.textContent = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).slice(0, 50_000));
      reader.onerror = () => resolve("");
      reader.readAsText(file);
    });
  }

  return base;
}

export const useComposerStore = create<ComposerStore>()((set, get) => ({
  mode: "chat",
  setMode: (mode) => {
    if (mode === "code") {
      toast.info("Code mode — cloud sandbox execution is coming soon.", {
        description: "You'll be able to run and iterate on code without leaving the chat.",
      });
    }
    set({ mode });
  },

  draftText: "",
  setDraftText: (text) => set({ draftText: text }),

  draftAttachments: [],
  pendingVisionFile: null,
  resolvingVision: false,
  fallbackVisionModelId: null,
  pendingPaste: null,

  requestTextInsert: (text) =>
    set((s) => ({
      draftText: s.draftText ? `${s.draftText}\n${text}` : text,
    })),

  pasteAsFile: () => {
    const text = get().pendingPaste;
    if (!text) return;
    const attachment: Attachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "text",
      name: "pasted-context.txt",
      size: new Blob([text]).size,
      mime: "text/plain",
      textContent: text,
    };
    set((s) => ({
      pendingPaste: null,
      draftAttachments: [...s.draftAttachments, attachment],
    }));
    toast.success("pasted-context.txt attached", {
      description: "Your paste is now a file — it will also appear in Artifacts once sent.",
    });
  },

  attachFiles: async (files) => {
    const selectedModelId = useModelStore.getState().selectedModelId;
    const model = getModel(selectedModelId);
    if (!model) return [];

    const accepted: Attachment[] = [];

    for (const file of files) {
      const attachment = await toAttachment(file);

      if (attachment.kind === "image" && !model.capabilities.vision) {
        const liveVisionModels = getLiveVisionModels();
        if (liveVisionModels.length === 0) {
          // No connected vision provider — fail honestly instead of
          // opening a dialog that could not analyze anything.
          toast.error("No vision model is connected", {
            description:
              "Image analysis needs a vision-capable provider key (e.g. G4F_API_KEY for Gemini Flash) in .env. The image is attached without analysis.",
          });
          accepted.push(attachment);
          continue;
        }
        // Vision fallback — hold the file and let the dialog decide.
        set({
          pendingVisionFile: attachment,
          fallbackVisionModelId:
            get().fallbackVisionModelId &&
            liveVisionModels.some((m) => m.id === get().fallbackVisionModelId)
              ? get().fallbackVisionModelId
              : liveVisionModels[0].id,
        });
        continue;
      }

      if (attachment.kind !== "image" && !model.capabilities.files) {
        toast.error(`This model can't process files`, {
          description: `${model.displayName} doesn't support file attachments. Attach an image instead, or switch to a file-capable model.`,
        });
        continue;
      }

      accepted.push(attachment);
    }

    if (accepted.length > 0) {
      set((s) => ({ draftAttachments: [...s.draftAttachments, ...accepted] }));
    }
    return accepted;
  },

  removeAttachment: (id) =>
    set((s) => ({
      draftAttachments: s.draftAttachments.filter((a) => a.id !== id),
    })),

  clearAttachments: () => set({ draftAttachments: [] }),

  resolveVisionFallback: async (choice, visionModelId) => {
    const pending = get().pendingVisionFile;
    if (!pending) return;

    if (choice === "cancel") {
      set({ pendingVisionFile: null });
      return;
    }

    set({ resolvingVision: true });
    try {
      if (choice === "vision-model") {
        const liveVisionModels = getLiveVisionModels();
        const visionModelIdResolved =
          visionModelId ??
          get().fallbackVisionModelId ??
          liveVisionModels[0]?.id;
        const visionModel = visionModelIdResolved
          ? getModel(visionModelIdResolved)
          : undefined;
        if (!visionModel) {
          toast.error("No vision model available");
          set({ pendingVisionFile: null });
          return;
        }
        const result = await requestVisionResult(
          pending.dataUrl,
          "analyze",
          visionModel.id,
        );
        const analyzed: Attachment = {
          ...pending,
          visionAnalysis: {
            viaModelId: visionModel.id,
            viaModelName: visionModel.displayName,
            result,
          },
        };
        set((s) => ({
          pendingVisionFile: null,
          draftAttachments: [...s.draftAttachments, analyzed],
        }));
        toast.success(`Image routed through ${visionModel.displayName}`, {
          description: "The vision model's analysis will be passed to your selected model.",
        });
        return;
      }

      // extract-text
      const liveVisionModels = getLiveVisionModels();
      const ocrModelId =
        get().fallbackVisionModelId ?? liveVisionModels[0]?.id;
      if (!ocrModelId) {
        toast.error("No vision model available");
        set({ pendingVisionFile: null });
        return;
      }
      const result = await requestVisionResult(pending.dataUrl, "ocr", ocrModelId);
      const extracted: Attachment = {
        ...pending,
        extractedText: result,
      };
      set((s) => ({
        pendingVisionFile: null,
        draftAttachments: [...s.draftAttachments, extracted],
      }));
      toast.success("Text extracted from image", {
        description: "The extracted text will be passed to your selected model.",
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "The vision request failed.";
      toast.error("Couldn't process the image", {
        description: `${message} The image is attached without analysis.`,
      });
      // Keep the user's file — attach it without any analysis result.
      set((s) => ({
        pendingVisionFile: null,
        draftAttachments: [...s.draftAttachments, pending],
      }));
    } finally {
      set({ resolvingVision: false });
    }
  },

  setFallbackVisionModel: (modelId) =>
    set({ fallbackVisionModelId: modelId }),

  setPendingPaste: (text) => set({ pendingPaste: text }),

  reset: () =>
    set({
      mode: "chat",
      draftText: "",
      draftAttachments: [],
      pendingVisionFile: null,
      pendingPaste: null,
    }),
}));
