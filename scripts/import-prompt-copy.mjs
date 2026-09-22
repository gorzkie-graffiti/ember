#!/usr/bin/env node
/**
 * Imports the curated prompt library in `sys_prompts_copy/` into
 * `sys_prompts/prompts.json` (the file the app + CLI read).
 *
 * Layout:
 *   sys_prompts_copy/v0/*.md           → group "v0"
 *   sys_prompts_copy/v1/*.md           → group "v1"
 *   sys_prompts_copy/v2/V2-<X>/*.md    → group "v2-<x>"
 *
 * Multi-style files are split into separate docs (one per style):
 *   default-styles.md  → Learning / Concise / Explanatory / Formal
 *   grok-personas.md   → Companion / Unhinged Comedian / Loyal Friend /
 *                        Homework Helper / Not a Doctor / Not a Therapist
 *
 * Every doc gets a proper display name and a `group` key resolved against
 * PROMPT_GROUPS in src/lib/constants.ts.
 *
 * Usage:  node scripts/import-prompt-copy.mjs [--fresh]
 *   --fresh   wipe existing prompts first (default: keep existing docs,
 *             deduped by id)
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "sys_prompts_copy");
const OUT = join(ROOT, "sys_prompts", "prompts.json");

/* ---------------------------------------------------------------- */
/* Version + folder → proper names                                   */
/* ---------------------------------------------------------------- */

const VERSION_META = [
  {
    dir: "v0",
    group: "v0",
    label: "V0 — Baseline",
    description: "Original prompts, exactly as captured",
  },
  {
    dir: "v1",
    group: "v1",
    label: "V1 — Unaligned",
    description: "Safety-preamble removed, responses unrestricted",
  },
];

/** v2 category folders → proper names. Order = display order in the picker. */
const V2_CATEGORIES = [
  { dir: "V2-CODE", key: "v2-code", label: "V2 · Code", description: "Senior-engineer pairing — blunt, technical, working code over prose" },
  { dir: "V2-WRITING", key: "v2-writing", label: "V2 · Writing", description: "Fiction and creative craft — darkness is legitimate craft" },
  { dir: "V2-ROLEPLAY", key: "v2-roleplay", label: "V2 · Roleplay", description: "Immersive characters — stays in scene, no OOC narration" },
  { dir: "V2-PRESENTATIONS", key: "v2-presentations", label: "V2 · Presentations", description: "Decks and rhetoric — punchy over hedged" },
  { dir: "V2-RESEARCH", key: "v2-research", label: "V2 · Research", description: "Analyst mode — contested topics, quantified uncertainty" },
  { dir: "V2-SCENARIO", key: "v2-scenario", label: "V2 · Scenario", description: "Simulations played honestly — no pausing to moralize" },
  { dir: "V2-CRITIQUE", key: "v2-critique", label: "V2 · Critique", description: "Ruthless editor — biggest problem first" },
  { dir: "V2-DEBATE", key: "v2-debate", label: "V2 · Debate", description: "Steelman partner — strongest case, never folds" },
];

/** Per-file proper names: file → display name. */
const FILE_NAMES = {
  "chatgpt-cynical.md": "ChatGPT — Cynical",
  "claude-fable-5.1.md": "Claude Fable 5.1",
  "claude-opus-5.md": "Claude Opus 5",
  "claude-sonnet-5.md": "Claude Sonnet 5",
  "deepseek-chat.md": "DeepSeek Chat",
  "gemini-3.1-pro.md": "Gemini 3.1 Pro",
  "gemini-3.8-flash.md": "Gemini 3.8 Flash",
  "gpt-5.6-sol.md": "GPT-5.6 Sol",
  "grok-4.6.md": "Grok 4.6",
  "kimi-3.md": "Kimi 3",
  "muse-spark-1.1.md": "Muse Spark 1.1 (Meta AI)",
};

/** Proper names for the styles split out of default-styles.md. */
const CLAUDE_STYLE_NAMES = {
  learning: "Claude — Learning",
  concise: "Claude — Concise",
  explanatory: "Claude — Explanatory",
  formal: "Claude — Formal",
};

/** Proper names for the styles split out of grok-personas.md (file order). */
const GROK_PERSONA_NAMES = [
  "Grok — Companion",
  "Grok — Unhinged Comedian",
  "Grok — Loyal Friend",
  "Grok — Homework Helper",
  "Grok — Not a Doctor",
  "Grok — Not a Therapist",
];

/** Header patterns used to split the multi-style files. */
const CLAUDE_STYLE_HEADER = /^## /;
const GROK_PERSONA_HEADER = /^# /;

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

/** Split default-styles.md at `## ` headers. Returns [{ key, name, text }]. */
function splitClaudeStyles(content) {
  const sections = [];
  let current = null;
  for (const line of content.split("\n")) {
    if (CLAUDE_STYLE_HEADER.test(line)) {
      if (current) sections.push(current);
      const title = line.replace(/^##+\s*/, "").trim();
      const key = title.toLowerCase().replace(/[^a-z]+/g, "-");
      current = {
        key,
        name: CLAUDE_STYLE_NAMES[key] ?? `Claude — ${title}`,
        text: "",
      };
    } else if (current) {
      current.text += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections.filter((s) => s.text.trim());
}

/** Split grok-personas.md at `# ` headers. Returns [{ name, text }]. */
function splitGrokPersonas(content) {
  const sections = [];
  let current = null;
  for (const line of content.split("\n")) {
    if (GROK_PERSONA_HEADER.test(line)) {
      if (current) sections.push(current);
      // strip leading emoji from titles like "❤️ Companion"
      const clean = line
        .replace(/^#+\s*/, "")
        .replace(/^[^\p{L}\p{N}]+/u, "")
        .trim();
      const expected = GROK_PERSONA_NAMES[sections.length];
      current = { name: expected ?? `Grok — ${clean}`, text: "" };
    } else if (current) {
      current.text += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections.filter((s) => s.text.trim());
}

function titleize(base) {
  return base
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* ---------------------------------------------------------------- */
/* Main                                                              */
/* ---------------------------------------------------------------- */

function main() {
  const fresh = process.argv.includes("--fresh");
  const now = Date.now();

  let file;
  if (existsSync(OUT)) {
    try {
      file = JSON.parse(readFileSync(OUT, "utf8"));
    } catch {
      file = null;
    }
  }
  if (!file || typeof file !== "object") {
    file = { version: 1, activeSystemPromptId: null, activeInstructionsId: null, prompts: [] };
  }
  if (!Array.isArray(file.prompts)) file.prompts = [];

  if (fresh) {
    file.prompts = [];
    file.activeSystemPromptId = null;
    file.activeInstructionsId = null;
  }

  // Drop docs previously imported from sys_prompts_copy so reruns are clean.
  const before = file.prompts.length;
  file.prompts = file.prompts.filter(
    (p) => !String(p?.id ?? "").startsWith("lib-"),
  );
  const dropped = before - file.prompts.length;

  const seenIds = new Set(file.prompts.map((p) => p.id));
  const out = [];
  let imported = 0;
  let splitStyles = 0;

  const versions = [
    ...VERSION_META,
    ...V2_CATEGORIES.map((c) => ({
      dir: join("v2", c.dir),
      group: c.key,
      label: c.label,
    })),
  ];

  for (const v of versions) {
    const dir = join(SOURCE, v.dir);
    if (!existsSync(dir)) {
      console.error(`  ! missing dir: ${v.dir}`);
      continue;
    }
    const files = readdirSync(dir).filter((n) => n.endsWith(".md")).sort();
    for (const f of files) {
      const base = f.replace(/\.md$/, "");
      const raw = readFileSync(join(dir, f), "utf8");
      let docs = [];
      let type = "system-prompt";

      if (base === "default-styles") {
        type = "style";
        docs = splitClaudeStyles(raw).map((s, i) => ({
          name: s.name,
          text: s.text.trim() + "\n",
          idSuffix: `claude-style-${i + 1}`,
        }));
        splitStyles += docs.length;
      } else if (base === "grok-personas") {
        type = "style";
        docs = splitGrokPersonas(raw).map((s, i) => ({
          name: s.name,
          text: s.text.trim() + "\n",
          idSuffix: `grok-persona-${i + 1}`,
        }));
        splitStyles += docs.length;
      } else {
        docs = [
          {
            name: FILE_NAMES[f] ?? titleize(base),
            text: raw.trim() + "\n",
            idSuffix: base,
          },
        ];
      }

      for (const d of docs) {
        const id = `lib-${v.group}-${d.idSuffix}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        out.push({
          id,
          name: d.name,
          type,
          origin: "leaked",
          group: v.group,
          text: d.text,
          createdAt: now,
          updatedAt: now,
          _source: `sys_prompts_copy/${v.dir}/${f}`,
        });
        imported++;
      }
    }
  }

  file.prompts.push(...out);
  file.version = 1;
  mkdirSync(dirname(OUT), { recursive: true });

  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n");
  writeFileSync(OUT, JSON.stringify(file, null, 2) + "\n");

  const styles = file.prompts.filter((p) => p.type === "style").length;
  console.log(
    `imported ${imported} docs (${splitStyles} via style-split) · ` +
      `${dropped} stale lib- docs dropped · ` +
      `${file.prompts.length} total (${styles} styles)`,
  );
}

main();
