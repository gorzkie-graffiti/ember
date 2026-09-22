/**
 * Targeted re-probe for models that were rate-limited (429) or returned
 * empty content in the first pass. Bigger max_tokens for reasoning models,
 * 3.2s spacing to stay under Cohere trial's 20 calls/min.
 * Usage: node scripts/retest-cohere.mjs
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = "https://api.cohere.ai/compatibility/v1";
const key = env.COHERE_API_KEY;
if (!key) {
  console.error("COHERE_API_KEY not set");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// Models needing a second look:
//  - 429 in pass 1 (trial rate limit, not a real failure)
//  - empty content (likely reasoning models that exhausted 30 tokens)
const TARGETS = [
  "command-a-plus-05-2026",
  "command-a-reasoning-08-2025",
  "command-r-plus-08-2024",
  "command-r7b-12-2024",
  "command-r7b-arabic-02-2025",
  "north-mini-code-1-0",
  "north-small-translate-09-2026",
];

async function probe(modelId) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      stream: true,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, detail: `HTTP ${r.status} ${t.slice(0, 120)}` };
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", content = "", reasoning = "", sawDone = false, err = "";
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
        if (j.error) err = j.error.message ?? JSON.stringify(j.error).slice(0, 120);
        const d = j.choices?.[0]?.delta ?? {};
        if (typeof d.content === "string") content += d.content;
        if (typeof d.reasoning === "string" || typeof d.reasoning_content === "string")
          reasoning += (d.reasoning ?? d.reasoning_content ?? "");
      } catch {}
    }
  }
  if (err) return { ok: false, detail: `stream error: ${err}` };
  const cleaned = content.replace(/\s+/g, " ").trim();
  return {
    ok: sawDone || cleaned.length > 0,
    detail: `content=${JSON.stringify(cleaned.slice(0, 50))} reasoning=${reasoning.length > 0 ? "yes(" + reasoning.length + "ch)" : "no"}`,
  };
}

for (const id of TARGETS) {
  const { ok, detail } = await probe(id);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} | ${detail}`);
  await new Promise((r) => setTimeout(r, 3200)); // stay under 20/min
}
