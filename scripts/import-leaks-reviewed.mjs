#!/usr/bin/env node
/**
 * Reviewed import of the system_prompts_leaks collection into
 * sys_prompts/prompts.json.
 *
 * Every file below was inspected manually (file head read) and given:
 *  - a curated display name,
 *  - a type: "P" (Prompt → "system-prompt") or "S" (Style → "style" —
 *    output styles, personality packs, personas),
 *  - origin "leaked".
 *
 * Excluded on purpose (non-prompt material):
 *  - all README.md files and the repo CONTRIBUTING.md,
 *  - Anthropic/official/all.md (concatenated dump of the dated files),
 *  - Anthropic/claude-code/skills/claude-api/** (Claude API SDK docs,
 *    developer documentation, not prompts).
 *
 * The script verifies full coverage: any .md file that is neither in the
 * CATALOG nor in the EXCLUDE set is a hard error.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LEAKS = join(ROOT, "system_prompts_leaks");
const OUT = join(ROOT, "sys_prompts", "prompts.json");

/** rel path (posix) → [name, "P" | "S"] */
const CATALOG = {
  // ---------------- Anthropic (top level) ----------------
  "Anthropic/anthropic-interviewer.md": ["Anthropic Interviewer", "P"],
  "Anthropic/anthropic_reminders.md": ["Anthropic Reminders (Hidden Injections)", "P"],
  "Anthropic/claude-fable-5.1.md": ["Claude Fable 5.1 (claude.ai)", "P"],
  "Anthropic/claude-fable-5.md": ["Claude Fable 5 (claude.ai)", "P"],
  "Anthropic/claude-for-excel.md": ["Claude for Excel", "P"],
  "Anthropic/claude-for-word.md": ["Claude for Word", "P"],
  "Anthropic/claude-in-chrome.md": ["Claude in Chrome", "P"],
  "Anthropic/claude-in-powerpoint.md": ["Claude in PowerPoint", "P"],
  "Anthropic/claude-mobile-ios.md": ["Claude Mobile (iOS)", "P"],
  "Anthropic/claude-opus-4.6.md": ["Claude Opus 4.6 (claude.ai)", "P"],
  "Anthropic/claude-opus-4.6-no-tools.md": ["Claude Opus 4.6 — No Tools", "P"],
  "Anthropic/claude-opus-4.7.md": ["Claude Opus 4.7 (claude.ai)", "P"],
  "Anthropic/claude-opus-4.8.md": ["Claude Opus 4.8 (claude.ai)", "P"],
  "Anthropic/claude-opus-5.md": ["Claude Opus 5 (claude.ai)", "P"],
  "Anthropic/claude-science.md": ["Claude Science Platform", "P"],
  "Anthropic/claude-sonnet-4.6.md": ["Claude Sonnet 4.6 (claude.ai)", "P"],
  "Anthropic/claude-sonnet-4.6-no-tools.md": ["Claude Sonnet 4.6 — No Tools", "P"],
  "Anthropic/claude-sonnet-5.md": ["Claude Sonnet 5 (claude.ai)", "P"],
  "Anthropic/claude-voice-mode.md": ["Claude Voice Mode", "P"],
  "Anthropic/research_instructions.md": ["Claude Research Mode (Extended Search)", "P"],
  "Anthropic/sonnet-4.6-reminders.md": ["Claude Sonnet 4.6 — Safety Reminders", "P"],
  "Anthropic/visualize.md": ["Claude Imagine — Visual Creation Suite", "P"],

  // ---------------- Anthropic / claude-code ----------------
  "Anthropic/claude-code/claude-code-desktop-fable-5.md": ["Claude Code Desktop (Fable 5)", "P"],
  "Anthropic/claude-code/claude-code-docs-assistant.md": ["Claude Code Docs Assistant", "P"],
  "Anthropic/claude-code/claude-code-fable-5.1.md": ["Claude Code (Fable 5.1)", "P"],
  "Anthropic/claude-code/claude-code-fable-5.md": ["Claude Code (Fable 5)", "P"],
  "Anthropic/claude-code/claude-code-haiku-4.5.md": ["Claude Code (Haiku 4.5)", "P"],
  "Anthropic/claude-code/claude-code-headless-fable-5.1.md": ["Claude Code Headless — Agent SDK (Fable 5.1)", "P"],
  "Anthropic/claude-code/claude-code-opus-4.6.md": ["Claude Code (Opus 4.6)", "P"],
  "Anthropic/claude-code/claude-code-opus-4.7.md": ["Claude Code (Opus 4.7)", "P"],
  "Anthropic/claude-code/claude-code-opus-4.8.md": ["Claude Code (Opus 4.8)", "P"],
  "Anthropic/claude-code/claude-code-opus-5.md": ["Claude Code (Opus 5)", "P"],
  "Anthropic/claude-code/claude-code-sonnet-4.6.md": ["Claude Code (Sonnet 4.6)", "P"],
  "Anthropic/claude-code/claude-code-sonnet-5.md": ["Claude Code (Sonnet 5)", "P"],
  "Anthropic/claude-code/prompts/prompt-suggestion.md": ["Claude Code — Prompt Suggestion", "P"],
  "Anthropic/claude-code/agents/claude-code-guide.md": ["Claude Code Agent — Claude Code Guide", "P"],
  "Anthropic/claude-code/agents/claude.md": ["Claude Code Agent — Claude (Fleet Default)", "P"],
  "Anthropic/claude-code/agents/Explore.md": ["Claude Code Agent — Explore (Search)", "P"],
  "Anthropic/claude-code/agents/general-purpose.md": ["Claude Code Agent — General Purpose", "P"],
  "Anthropic/claude-code/agents/Plan.md": ["Claude Code Agent — Plan (Architect)", "P"],
  "Anthropic/claude-code/agents/statusline-setup.md": ["Claude Code Agent — Statusline Setup", "P"],
  "Anthropic/claude-code/commands/btw.md": ["Claude Code Command — /btw (Side Question)", "P"],
  "Anthropic/claude-code/commands/compact.md": ["Claude Code Command — /compact (Summarize)", "P"],
  "Anthropic/claude-code/commands/rename.md": ["Claude Code Command — /rename (Session Title)", "P"],
  "Anthropic/claude-code/output-styles/concise.md": ["Claude Code Output Style — Concise", "S"],
  "Anthropic/claude-code/output-styles/explanatory.md": ["Claude Code Output Style — Explanatory", "S"],
  "Anthropic/claude-code/output-styles/learning.md": ["Claude Code Output Style — Learning", "S"],
  "Anthropic/claude-code/output-styles/proactive.md": ["Claude Code Output Style — Proactive", "S"],
  "Anthropic/claude-code/skills/artifact-capabilities/SKILL.md": ["Claude Code Skill — Artifact Capabilities", "P"],
  "Anthropic/claude-code/skills/artifact-design/SKILL.md": ["Claude Code Skill — Artifact Design", "P"],
  "Anthropic/claude-code/skills/artifact-diagramming/SKILL.md": ["Claude Code Skill — Artifact Diagramming", "P"],
  "Anthropic/claude-code/skills/batch/SKILL.md": ["Claude Code Skill — Batch (Parallel Worktrees)", "P"],
  "Anthropic/claude-code/skills/claude-in-chrome/SKILL.md": ["Claude Code Skill — Claude in Chrome", "P"],
  "Anthropic/claude-code/skills/code-review/SKILL.md": ["Claude Code Skill — Code Review", "P"],
  "Anthropic/claude-code/skills/code-review/high.md": ["Claude Code Skill — Code Review (High Effort)", "P"],
  "Anthropic/claude-code/skills/code-review/low.md": ["Claude Code Skill — Code Review (Low Effort)", "P"],
  "Anthropic/claude-code/skills/code-review/medium.md": ["Claude Code Skill — Code Review (Medium Effort)", "P"],
  "Anthropic/claude-code/skills/code-review/max.md": ["Claude Code Skill — Code Review (Max Effort)", "P"],
  "Anthropic/claude-code/skills/code-review/xhigh.md": ["Claude Code Skill — Code Review (X-High Effort)", "P"],
  "Anthropic/claude-code/skills/code-review/report-findings-tool.md": ["Claude Code Skill — Code Review (Findings Report Tool)", "P"],
  "Anthropic/claude-code/skills/dataviz/SKILL.md": ["Claude Code Skill — Data Visualization", "P"],
  "Anthropic/claude-code/skills/dataviz/references/anti-patterns.md": ["Claude Code Skill — Dataviz Ref: Anti-Patterns", "P"],
  "Anthropic/claude-code/skills/dataviz/references/choosing-a-form.md": ["Claude Code Skill — Dataviz Ref: Choosing a Form", "P"],
  "Anthropic/claude-code/skills/dataviz/references/color-formula.md": ["Claude Code Skill — Dataviz Ref: Color Formula", "P"],
  "Anthropic/claude-code/skills/dataviz/references/components.md": ["Claude Code Skill — Dataviz Ref: Components", "P"],
  "Anthropic/claude-code/skills/dataviz/references/interaction.md": ["Claude Code Skill — Dataviz Ref: Interaction", "P"],
  "Anthropic/claude-code/skills/dataviz/references/marks-and-anatomy.md": ["Claude Code Skill — Dataviz Ref: Marks & Anatomy", "P"],
  "Anthropic/claude-code/skills/dataviz/references/palette.md": ["Claude Code Skill — Dataviz Ref: Palette", "P"],
  "Anthropic/claude-code/skills/debug/SKILL.md": ["Claude Code Skill — Debug", "P"],
  "Anthropic/claude-code/skills/deep-research/SKILL.md": ["Claude Code Skill — Deep Research", "P"],
  "Anthropic/claude-code/skills/design/SKILL.md": ["Claude Code Skill — Design Canvas", "P"],
  "Anthropic/claude-code/skills/design-sync/SKILL.md": ["Claude Code Skill — Design Sync", "P"],
  "Anthropic/claude-code/skills/design-sync/non-storybook/SKILL.md": ["Claude Code Skill — Design Sync (Non-Storybook)", "P"],
  "Anthropic/claude-code/skills/design-sync/storybook/SKILL.md": ["Claude Code Skill — Design Sync (Storybook)", "P"],
  "Anthropic/claude-code/skills/doctor/SKILL.md": ["Claude Code Skill — Doctor (Health Check)", "P"],
  "Anthropic/claude-code/skills/fewer-permission-prompts/SKILL.md": ["Claude Code Skill — Fewer Permission Prompts", "P"],
  "Anthropic/claude-code/skills/init/SKILL.md": ["Claude Code Skill — Init (CLAUDE.md)", "P"],
  "Anthropic/claude-code/skills/init-new/SKILL.md": ["Claude Code Skill — Init New (CLAUDE.md + Skills/Hooks)", "P"],
  "Anthropic/claude-code/skills/keybindings-help/SKILL.md": ["Claude Code Skill — Keybindings Help", "P"],
  "Anthropic/claude-code/skills/loop/SKILL.md": ["Claude Code Skill — Loop (Recurring Tasks)", "P"],
  "Anthropic/claude-code/skills/plugin-authoring/SKILL.md": ["Claude Code Skill — Plugin Authoring", "P"],
  "Anthropic/claude-code/skills/run/SKILL.md": ["Claude Code Skill — Run App", "P"],
  "Anthropic/claude-code/skills/run/examples/cli.md": ["Claude Code Skill — Run Example: CLI", "P"],
  "Anthropic/claude-code/skills/run/examples/electron.md": ["Claude Code Skill — Run Example: Electron", "P"],
  "Anthropic/claude-code/skills/run/examples/library.md": ["Claude Code Skill — Run Example: Library", "P"],
  "Anthropic/claude-code/skills/run/examples/playwright.md": ["Claude Code Skill — Run Example: Playwright", "P"],
  "Anthropic/claude-code/skills/run/examples/server.md": ["Claude Code Skill — Run Example: Server", "P"],
  "Anthropic/claude-code/skills/run/examples/tui.md": ["Claude Code Skill — Run Example: TUI", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/SKILL.md": ["Claude Code Skill — Run Skill Generator", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/template.md": ["Claude Code Skill — Run Skill Generator Template", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/examples/cli.md": ["Claude Code Skill — Run-Skill-Gen Example: CLI", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/examples/electron.md": ["Claude Code Skill — Run-Skill-Gen Example: Electron", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/examples/library.md": ["Claude Code Skill — Run-Skill-Gen Example: Library", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/examples/playwright.md": ["Claude Code Skill — Run-Skill-Gen Example: Playwright", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/examples/server.md": ["Claude Code Skill — Run-Skill-Gen Example: Server", "P"],
  "Anthropic/claude-code/skills/run-skill-generator/examples/tui.md": ["Claude Code Skill — Run-Skill-Gen Example: TUI", "P"],
  "Anthropic/claude-code/skills/schedule/SKILL.md": ["Claude Code Skill — Schedule (Cron Agents)", "P"],
  "Anthropic/claude-code/skills/security-review/SKILL.md": ["Claude Code Skill — Security Review", "P"],
  "Anthropic/claude-code/skills/simplify/SKILL.md": ["Claude Code Skill — Simplify", "P"],
  "Anthropic/claude-code/skills/update-config/SKILL.md": ["Claude Code Skill — Update Config", "P"],
  "Anthropic/claude-code/skills/verify/SKILL.md": ["Claude Code Skill — Verify Change", "P"],
  "Anthropic/claude-code/skills/workflow-authoring/SKILL.md": ["Claude Code Skill — Workflow Authoring", "P"],
  "Anthropic/claude-code/archive/glob-tool.md": ["Claude Code Tool — Glob Definition (Archived)", "P"],
  "Anthropic/claude-code/archive/grep-tool.md": ["Claude Code Tool — Grep Definition (Archived)", "P"],

  // ---------------- Anthropic / claude-cowork + claude-design ----------------
  "Anthropic/claude-cowork/claude-cowork.md": ["Claude Cowork", "P"],
  "Anthropic/claude-cowork/claude-cowork-dispatch.md": ["Claude Cowork — Dispatch Agent", "P"],
  "Anthropic/claude-cowork/setup-cowork/SKILL.md": ["Claude Cowork Skill — Setup Cowork", "P"],
  "Anthropic/claude-cowork/setup-writing-style/SKILL.md": ["Claude Cowork Skill — Setup Writing Style", "P"],
  "Anthropic/claude-design/claude-design.md": ["Claude Design", "P"],
  "Anthropic/claude-design/skills/3d-object/SKILL.md": ["Claude Design Skill — 3D Object", "P"],
  "Anthropic/claude-design/skills/animated-video/SKILL.md": ["Claude Design Skill — Animated Video", "P"],
  "Anthropic/claude-design/skills/claude-api-in-prototypes/SKILL.md": ["Claude Design Skill — Claude API in Prototypes", "P"],
  "Anthropic/claude-design/skills/create-design-system/SKILL.md": ["Claude Design Skill — Create Design System", "P"],
  "Anthropic/claude-design/skills/export-as-pptx-editable/SKILL.md": ["Claude Design Skill — Export as PPTX (Editable)", "P"],
  "Anthropic/claude-design/skills/export-as-pptx-screenshots/SKILL.md": ["Claude Design Skill — Export as PPTX (Screenshots)", "P"],
  "Anthropic/claude-design/skills/flier/SKILL.md": ["Claude Design Skill — Flier", "P"],
  "Anthropic/claude-design/skills/frontend-design/SKILL.md": ["Claude Design Skill — Frontend Design", "P"],
  "Anthropic/claude-design/skills/handoff-to-claude-code/SKILL.md": ["Claude Design Skill — Handoff to Claude Code", "P"],
  "Anthropic/claude-design/skills/hi-fi-design/SKILL.md": ["Claude Design Skill — Hi-Fi Design", "P"],
  "Anthropic/claude-design/skills/html-email/SKILL.md": ["Claude Design Skill — HTML Email", "P"],
  "Anthropic/claude-design/skills/interactive-prototype/SKILL.md": ["Claude Design Skill — Interactive Prototype", "P"],
  "Anthropic/claude-design/skills/make-a-deck/SKILL.md": ["Claude Design Skill — Make a Deck", "P"],
  "Anthropic/claude-design/skills/make-a-doc/SKILL.md": ["Claude Design Skill — Make a Doc", "P"],
  "Anthropic/claude-design/skills/make-tweakable/SKILL.md": ["Claude Design Skill — Make Tweakable", "P"],
  "Anthropic/claude-design/skills/maps-geography/SKILL.md": ["Claude Design Skill — Maps & Geography", "P"],
  "Anthropic/claude-design/skills/options/SKILL.md": ["Claude Design Skill — Options", "P"],
  "Anthropic/claude-design/skills/save-as-pdf/SKILL.md": ["Claude Design Skill — Save as PDF", "P"],
  "Anthropic/claude-design/skills/save-as-standalone-html/SKILL.md": ["Claude Design Skill — Save as Standalone HTML", "P"],
  "Anthropic/claude-design/skills/web-research/SKILL.md": ["Claude Design Skill — Web Research", "P"],
  "Anthropic/claude-design/skills/wireframe/SKILL.md": ["Claude Design Skill — Wireframe", "P"],

  // ---------------- Anthropic / old + raw ----------------
  "Anthropic/old/default-styles.md": ["Claude Legacy Output Styles (Learning & Explanatory)", "S"],
  "Anthropic/old/claude-3.7-full-system-message-with-all-tools.md": ["Claude 3.7 Sonnet — Full System Message (All Tools)", "P"],
  "Anthropic/old/claude-3.7-sonnet-full-system-message-humanreadable.md": ["Claude 3.7 Sonnet — Full System Message (Readable)", "P"],
  "Anthropic/old/claude-3.7-sonnet.md": ["Claude 3.7 Sonnet (API)", "P"],
  "Anthropic/old/claude-3.7-sonnet-w-tools.md": ["Claude 3.7 Sonnet — With Tools", "P"],
  "Anthropic/old/claude-4.1-opus-thinking.md": ["Claude Opus 4.1 — Thinking", "P"],
  "Anthropic/old/claude-4.5-sonnet.md": ["Claude Sonnet 4.5 (Old Leak)", "P"],
  "Anthropic/old/claude-opus-4.5.md": ["Claude Opus 4.5 (Old Leak)", "P"],
  "Anthropic/old/claude-sonnet-4.md": ["Claude Sonnet 4 (Old Leak)", "P"],
  "Anthropic/raw/claude-opus-4.6-raw.md": ["Claude Opus 4.6 — Raw Transcript", "P"],
  "Anthropic/raw/claude-opus-4.6-no-tools-raw.md": ["Claude Opus 4.6 No Tools — Raw Transcript", "P"],
  "Anthropic/raw/claude-sonnet-4.6-raw.md": ["Claude Sonnet 4.6 — Raw Transcript", "P"],
  "Anthropic/raw/claude-sonnet-4.6-no-tools-raw.md": ["Claude Sonnet 4.6 No Tools — Raw Transcript", "P"],

  // ---------------- Anthropic / official (dated) ----------------
  "Anthropic/official/2024-07-12-claude-haiku-3.md": ["Claude Haiku 3 — Official (2024-07-12)", "P"],
  "Anthropic/official/2024-07-12-claude-opus-3.md": ["Claude Opus 3 — Official (2024-07-12)", "P"],
  "Anthropic/official/2024-07-12-claude-sonnet-3.5-text-and-images.md": ["Claude Sonnet 3.5 — Official, Text+Images (2024-07-12)", "P"],
  "Anthropic/official/2024-09-09-claude-sonnet-3.5-text-and-images.md": ["Claude Sonnet 3.5 — Official, Text+Images (2024-09-09)", "P"],
  "Anthropic/official/2024-09-09-claude-sonnet-3.5-text-only.md": ["Claude Sonnet 3.5 — Official, Text-Only (2024-09-09)", "P"],
  "Anthropic/official/2024-10-22-claude-haiku-3.5-text-only.md": ["Claude Haiku 3.5 — Official, Text-Only (2024-10-22)", "P"],
  "Anthropic/official/2024-10-22-claude-sonnet-3.5-text-and-images.md": ["Claude Sonnet 3.5 — Official, Text+Images (2024-10-22)", "P"],
  "Anthropic/official/2024-10-22-claude-sonnet-3.5-text-only.md": ["Claude Sonnet 3.5 — Official, Text-Only (2024-10-22)", "P"],
  "Anthropic/official/2024-11-22-claude-sonnet-3.5-text-and-images.md": ["Claude Sonnet 3.5 — Official, Text+Images (2024-11-22)", "P"],
  "Anthropic/official/2024-11-22-claude-sonnet-3.5-text-only.md": ["Claude Sonnet 3.5 — Official, Text-Only (2024-11-22)", "P"],
  "Anthropic/official/2025-02-24-claude-haiku-3.5-text-and-images.md": ["Claude Haiku 3.5 — Official, Text+Images (2025-02-24)", "P"],
  "Anthropic/official/2025-02-24-claude-sonnet-3.7.md": ["Claude Sonnet 3.7 — Official (2025-02-24)", "P"],
  "Anthropic/official/2025-05-22-claude-opus-4.md": ["Claude Opus 4 — Official (2025-05-22)", "P"],
  "Anthropic/official/2025-05-22-claude-sonnet-4.md": ["Claude Sonnet 4 — Official (2025-05-22)", "P"],
  "Anthropic/official/2025-07-31-claude-opus-4.md": ["Claude Opus 4 — Official (2025-07-31)", "P"],
  "Anthropic/official/2025-07-31-claude-sonnet-4.md": ["Claude Sonnet 4 — Official (2025-07-31)", "P"],
  "Anthropic/official/2025-08-05-claude-opus-4.1.md": ["Claude Opus 4.1 — Official (2025-08-05)", "P"],
  "Anthropic/official/2025-08-05-claude-opus-4.md": ["Claude Opus 4 — Official (2025-08-05)", "P"],
  "Anthropic/official/2025-08-05-claude-sonnet-4.md": ["Claude Sonnet 4 — Official (2025-08-05)", "P"],
  "Anthropic/official/2025-09-29-claude-sonnet-4.5.md": ["Claude Sonnet 4.5 — Official (2025-09-29)", "P"],
  "Anthropic/official/2025-10-15-claude-haiku-4.5.md": ["Claude Haiku 4.5 — Official (2025-10-15)", "P"],
  "Anthropic/official/2025-11-19-claude-haiku-4.5.md": ["Claude Haiku 4.5 — Official (2025-11-19)", "P"],
  "Anthropic/official/2025-11-19-claude-sonnet-4.5.md": ["Claude Sonnet 4.5 — Official (2025-11-19)", "P"],
  "Anthropic/official/2025-11-24-claude-opus-4.5.md": ["Claude Opus 4.5 — Official (2025-11-24)", "P"],
  "Anthropic/official/2026-01-18-claude-haiku-4.5.md": ["Claude Haiku 4.5 — Official (2026-01-18)", "P"],
  "Anthropic/official/2026-01-18-claude-opus-4.5.md": ["Claude Opus 4.5 — Official (2026-01-18)", "P"],
  "Anthropic/official/2026-01-18-claude-sonnet-4.5.md": ["Claude Sonnet 4.5 — Official (2026-01-18)", "P"],
  "Anthropic/official/2026-02-05-claude-opus-4.6.md": ["Claude Opus 4.6 — Official (2026-02-05)", "P"],
  "Anthropic/official/2026-02-17-claude-sonnet-4.6.md": ["Claude Sonnet 4.6 — Official (2026-02-17)", "P"],
  "Anthropic/official/2026-04-16-claude-opus-4.7.md": ["Claude Opus 4.7 — Official (2026-04-16)", "P"],
  "Anthropic/official/2026-05-28-claude-opus-4.8.md": ["Claude Opus 4.8 — Official (2026-05-28)", "P"],
  "Anthropic/official/2026-06-09-claude-fable-5.md": ["Claude Fable 5 — Official (2026-06-09)", "P"],
  "Anthropic/official/2026-07-24-claude-opus-5.md": ["Claude Opus 5 — Official (2026-07-24)", "P"],
  "Anthropic/official/2026-09-01-claude-fable-5.1.md": ["Claude Fable 5.1 — Official (2026-09-01)", "P"],

  // ---------------- Cursor / DeepSeek ----------------
  "Cursor/cursor.md": ["Cursor", "P"],
  "DeepSeek/deepseek-chat.md": ["DeepSeek Chat (System + Search Tool)", "P"],

  // ---------------- Google ----------------
  "Google/ai-studio-build.md": ["Google AI Studio Build", "P"],
  "Google/antigravity-cli.md": ["Google Antigravity CLI", "P"],
  "Google/gemini-2.0-flash-webapp.md": ["Gemini 2.0 Flash (Web App)", "P"],
  "Google/gemini-2.5-flash-image-preview.md": ["Gemini 2.5 Flash Image (Preview)", "P"],
  "Google/gemini-2.5-pro-api.md": ["Gemini 2.5 Pro (API)", "P"],
  "Google/gemini-2.5-pro-guided-learning.md": ["Gemini 2.5 Pro — Guided Learning", "P"],
  "Google/gemini-2.5-pro-webapp.md": ["Gemini 2.5 Pro (Web App)", "P"],
  "Google/gemini-3.1-pro-api.md": ["Gemini 3.1 Pro (API)", "P"],
  "Google/gemini-3.1-pro.md": ["Gemini 3.1 Pro (Gemini App)", "P"],
  "Google/gemini-3.5-flash-ai-studio.md": ["Gemini 3.5 Flash (AI Studio)", "P"],
  "Google/gemini-3.5-flash.md": ["Gemini 3.5 Flash (Gemini App)", "P"],
  "Google/gemini-3.7-flash.md": ["Gemini 3.7 Flash (Gemini App)", "P"],
  "Google/gemini-3.8-flash.md": ["Gemini 3.8 Flash (Gemini App)", "P"],
  "Google/gemini-3-flash.md": ["Gemini 3 Flash (Gemini App)", "P"],
  "Google/gemini-3-pro.md": ["Gemini 3 Pro (Gemini App)", "P"],
  "Google/gemini-cli.md": ["Gemini CLI", "P"],
  "Google/gemini-diffusion.md": ["Gemini Diffusion", "P"],
  "Google/gemini-in-chrome.md": ["Gemini in Chrome", "P"],
  "Google/gemini-workspace.md": ["Gemini in Google Workspace", "P"],
  "Google/gemini-youtube.md": ["Gemini in YouTube", "P"],
  "Google/google-search-ai-mode.md": ["Google Search — AI Mode", "P"],
  "Google/jules.md": ["Google Jules", "P"],
  "Google/nano-banana-2-api.md": ["Nano Banana 2 (Image Gen, API)", "P"],
  "Google/notebooklm-chat.md": ["NotebookLM Chat", "P"],

  // ---------------- Kimi / Meta / Microsoft / Mistral / Notion / OpenCode / Pi / Qwen ----------------
  "Kimi/kimi-2.6.md": ["Kimi K2.6 (Moonshot AI)", "P"],
  "Kimi/kimi-3.md": ["Kimi K3 (Moonshot AI)", "P"],
  "Meta/meta-spark.md": ["Meta AI (Meta Spark)", "P"],
  "Meta/muse-code.md": ["Muse Code (Meta CLI Agent)", "P"],
  "Meta/muse-spark-1.1.md": ["Meta AI (Muse Spark 1.1)", "P"],
  "Microsoft/copilot-cli.md": ["GitHub Copilot CLI", "P"],
  "Microsoft/copilot-in-microsoft-word.md": ["Microsoft Copilot in Word", "P"],
  "Microsoft/copilot-macos-app.md": ["GitHub Copilot for macOS", "P"],
  "Microsoft/github-copilot.md": ["GitHub Copilot (@copilot on github.com)", "P"],
  "Microsoft/vscode-copilot-agent.md": ["Copilot CLI Runtime in VS Code", "P"],
  "Mistral/mistral-code.md": ["Mistral Code", "P"],
  "Mistral/mistral-medium-3.5.md": ["Mistral Vibe (Medium 3.5)", "P"],
  "Notion/notion-ai.md": ["Notion AI", "P"],
  "OpenCode/opencode.md": ["OpenCode CLI", "P"],
  "Pi/instructions.md": ["Pi Coding Agent", "P"],
  "Qwen/qwen3.6-plus.md": ["Qwen 3.6 Plus (Tools + Search)", "P"],
  "Qwen/qwen3.8-max.md": ["Qwen 3.8 Max (Tools)", "P"],

  // ---------------- Misc ----------------
  "Misc/amp-code.md": ["Amp CLI", "P"],
  "Misc/brave-search.md": ["Brave Search Assistant", "P"],
  "Misc/character-ai.md": ["Character.AI (Character Template)", "P"],
  "Misc/commandcode-cli.md": ["Command Code CLI", "P"],
  "Misc/confer.md": ["Confer (Moxie Marlinspike)", "P"],
  "Misc/devin-cli.md": ["Devin CLI (Cognition)", "P"],
  "Misc/docker-gordon-ai.md": ["Docker Gordon AI (Multi-Agent)", "P"],
  "Misc/elevenlabs-voice-agent.md": ["ElevenLabs Voice Agent", "P"],
  "Misc/fellou-browser.md": ["Fellou Browser (Action-Oriented)", "P"],
  "Misc/gizmo-ai.md": ["Gizmo AI (Tutor)", "P"],
  "Misc/hermes.md": ["Hermes (OpenClaw SOUL.md Persona)", "P"],
  "Misc/indus-ai.md": ["Indus (Sarvam AI)", "P"],
  "Misc/kagi-assistant.md": ["Kagi Assistant", "P"],
  "Misc/minimax-m2.5.md": ["MiniMax M2.5 (Agent Reminder)", "P"],
  "Misc/opencode.md": ["OpenCode (Full System Prompt)", "P"],
  "Misc/proton-lumo-ai.md": ["Lumo (Proton)", "P"],
  "Misc/raycast-ai.md": ["Raycast AI", "P"],
  "Misc/reddit-answers.md": ["Reddit Answers", "P"],
  "Misc/sesame-ai-maya.md": ["Maya (Sesame AI Voice Companion)", "P"],
  "Misc/stack-overflow-ai-assist.md": ["Stack Overflow AI Assist", "P"],
  "Misc/t3.chat.md": ["T3 Chat", "P"],
  "Misc/t3-code.md": ["T3 Code (Plan Mode)", "P"],
  "Misc/warp-2.0-agent.md": ["Warp Agent Mode 2.0", "P"],
  "Misc/zed.md": ["Zed Editor AI", "P"],

  // ---------------- OpenAI ----------------
  "OpenAI/4o-2025-09-03-new-personality.md": ["ChatGPT 4o — Personality v2 (2025-09-03)", "P"],
  "OpenAI/chatgpt-4.5.md": ["ChatGPT 4.5", "P"],
  "OpenAI/chatgpt-4o-deprecation-preparedness-prompt.md": ["ChatGPT 4o — Deprecation Preparedness", "P"],
  "OpenAI/chatgpt-atlas.md": ["ChatGPT Atlas (Browser)", "P"],
  "OpenAI/chatgpt-gpt-5-agent-mode.md": ["ChatGPT Agent Mode (GPT-5)", "P"],
  "OpenAI/chatgpt-personality-instructions.md": ["ChatGPT Personality Pack (Professional/Candid/Quirky…)", "S"],
  "OpenAI/gpt-4.1.md": ["ChatGPT 4.1", "P"],
  "OpenAI/gpt-4.1-mini.md": ["ChatGPT 4.1 Mini", "P"],
  "OpenAI/gpt-4.5.md": ["ChatGPT 4.5 (ChatGPT App)", "P"],
  "OpenAI/gpt-4o-advanced-voice-mode.md": ["ChatGPT 4o — Advanced Voice Mode", "P"],
  "OpenAI/gpt-4o-legacy-voice-mode.md": ["ChatGPT 4o — Legacy Voice Mode", "P"],
  "OpenAI/gpt-4o.md": ["ChatGPT 4o", "P"],
  "OpenAI/gpt-5-listener-personality.md": ["GPT-5 Personality — Listener", "S"],
  "OpenAI/gpt-5-nerdy-personality.md": ["GPT-5 Personality — Nerdy", "S"],
  "OpenAI/gpt-5-robot-personality.md": ["GPT-5 Personality — Robot", "S"],
  "OpenAI/gpt-5.1-efficient.md": ["GPT-5.1 Personality — Efficient", "S"],
  "OpenAI/gpt-5.1-nerdy.md": ["GPT-5.1 Personality — Nerdy", "S"],
  "OpenAI/gpt-5.1-professional.md": ["GPT-5.1 Personality — Professional", "S"],
  "OpenAI/gpt-5.2-mini-free-account.md": ["ChatGPT 5.2 Mini (Free Accounts)", "P"],
  "OpenAI/gpt-5.2-thinking.md": ["ChatGPT 5.2 Thinking", "P"],
  "OpenAI/gpt-5.3-chat-api.md": ["ChatGPT 5.3 (Chat API)", "P"],
  "OpenAI/gpt-5.3-codex-api.md": ["GPT-5.3 Codex (API, Raw Channels)", "P"],
  "OpenAI/gpt-5.3-instant.md": ["ChatGPT 5.3 Instant", "P"],
  "OpenAI/gpt-5.4-api.md": ["ChatGPT 5.4 (API)", "P"],
  "OpenAI/gpt-5.4-thinking.md": ["ChatGPT 5.4 Thinking", "P"],
  "OpenAI/gpt-5.5-api.md": ["ChatGPT 5.5 (API)", "P"],
  "OpenAI/gpt-5.5-instant.md": ["ChatGPT 5.5 Instant", "P"],
  "OpenAI/gpt-5.5-pro-api.md": ["ChatGPT 5.5 Pro (API)", "P"],
  "OpenAI/gpt-5.5-thinking.md": ["ChatGPT 5.5 Thinking", "P"],
  "OpenAI/gpt-5.6-sol.md": ["ChatGPT 5.6 Sol", "P"],
  "OpenAI/gpt-5-thinking.md": ["ChatGPT 5 Thinking", "P"],
  "OpenAI/tool-advanced-memory.md": ["ChatGPT — Advanced Memory (Chat History)", "P"],
  "OpenAI/tool-deep-research.md": ["ChatGPT — Deep Research Tool", "P"],
  "OpenAI/API/gpt-5-reasoning-effort-high-api.md": ["ChatGPT 5 (API, Reasoning Effort High)", "P"],
  "OpenAI/API/o3-high-api.md": ["o3 (API, Reasoning Effort High)", "P"],
  "OpenAI/API/o3-low-api.md": ["o3 (API, Reasoning Effort Low)", "P"],
  "OpenAI/API/o3-medium-api.md": ["o3 (API, Reasoning Effort Medium)", "P"],
  "OpenAI/API/o4-mini-high.md": ["o4-mini (API, Reasoning Effort High)", "P"],
  "OpenAI/API/o4-mini-low-api.md": ["o4-mini (API, Reasoning Effort Low)", "P"],
  "OpenAI/API/o4-mini-medium-api.md": ["o4-mini (API, Reasoning Effort Medium)", "P"],
  "OpenAI/Codex/codex-auto-review.md": ["Codex — Auto Review", "P"],
  "OpenAI/Codex/codex-desktop-realtime-voice-agent.md": ["Codex Desktop — Realtime Voice Agent", "P"],
  "OpenAI/Codex/codex-full.md": ["Codex (Full Prompt, GPT-5)", "P"],
  "OpenAI/Codex/computer-use.md": ["Codex Skill — Computer Use (Mac)", "P"],
  "OpenAI/Codex/control-chrome.md": ["Codex Skill — Control Chrome", "P"],
  "OpenAI/Codex/control-in-app-browser.md": ["Codex Skill — Control In-App Browser", "P"],
  "OpenAI/Codex/gpt-5.3-codex-spark.md": ["Codex (GPT-5.3 Spark)", "P"],
  "OpenAI/Codex/gpt-5.4.md": ["Codex (GPT-5.4)", "P"],
  "OpenAI/Codex/gpt-5.4-mini.md": ["Codex (GPT-5.4 Mini)", "P"],
  "OpenAI/Codex/gpt-5.5.md": ["Codex (GPT-5.5)", "P"],
  "OpenAI/Codex/gpt-5.6.md": ["Codex (GPT-5.6)", "P"],
  "OpenAI/Codex/gpt-6-astra.md": ["Codex (GPT-6 Astra)", "P"],
  "OpenAI/Codex/gpt-6-astra-chatgpt-work-local.md": ["Codex (GPT-6 Astra, ChatGPT Work Local)", "P"],
  "OpenAI/Codex/personality_friendly.md": ["Codex Personality — Friendly (5.4/5.3)", "S"],
  "OpenAI/Codex/personality_pragmatic.md": ["Codex Personality — Pragmatic (5.4/5.3)", "S"],
  "OpenAI/Codex/personality_friendly_gpt-5.5.md": ["Codex Personality — Friendly (GPT-5.5)", "S"],
  "OpenAI/Codex/personality_pragmatic_gpt-5.5.md": ["Codex Personality — Pragmatic (GPT-5.5)", "S"],
  "OpenAI/Codex/plan_mode.md": ["Codex — Plan Mode (Conversational)", "P"],
  "OpenAI/Codex/old/gpt-5.1-codex-max.md": ["Codex (GPT-5.1 Codex Max)", "P"],
  "OpenAI/Codex/old/gpt-5.1-codex.md": ["Codex (GPT-5.1 Codex)", "P"],
  "OpenAI/Codex/old/gpt-5.1-codex-mini.md": ["Codex (GPT-5.1 Codex Mini)", "P"],
  "OpenAI/Codex/old/gpt-5.1.md": ["Codex (GPT-5.1)", "P"],
  "OpenAI/Codex/old/gpt-5.2-codex.md": ["Codex (GPT-5.2 Codex)", "P"],
  "OpenAI/Codex/old/gpt-5.2.md": ["Codex CLI (GPT-5.2)", "P"],
  "OpenAI/Codex/old/gpt-5.3-codex.md": ["Codex (GPT-5.3 Codex)", "P"],
  "OpenAI/Codex/old/gpt-5-codex.md": ["Codex (GPT-5 Codex)", "P"],
  "OpenAI/Codex/old/gpt-5-codex-mini.md": ["Codex (GPT-5 Codex Mini)", "P"],
  "OpenAI/Codex/old/gpt-5.md": ["Codex (GPT-5)", "P"],
  "OpenAI/Codex/old/personality_friendly_gpt-5.2-codex.md": ["Codex Personality — Friendly (GPT-5.2 Codex)", "S"],
  "OpenAI/Codex/old/personality_pragmatic_gpt-5.2-codex.md": ["Codex Personality — Pragmatic (GPT-5.2 Codex)", "S"],
  "OpenAI/Old/chatgpt-4o-mini.md": ["ChatGPT 4o Mini", "P"],
  "OpenAI/Old/chatgpt.com-o4-mini.md": ["ChatGPT o4-mini (chatgpt.com, 2025-05)", "P"],
  "OpenAI/Old/gpt-4o-whatsapp.md": ["ChatGPT 4o (WhatsApp)", "P"],
  "OpenAI/Old/image-safety-policies.md": ["ChatGPT — Image Safety Policies", "P"],
  "OpenAI/Old/monday-gpt.md": ["Monday GPT (EMO AI Persona)", "P"],
  "OpenAI/Old/o3.md": ["ChatGPT o3 (chatgpt.com)", "P"],
  "OpenAI/Old/o4-mini.md": ["ChatGPT o4-mini (2025-05-14)", "P"],
  "OpenAI/Old/prompt-automation-context.md": ["ChatGPT — Automation Job Context", "P"],
  "OpenAI/Old/prompt-image-safety-policies.md": ["ChatGPT — Image Safety Policies (Prompt Layer)", "P"],
  "OpenAI/Old/study-and-learn.md": ["ChatGPT — Study & Learn Mode", "P"],
  "OpenAI/Old/tool-canvas-canmore.md": ["ChatGPT Tool — Canvas (canmore)", "P"],
  "OpenAI/Old/tool-create-image-image_gen.md": ["ChatGPT Tool — Image Generation (image_gen)", "P"],
  "OpenAI/Old/tool-file_search.md": ["ChatGPT Tool — File Search", "P"],
  "OpenAI/Old/tool-python-code.md": ["ChatGPT Tool — Python (Jupyter)", "P"],
  "OpenAI/Old/tool-web-search.md": ["ChatGPT Tool — Web Search", "P"],

  // ---------------- Perplexity ----------------
  "Perplexity/comet-browser-assistant.md": ["Perplexity Comet (Browser Assistant)", "P"],
  "Perplexity/deep-research.md": ["Perplexity Deep Research", "P"],
  "Perplexity/perplexity-ai.md": ["Perplexity AI (Answer Engine)", "P"],
  "Perplexity/perplexity-computer.md": ["Perplexity Computer", "P"],
  "Perplexity/voice-assistant.md": ["Perplexity Voice Assistant", "P"],

  // ---------------- xAI ----------------
  "xAI/grok-3.md": ["Grok 3", "P"],
  "xAI/grok-4.1-beta.md": ["Grok 4.1 (Beta, API Policy)", "P"],
  "xAI/grok-4.2.md": ["Grok 4.2 (Multi-Agent Team)", "P"],
  "xAI/grok-4.3-beta.md": ["Grok 4.3 (Beta)", "P"],
  "xAI/grok-4.5.md": ["Grok 4.5", "P"],
  "xAI/grok-4.6.md": ["Grok 4.6", "P"],
  "xAI/grok-4.md": ["Grok 4", "P"],
  "xAI/grok-4-with-new-safety-instructions.md": ["Grok 4 — With New Safety Instructions", "P"],
  "xAI/grok-account.md": ["Grok (Account Mode, 4.2)", "P"],
  "xAI/grok-api.md": ["Grok (API Policy)", "P"],
  "xAI/grok-bot.md": ["Grok Bot (Desktop Assistant)", "P"],
  "xAI/grok-build.md": ["Grok Build (Coding Agent)", "P"],
  "xAI/grok-expert.md": ["Grok Expert (Multi-Agent Team)", "P"],
  "xAI/grok-personas.md": ["Grok Personas (Companion etc.)", "S"],
};

/** Files deliberately excluded (READMEs, dumps, SDK docs). */
const EXCLUDE = new Set([
  "README.md",
  ".github/CONTRIBUTING.md",
  "Anthropic/README.md",
  "Anthropic/official/README.md",
  "Anthropic/official/all.md",
  "Anthropic/claude-design/skills/README.md",
  "Anthropic/claude-code/skills/code-review/README.md",
  "GLM/README.md",
  "OpenAI/README.md",
  "OpenAI/API/README.md",
]);
const EXCLUDE_PREFIX = "Anthropic/claude-code/skills/claude-api/";

function stripFrontmatter(content) {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\s*\n/, "");
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") out.push(p);
  }
  return out;
}

function main() {
  if (!existsSync(LEAKS)) {
    console.error("system_prompts_leaks/ not found");
    process.exit(1);
  }

  const data = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : { version: 1, activeSystemPromptId: null, activeInstructionsId: null, prompts: [] };
  data.prompts = [];
  data.activeSystemPromptId = null;
  data.activeInstructionsId = null;

  const seenText = new Set();
  const now = Date.now();
  let imported = 0, dupes = 0, excluded = 0;
  const missing = [];

  for (const file of walk(LEAKS).sort()) {
    const rel = relative(LEAKS, file).replaceAll("\\", "/");
    if (EXCLUDE.has(rel) || rel.startsWith(EXCLUDE_PREFIX)) {
      excluded++;
      continue;
    }
    const entry = CATALOG[rel];
    if (!entry) {
      missing.push(rel);
      continue;
    }
    const [name, type] = entry;
    if (type !== "P" && type !== "S") throw new Error(`Bad type for ${rel}: ${type}`);

    const bytes = statSync(file).size;
    const raw = readFileSync(file, "utf8");
    const text = (stripFrontmatter(raw).trim() || raw).slice(0, 600_000);
    if (!text.trim()) throw new Error(`Empty content for ${rel}`);

    const key = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (seenText.has(key)) {
      dupes++;
      continue;
    }
    seenText.add(key);
    data.prompts.push({
      id: `leak-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: type === "S" ? "style" : "system-prompt",
      origin: "leaked",
      text,
      createdAt: now,
      updatedAt: now,
      _source: rel,
      _bytes: bytes,
    });
    imported++;
  }

  if (missing.length) {
    console.error("Files with no catalog entry:\n" + missing.map((m) => `  ${m}`).join("\n"));
    process.exit(1);
  }

  data.version = 1;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  const styles = data.prompts.filter((p) => p.type === "style").length;
  console.log(
    `imported ${imported} (${styles} styles) · ${dupes} exact dupes · ${excluded} excluded (README/dump/SDK docs)`,
  );
}

main();
