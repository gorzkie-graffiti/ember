/**
 * G4F probe: curated candidate ids (server-prefixed and bare forms) with
 * 90s budgets, writing PASS/FAIL lines to /tmp/g4f_results.txt as they
 * complete so the run can be backgrounded and polled.
 * Usage: node scripts/probe-g4f.mjs
 */
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = "https://g4f.space/v1";
const headers = { Authorization: `Bearer ${env.G4F_API_KEY}`, "Content-Type": "application/json" };

const TARGETS = process.argv[2] === "batch2" ? [
  "srv_mp1v9cyha31b95fa8c9a:z-ai/glm-5.3",
  "srv_mp1v9cyha31b95fa8c9a:anthropic/claude-sonnet-4-5",
  "srv_mp1v9cyha31b95fa8c9a:anthropic/claude-haiku-4-5",
  "srv_mp1v9cyha31b95fa8c9a:moonshotai/kimi-k3",
  "srv_mkp3v4pj6b8669965b41:auto",
  "srv_monk1pkz433a519ff2be:openrouter/free",
  "srv_mtsj8uzo97d3c0d49960:xai-z/grok-4-fast-non-reasoning",
  "srv_mt1wbaxgf9c946af0c58:deepseek-v4-flash",
] : [
  // bare ids (what the current catalog uses) vs server-prefixed reality
  "models/gemini-3.5-flash",
  "srv_mrgy0nmbc8a86c407f17:models/gemini-3.5-flash",
  "models/gemini-2.5-flash",
  "srv_mrgy0nmbc8a86c407f17:models/gemini-2.5-flash",
  "models/gemini-3.1-flash-lite",
  "srv_mrgy0nmbc8a86c407f17:models/gemini-3.1-flash-lite",
  "srv_mkombumpae45db46dcb8:openai/gpt-oss-120b",
  "srv_mkombumpae45db46dcb8:openai/gpt-oss-20b",
  "srv_mkombumpae45db46dcb8:qwen/qwen3.8-27b",
  "srv_mkombumpae45db46dcb8:groq/compound",
  "srv_mkombumpae45db46dcb8:groq/compound-mini",
  "srv_mkombumpae45db46dcb8:nvidia/nemotron-3-super-120b-a12b",
  "srv_mkombumpae45db46dcb8:meta/muse-glimmer-30b",
  "srv_mkombumpae45db46dcb8:google/gemma-4-31b-it",
];

writeFileSync("/tmp/g4f_results.txt", "");

async function probe(modelId) {
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "What is the capital of France? Answer in one short sentence." }],
        stream: true,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return `FAIL ${modelId} | HTTP ${r.status} ${t.replace(/\s+/g, " ").slice(0, 100)}`;
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", content = "", sawDone = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const p = t.slice(5).trim();
        if (p === "[DONE]") { sawDone = true; continue; }
        try {
          const j = JSON.parse(p);
          if (j.error) return `FAIL ${modelId} | stream error: ${String(j.error.message ?? "").slice(0, 90)}`;
          const d = j.choices?.[0]?.delta ?? {};
          if (typeof d.content === "string") content += d.content;
        } catch {}
      }
    }
    const cleaned = content.replace(/\s+/g, " ").trim();
    const ok = cleaned.length > 0;
    return `${ok ? "PASS" : "FAIL"} ${modelId} | ${sawDone ? "[done] " : ""}${JSON.stringify(cleaned.slice(0, 80))}`;
  } catch (e) {
    return `FAIL ${modelId} | ${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 80)}`;
  }
}

for (const id of TARGETS) {
  const line = await probe(id);
  console.log(line);
  appendFileSync("/tmp/g4f_results.txt", line + "\n");
  await new Promise((r) => setTimeout(r, 1000));
}
appendFileSync("/tmp/g4f_results.txt", "ALL_DONE\n");
