/**
 * Natural-language re-probe for NVIDIA candidates: a real chat model
 * answers "Paris..."; classifiers echo JSON, translators echo/translate.
 * max_tokens 600 so reasoning models reach final content.
 * Usage: node scripts/retest-nvidia.mjs
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = "https://integrate.api.nvidia.com/v1";
const key = env.NVIDIA_API_KEY;
if (!key) {
  console.error("NVIDIA_API_KEY not set");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const TARGETS = [
  "deepseek-ai/deepseek-v4-flash-0731",
  "google/diffusiongemma-26b-a4b-it",
  "meta/muse-glimmer-30b",
  "mistralai/mistral-nemotron",
  "nvidia/ising-calibration-1.5-31b",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "openai/gpt-oss-20b",
  "poolside/laguna-xs-2.1",
  "z-ai/glm-5.3-flash",
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
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, detail: `HTTP ${r.status} ${t.slice(0, 120)}` };
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
        if (j.error) return { ok: false, detail: `stream error: ${j.error.message ?? ""}` };
        const d = j.choices?.[0]?.delta ?? {};
        if (typeof d.content === "string") content += d.content;
        if (typeof d.reasoning === "string" || typeof d.reasoning_content === "string")
          reasoning += (d.reasoning ?? d.reasoning_content ?? "");
      } catch {}
    }
  }
  const cleaned = content.replace(/\s+/g, " ").trim();
  return {
    ok: cleaned.length > 0,
    detail: `${sawDone ? "[done] " : ""}${JSON.stringify(cleaned.slice(0, 90))}${reasoning.length > 0 ? ` +reasoning(${reasoning.length}ch)` : ""}`,
  };
  } catch (e) {
    return { ok: false, detail: `${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 100)}` };
  }
}

for (const id of TARGETS) {
  const { ok, detail } = await probe(id);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} | ${detail}`);
  await new Promise((r) => setTimeout(r, 1200));
}
