#!/usr/bin/env node
/**
 * Ember — System Prompt & Style manager (CLI)
 *
 * Manages sys_prompts/prompts.json directly — the same file the app's
 * Settings view and /api/prompts read, so changes are live instantly.
 *
 * Usage:
 *   node sys_prompts/cli.mjs list
 *   node sys_prompts/cli.mjs add "My prompt" --type prompt|style --from user|leaked
 *                            [--file prompt.md|prompt.txt | --text "…"]
 *   node sys_prompts/cli.mjs edit <id> [--name …] [--text … | --file …]
 *   node sys_prompts/cli.mjs show <id>
 *   node sys_prompts/cli.mjs delete <id>
 *   node sys_prompts/cli.mjs use <id> --slot system|instructions   (toggle on/off)
 *   node sys_prompts/cli.mjs rename <id> "New name"
 *
 * Text must come from --file (only .md / .txt allowed) or --text.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "prompts.json");
const MAX_TEXT = 600_000;
const MAX_PROMPTS = 500;

/* ------------------------------ helpers ------------------------------ */

function die(msg, usage = "") {
  console.error(`✗ ${msg}${usage ? `\n\n${usage}` : ""}`);
  process.exit(1);
}

function load() {
  if (!existsSync(FILE)) {
    mkdirSync(__dirname, { recursive: true });
    writeFileSync(
      FILE,
      JSON.stringify(
        { version: 1, activeSystemPromptId: null, activeInstructionsId: null, prompts: [] },
        null,
        2,
      ) + "\n",
    );
    return { version: 1, activeSystemPromptId: null, activeInstructionsId: null, prompts: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    return {
      version: 1,
      activeSystemPromptId: typeof parsed.activeSystemPromptId === "string" ? parsed.activeSystemPromptId : null,
      activeInstructionsId: typeof parsed.activeInstructionsId === "string" ? parsed.activeInstructionsId : null,
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
    };
  } catch (err) {
    die(`prompts.json is not valid JSON: ${err.message}`);
  }
}

function save(data) {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `p-${Date.now()}`
  );
}

function readTextFromArgs(args) {
  const fileFlag = args.indexOf("--file");
  const textFlag = args.indexOf("--text");
  if (fileFlag !== -1 && textFlag !== -1) {
    die("Use either --file or --text, not both.");
  }
  if (fileFlag !== -1) {
    const path = args[fileFlag + 1];
    if (!path) die("--file requires a path.");
    const abs = resolve(path);
    const ext = extname(abs).toLowerCase();
    if (ext !== ".md" && ext !== ".txt") {
      die(`Only .md or .txt files are allowed (got "${extname(abs) || basename(abs)}").`);
    }
    if (!existsSync(abs)) die(`File not found: ${abs}`);
    return readFileSync(abs, "utf8").slice(0, MAX_TEXT);
  }
  if (textFlag !== -1) {
    const text = args[textFlag + 1];
    if (!text) die("--text requires a value.");
    return text.slice(0, MAX_TEXT);
  }
  return null;
}

const USAGE = `Usage:
  node sys_prompts/cli.mjs list
  node sys_prompts/cli.mjs add "Name" --type prompt|style --from user|leaked (--file f.md | --text "…")
  node sys_prompts/cli.mjs edit <id> [--name "…"] [--file f.md | --text "…"]
  node sys_prompts/cli.mjs show <id>
  node sys_prompts/cli.mjs delete <id>
  node sys_prompts/cli.mjs use <id> --slot system|instructions
  node sys_prompts/cli.mjs rename <id> "New name"`;

/* -------------------------------- commands --------------------------- */

const [cmd, ...rest] = process.argv.slice(2);
const data = load();

switch (cmd) {
  case "list": {
    if (data.prompts.length === 0) {
      console.log("No prompts or styles yet. Try: add \"My prompt\" --type prompt --text \"…\"");
      break;
    }
    const rows = data.prompts.map((p) => {
      const sys = data.activeSystemPromptId === p.id ? " ★system" : "";
      const instr = data.activeInstructionsId === p.id ? " ★instructions" : "";
      const scope = [sys, instr].join("").trim() || "—";
      return {
        id: p.id,
        NAME: p.name,
        TYPE: p.type === "style" ? "style" : "prompt",
        FROM: p.origin,
        CHARS: p.text.length,
        ACTIVE: scope,
      };
    });
    console.table(rows);
    break;
  }

  case "add": {
    const name = rest[0];
    if (!name) die('Missing name. Example: add "My first prompt" --type prompt --text "…"', USAGE);
    const type = args_get(rest, "--type") ?? "prompt";
    if (type !== "prompt" && type !== "style") die('--type must be "prompt" or "style".');
    const origin = args_get(rest, "--from") ?? "user";
    if (origin !== "user" && origin !== "leaked") die('--from must be "user" or "leaked".');
    const text = readTextFromArgs(rest);
    if (text === null) die("Provide the text via --file f.md/.txt or --text \"…\".", USAGE);
    if (!text.trim()) die("Text is empty.");

    const now = Date.now();
    const id = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    data.prompts.push({
      id,
      name: name.trim().slice(0, 80),
      type: type === "style" ? "style" : "system-prompt",
      origin: origin === "leaked" ? "leaked" : "user",
      text,
      createdAt: now,
      updatedAt: now,
    });
    save(data);
    console.log(`✓ added "${name}" (${id})`);
    break;
  }

  case "edit": {
    const id = rest[0];
    const doc = data.prompts.find((p) => p.id === id);
    if (!doc) die(`No prompt with id "${id}". Run "list" to see ids.`);
    const name = args_get(rest, "--name");
    const text = readTextFromArgs(rest);
    if (name) doc.name = name.trim().slice(0, 80);
    if (text !== null) doc.text = text;
    doc.updatedAt = Date.now();
    save(data);
    console.log(`✓ updated "${doc.name}" (${doc.id})`);
    break;
  }

  case "show": {
    const doc = data.prompts.find((p) => p.id === rest[0]);
    if (!doc) die(`No prompt with id "${rest[0]}".`);
    console.log(
      [
        `id:      ${doc.id}`,
        `name:    ${doc.name}`,
        `type:    ${doc.type}`,
        `from:    ${doc.origin}`,
        `active:  ${[data.activeSystemPromptId === doc.id ? "system" : null, data.activeInstructionsId === doc.id ? "instructions" : null].filter(Boolean).join(", ") || "—"}`,
        `updated: ${new Date(doc.updatedAt).toISOString()}`,
        "",
        "─".repeat(60),
        doc.text,
      ].join("\n"),
    );
    break;
  }

  case "delete": {
    const idx = data.prompts.findIndex((p) => p.id === rest[0]);
    if (idx === -1) die(`No prompt with id "${rest[0]}".`);
    const [removed] = data.prompts.splice(idx, 1);
    if (data.activeSystemPromptId === removed.id) data.activeSystemPromptId = null;
    if (data.activeInstructionsId === removed.id) data.activeInstructionsId = null;
    save(data);
    console.log(`✓ deleted "${removed.name}"`);
    break;
  }

  case "use": {
    const id = rest[0];
    const doc = data.prompts.find((p) => p.id === id);
    if (!doc) die(`No prompt with id "${id}".`);
    const slot = args_get(rest, "--slot");
    if (slot !== "system" && slot !== "instructions") {
      die('--slot must be "system" or "instructions".', USAGE);
    }
    if (slot === "system") {
      const already = data.activeSystemPromptId === id;
      data.activeSystemPromptId = already ? null : id;
      console.log(already ? `✓ system slot cleared (built-in prompt restored)` : `✓ "${doc.name}" is now the active system prompt`);
    } else {
      const already = data.activeInstructionsId === id;
      data.activeInstructionsId = already ? null : id;
      console.log(already ? `✓ instructions slot cleared` : `✓ "${doc.name}" is now the active user instructions`);
    }
    save(data);
    break;
  }

  case "rename": {
    const id = rest[0];
    const newName = rest.slice(1).join(" ").trim();
    const doc = data.prompts.find((p) => p.id === id);
    if (!doc) die(`No prompt with id "${id}".`);
    if (!newName) die('Missing new name. Example: rename my-prompt "Better name"');
    doc.name = newName.slice(0, 80);
    doc.updatedAt = Date.now();
    save(data);
    console.log(`✓ renamed to "${doc.name}"`);
    break;
  }

  default:
    die(`Unknown command "${cmd ?? ""}".`, USAGE);
}

function args_get(args, flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
}
