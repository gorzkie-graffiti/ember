#!/usr/bin/env node
/**
 * One-off import of the system_prompts_leaks collection into the app's
 * prompt library (sys_prompts/prompts.json).
 *
 * Inclusion rules:
 * - .md files only (the collection has no .txt), excluding READMEs, the
 *   Anthropic claude-api SDK docs (developer documentation, not prompts),
 *   and multi-hundred-KB aggregate dump files.
 * - output-styles/** → type "style"; everything else → "system-prompt".
 * - origin is always "leaked".
 * - Name from YAML frontmatter (name:) or the filename.
 * - Content: YAML frontmatter stripped, but the description/whenToUse lines
 *   are kept when the body is thin (skills/agents use them as the meat).
 * - Dedupe by normalized full text AND by exact name (first wins).
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const LEAKS = join(ROOT, "system_prompts_leaks");
const OUT = join(ROOT, "sys_prompts", "prompts.json");
const MAX_TEXT = 600_000;
const MIN_BODY = 40; // chars of real prose needed under the frontmatter
/** Real prompts cap out around 550KB (gpt-6-astra); the true dump (all.md) is
 *  a concatenation of dated files — skip it by exact name, not by size. */
const MAX_BYTES = 600_000;
const SKIP_FILES = new Set(["all.md"]);

const EXCLUDED_DIRS = [
  join(LEAKS, ".git"),
  join(LEAKS, "assets"),
  join(LEAKS, "Anthropic", "claude-code", "skills", "claude-api"), // SDK docs
];

function walk(dir, out = []) {
  if (EXCLUDED_DIRS.some((ex) => dir === ex || dir.startsWith(ex + "/"))) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") out.push(p);
  }
  return out;
}

function stripFrontmatter(content) {
  if (!content.startsWith("---")) return { body: content, meta: {}, metaText: "" };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { body: content, meta: {}, metaText: "" };
  const metaBlock = content.slice(4, end);
  const body = content.slice(end + 4).replace(/^\s*\n/, "");
  const meta = {};
  for (const line of metaBlock.split("\n")) {
    const m = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^['"]|['"]$/, "");
  }
  return { body, meta, metaText: metaBlock };
}

/** Content heuristics to skip repo READMEs / changelogs / non-prompt docs. */
function looksLikePrompt(body, rel, bytes) {
  if (bytes > MAX_BYTES) return false;
  if (bytes < 200) return false;
  const lower = rel.toLowerCase();
  if (lower.endsWith("readme.md")) return false;
  if (SKIP_FILES.has(lower.split("/").pop())) return false;
  if (/prompt|style|agent|command|skill|persona|reminder|instruction|grok|gemini|gpt|claude|codex|copilot|deepseek|qwen|glm|kimi|mistral|notion|perplexity|cursor|opencode|amp|devin|poe|character|voice|browser|docker|excel|word|chrome|mobile|desktop|fable|opus|sonnet|haiku|o3|o4|astra|antigravity|build|interview|translate|writing|design|guide|nudge|advice|concise|explanatory|learning|proactive|search|vibe|review|auto|computer|control|account|bot|expert|api|logic|empathetic|personality|harmony|safeguard|think|beanie|no-tools|text-only/.test(lower)) return true;
  return false;
}

function main() {
  if (!existsSync(LEAKS)) {
    console.error("system_prompts_leaks/ not found");
    process.exit(1);
  }

  const existing = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : { version: 1, activeSystemPromptId: null, activeInstructionsId: null, prompts: [] };

  const seenText = new Set(
    existing.prompts.map((p) => p.text.replace(/\s+/g, " ").trim().toLowerCase()),
  );
  const seenName = new Set(existing.prompts.map((p) => p.name.toLowerCase()));

  const files = walk(LEAKS);
  let imported = 0;
  let skippedDup = 0;
  let skippedNoise = 0;
  const now = Date.now();

  for (const file of files) {
    const rel = relative(LEAKS, file).replaceAll("\\", "/");
    const bytes = statSync(file).size;
    const raw = readFileSync(file, "utf8");
    const { body, meta, metaText } = stripFrontmatter(raw);

    if (!looksLikePrompt(body, rel, bytes)) {
      skippedNoise += 1;
      continue;
    }

    // Skills/agents often carry their substance in the frontmatter
    // description — keep it, labeled, when the body alone is thin.
    let text = body.trim();
    if (text.length < MIN_BODY && metaText.trim()) {
      text = `[From metadata] ${metaText.trim()}\n\n${text}`;
    }
    if (!text || text.length < MIN_BODY) {
      skippedNoise += 1;
 continue;
    }
    text = text.slice(0, MAX_TEXT);

    const key = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (seenText.has(key)) {
      skippedDup += 1;
      continue;
    }

    const base = meta.name || rel.replace(/\.md$/i, "").split("/").pop();
    const vendor = rel.split("/")[0];
    const name = `${vendor} · ${base}`.slice(0, 80);
    if (seenName.has(name.toLowerCase())) continue;

    const isStyle = rel.includes("output-styles") || meta.name === "Explanatory";

    existing.prompts.push({
      id: `leak-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: isStyle ? "style" : "system-prompt",
      origin: "leaked",
      text,
      createdAt: now,
      updatedAt: now,
    });
    seenText.add(key);
    seenName.add(name.toLowerCase());
    imported += 1;
  }

  existing.version = 1;
  writeFileSync(OUT, JSON.stringify(existing, null, 2) + "\n");
  console.log(
    `imported ${imported} · skipped ${skippedNoise} noise · ${skippedDup} dupes · total ${existing.prompts.length}`,
  );
}

main();
