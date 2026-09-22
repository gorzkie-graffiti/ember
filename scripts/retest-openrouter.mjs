/**
 * Re-probe ambiguous (empty content) or 429'd OpenRouter free models with
 * the natural-language prompt. Long budget; free pools can be slow.
 * Usage: node scripts/retest-openrouter.mjs
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = "https://openrouter.ai/api/v1";
const headers = {
  Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
  "Content-Type": "application/json",
  "HTTP-Referer": "https://ember.local",
  "X-Title": "Ember",
};

const TARGETS = [
  "inclusionai/ling-3.0-flash-sante:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "liquid/lfm-2.5-2.6b:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nex-agi/nex-n2.5-pro:free",
];

async function probe(modelId) {
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "What is the capital of France? Answer in one short sentence." }],
        stream: true,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return `HTTP ${r.status} ${t.replace(/\s+/g, " ").slice(0, 110)}`;
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", content = "", reasoning = "", sawDone = false;
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
          if (j.error) return `stream error: ${j.error.message ?? ""}`.slice(0, 120);
          const d = j.choices?.[0]?.delta ?? {};
          if (typeof d.content === "string") content += d.content;
          if (typeof d.reasoning === "string") reasoning += d.reasoning;
        } catch {}
      }
    }
    const cleaned = content.replace(/\s+/g, " ").trim();
    return `${sawDone ? "[done] " : ""}${JSON.stringify(cleaned.slice(0, 80))}${reasoning.length > 0 ? ` +reasoning(${reasoning.length}ch)` : ""}`;
  } catch (e) {
    return `${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 90)}`;
  }
}

for (const id of TARGETS) {
  const detail = await probe(id);
  const ok = detail.startsWith('"') || detail.startsWith("[done]");
  console.log(`${ok ? "PASS" : "FAIL"} ${id} | ${detail}`);
  await new Promise((r) => setTimeout(r, 2000));
}
