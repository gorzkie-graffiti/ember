import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PromptDoc, PromptOrigin, PromptType } from "@/lib/models/types";

/**
 * File-backed store for System Prompts & Styles.
 *
 * Documents live in `sys_prompts/prompts.json` at the project root — the
 * same directory doubles as the management surface for `sys_prompts/cli.mjs`,
 * so the server and the CLI always see the same file.
 */

export const SYS_PROMPTS_DIR = "sys_prompts";
const PROMPTS_FILE = join(process.cwd(), SYS_PROMPTS_DIR, "prompts.json");
/** Storage cap — some leaked production prompts are 500KB+ (gpt-6-astra). */
export const MAX_PROMPT_TEXT = 600_000;
/** Injection guard: longest prompt text actually sent to a model per request. */
export const MAX_PROMPT_INJECTION = 24_000;
/** The leaked-prompt library imports hundreds of docs. */
export const MAX_PROMPTS = 500;

export interface PromptsFile {
  version: 1;
  /** Which doc is the active System Prompt (replaces the built-in one). */
  activeSystemPromptId: string | null;
  /** Which doc is injected as User Instructions (styles allowed). */
  activeInstructionsId: string | null;
  prompts: PromptDoc[];
}

const DEFAULT_FILE: PromptsFile = {
  version: 1,
  activeSystemPromptId: null,
  activeInstructionsId: null,
  prompts: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate + sanitize a client/CLI-supplied doc. Returns null when invalid. */
export function sanitizePromptDoc(raw: unknown): PromptDoc | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== "string" && typeof raw.id !== "string") return null;

  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : "";
  const type: PromptType = raw.type === "style" ? "style" : "system-prompt";
  const origin: PromptOrigin = raw.origin === "leaked" ? "leaked" : "user";
  const text =
    typeof raw.text === "string" ? raw.text.slice(0, MAX_PROMPT_TEXT) : "";
  const group =
    typeof raw.group === "string" && raw.group.trim()
      ? raw.group.trim().slice(0, 80)
      : null;

  if (!name && !raw.id) return null;

  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim().slice(0, 80)
        : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || (typeof raw.id === "string" ? raw.id : "Untitled"),
    type,
    origin,
    text,
    group,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

export function loadPromptsFile(): PromptsFile {
  if (!existsSync(PROMPTS_FILE)) {
    mkdirSync(join(process.cwd(), SYS_PROMPTS_DIR), { recursive: true });
    writeFileSync(PROMPTS_FILE, JSON.stringify(DEFAULT_FILE, null, 2) + "\n");
    return { ...DEFAULT_FILE, prompts: [] };
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(PROMPTS_FILE, "utf8"));
    if (!isRecord(parsed)) return { ...DEFAULT_FILE, prompts: [] };
    const prompts = Array.isArray(parsed.prompts)
      ? parsed.prompts
          .map(sanitizePromptDoc)
          .filter((p): p is PromptDoc => p !== null)
          .slice(0, MAX_PROMPTS)
      : [];
    return {
      version: 1,
      activeSystemPromptId:
        typeof parsed.activeSystemPromptId === "string"
          ? parsed.activeSystemPromptId
          : null,
      activeInstructionsId:
        typeof parsed.activeInstructionsId === "string"
          ? parsed.activeInstructionsId
          : null,
      prompts,
    };
  } catch (err) {
    console.error("[sys_prompts] failed to parse prompts.json:", err);
    return { ...DEFAULT_FILE, prompts: [] };
  }
}

export function savePromptsFile(file: PromptsFile): void {
  mkdirSync(join(process.cwd(), SYS_PROMPTS_DIR), { recursive: true });
  const tmp = `${PROMPTS_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n");
  writeFileSync(PROMPTS_FILE, JSON.stringify(file, null, 2) + "\n");
}

export function getPromptDoc(id: string): PromptDoc | null {
  return loadPromptsFile().prompts.find((p) => p.id === id) ?? null;
}
