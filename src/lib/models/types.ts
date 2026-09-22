/**
 * Core domain types for the capability-driven model system.
 *
 * The golden rule: UI never special-cases specific models.
 * Everything (model picker, composer controls, attachments, fallbacks,
 * validation) is derived from `ModelCapabilities`.
 */

/**
 * Known providers in the catalog. Only a subset is actually wired to this
 * deployment's backend — see `ModelInfo.connected` for the per-model flag.
 */
export type ProviderId =
  | "cohere"
  | "groq"
  | "g4f"
  | "nvidia"
  | "openrouter";

export type EffortLevel = "low" | "medium" | "high" | "max";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  logo: string;
  /** Brand accent color — exposed as configuration, never hardcoded in components */
  accent: string;
  tagline: string;
}

/** Capabilities that drive every UI decision about a model. */
export interface ModelCapabilities {
  /** Can accept and reason about images */
  vision: boolean;
  /** Can process file attachments (pdf, txt, docx, ...) */
  files: boolean;
  /** Supports the Thinking toggle */
  thinking: boolean;
  /** Thinking cannot be disabled (reasoning-only model) */
  reasoningRequired: boolean;
  /** Supported effort levels — empty array hides the Effort control entirely */
  effortLevels: EffortLevel[];
  audioInput: boolean;
  audioOutput: boolean;
  /**
   * Whether this model can serve as a conversational chat model.
   * Non-chat models (embeddings, rerankers, whisper, ...) stay in the
   * provider catalog / data layer but never appear in the chat picker.
   */
  chatCompatible: boolean;
}

export interface ModelInfo {
  /** Unique across providers: `${provider}/${slug}` */
  id: string;
  provider: ProviderId;
  displayName: string;
  aliases: string[];
  /** Short, strength-focused description */
  description: string;
  /** Reliability score (0–100) */
  reliability: number;
  /** Average first-token latency in ms */
  avgLatencyMs: number;
  contextWindow: string;
  /**
   * Whether this deployment's backend can actually serve the model.
   * true  = live: generation requests are sent to the real backend.
   * false = catalog-only: the model is listed in the picker for
   *         transparency, but is not selectable and never generates —
   *         the backend has no provider key for it yet.
   *
   * Note: static baseline only. At runtime the provider's API key
   * (see `.env`) overrides this via `/api/providers` — a provider whose
   * key is present lights up all of its models automatically.
   */
  connected: boolean;
  /**
   * Model id sent to the provider's upstream API. Defaults to the catalog
   * id minus its `provider/` prefix; set explicitly when the upstream slug
   * diverges (e.g. namespaced ids like `nvidia/deepseek-ai/…`).
   */
  upstreamModel?: string;
  /**
   * Small user-facing side note shown in the picker/detail UI (e.g. "This
   * model may leak its CoT in responses"). Optional — most models have none.
   */
  caveat?: string;
  capabilities: ModelCapabilities;
}

export type RecommendationCategory =
  | "toughest"
  | "complex"
  | "everyday"
  | "fastest";

export interface RecommendedModel {
  category: RecommendationCategory;
  modelId: string;
}

/* ------------------------------------------------------------------ */
/* Attachments & artifacts                                            */
/* ------------------------------------------------------------------ */

export type AttachmentKind = "image" | "pdf" | "text" | "code" | "data" | "doc";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  size: number;
  mime: string;
  /** Text content for text-ish files */
  textContent?: string;
  /** Data URL for images */
  dataUrl?: string;
  /**
   * Set when a non-vision model routes the image through a vision model
   * (vision fallback) — contains the vision model's analysis result.
   */
  visionAnalysis?: { viaModelId: string; viaModelName: string; result: string };
  /** Set when "Extract text only" was chosen in the vision fallback */
  extractedText?: string;
}

export type ArtifactOrigin = "user" | "agent";

export interface Artifact {
  id: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  origin: ArtifactOrigin;
  conversationId?: string;
  conversationTitle?: string;
  mime: string;
  textContent?: string;
  dataUrl?: string;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* Conversations & messages                                           */
/* ------------------------------------------------------------------ */

export type MessageStatus =
  | "pending"
  | "thinking"
  | "streaming"
  | "done"
  | "error"
  | "stopped";

export interface ToolActivity {
  id: string;
  tool: "web_search" | "web_fetch";
  input: string;
  status: "running" | "done" | "error";
  resultSummary?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Reasoning trace shown when Thinking is enabled */
  thinking?: string;
  attachments?: Attachment[];
  /** Web search / web fetch tool calls executed while building response */
  toolActivities?: ToolActivity[];
  status: MessageStatus;
  error?: string;
  modelId?: string;
  modelDisplayName?: string;
  /** How many persistent-memory entries were consulted for this answer */
  memoryEntriesUsed?: number;
  /** Vision models that analyzed attachments on behalf of the chat model */
  routedThrough?: string[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  incognito: boolean;
  modelId: string;
  effort: EffortLevel;
  thinkingEnabled: boolean;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Memory                                                             */
/* ------------------------------------------------------------------ */

export type MemoryCategory =
  | "work-role"
  | "preferences"
  | "technical"
  | "projects"
  | "people";

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  content: string;
  source: "user" | "auto";
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Settings — System Prompts & Styles                                  */
/* ------------------------------------------------------------------ */

/** A reusable system prompt or style guide managed in Settings. */
export type PromptType = "system-prompt" | "style";
/** "leaked" = captured from another product; "user" = authored here. */
export type PromptOrigin = "leaked" | "user";

export interface PromptDoc {
  id: string;
  name: string;
  type: PromptType;
  origin: PromptOrigin;
  text: string;
  /**
   * Optional collection label grouping related docs in the picker
   * (e.g. "Grok 4.6" groups the Grok persona styles). Null = ungrouped.
   */
  group?: string | null;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */

export interface Project {
  id: string;
  name: string;
  description: string;
  chatCount: number;
  fileCount: number;
  memoryCount: number;
  color: string;
}
