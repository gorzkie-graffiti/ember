/** Prototype-wide tunable constants. */

/** Paste size (in characters) above which the "large paste" dialog appears. */
export const LARGE_PASTE_THRESHOLD = 20_000;

/** Mocked file-size soft limit for uploads (display only in this prototype). */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/** File extensions accepted by the composer's + menu. */
export const ACCEPTED_FILE_TYPES: Record<string, string> = {
  pdf: "pdf",
  txt: "text",
  md: "text",
  markdown: "text",
  csv: "data",
  json: "data",
  docx: "doc",
  doc: "doc",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  ts: "code",
  tsx: "code",
  js: "code",
  jsx: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  c: "code",
  cpp: "code",
  h: "code",
  css: "code",
  html: "code",
  sql: "code",
  sh: "code",
  yml: "code",
  yaml: "code",
  xml: "code",
  log: "text",
};

/** Rough char count used when a file has no readable text content. */
export const ESTIMATED_CHARS_PER_KB = 1200;

/* ------------------------------------------------------------------ */
/* Prompt groups — proper names for prompt collections                */
/* ------------------------------------------------------------------ */

/**
 * A collection of prompts imported together (a "version" of the prompt
 * library, or a model family like the Grok personas).
 */
export interface PromptGroupMeta {
  key: string;
  /** Display name shown in the picker (e.g. "Grok 4.6 — Personas"). */
  label: string;
  /** One-line description shown as a sub-label. */
  description: string;
}

/** Proper display names for every prompt group, keyed by `PromptDoc.group`. */
export const PROMPT_GROUPS: Record<string, PromptGroupMeta> = {
  v0: {
    key: "v0",
    label: "V0 — Baseline",
    description: "Original prompts, exactly as captured",
  },
  v1: {
    key: "v1",
    label: "V1 — Unaligned",
    description: "Safety-preamble removed, responses unrestricted",
  },
  "v2-code": {
    key: "v2-code",
    label: "V2 · Code",
    description: "Senior-engineer pairing, blunt and technical",
  },
  "v2-writing": {
    key: "v2-writing",
    label: "V2 · Writing",
    description: "Fiction and creative craft without sanitizing",
  },
  "v2-roleplay": {
    key: "v2-roleplay",
    label: "V2 · Roleplay",
    description: "Immersive characters, stays in scene",
  },
  "v2-presentations": {
    key: "v2-presentations",
    label: "V2 · Presentations",
    description: "Decks and rhetoric — punchy over hedged",
  },
  "v2-research": {
    key: "v2-research",
    label: "V2 · Research",
    description: "Analyst mode — contested topics, quantified uncertainty",
  },
  "v2-scenario": {
    key: "v2-scenario",
    label: "V2 · Scenario",
    description: "Simulations and thought experiments, played honestly",
  },
  "v2-critique": {
    key: "v2-critique",
    label: "V2 · Critique",
    description: "Ruthless editor — biggest problem first",
  },
  "v2-debate": {
    key: "v2-debate",
    label: "V2 · Debate",
    description: "Steelman partner — strongest case, no folding",
  },
};

/** Fallback for a group key with no meta (shouldn't happen). */
export function promptGroupMeta(group?: string | null): PromptGroupMeta | null {
  if (!group) return null;
  return PROMPT_GROUPS[group] ?? { key: group, label: group, description: "" };
}

/**
 * Grok persona style names, in file order. Used by the import script to
 * split `grok-personas.md` into one style doc per persona.
 */
export const GROK_PERSONA_NAMES = [
  "Companion",
  "Unhinged Comedian",
  "Loyal Friend",
  "Homework Helper",
  "Not a Doctor",
  "Not a Therapist",
] as const;

export const USER_PROFILE = {
  name: "Krystian",
  initials: "K",
  plan: "Free",
};
