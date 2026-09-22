/**
 * One retry with long budgets (150s) for NVIDIA models that timed out at
 * 45s in the first pass, using the natural-language prompt.
 * Usage: node scripts/retry-nvidia-timeouts.mjs
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = "https://integrate.api.nvidia.com/v1";
const headers = { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, "Content-Type": "application/json" };

const TARGETS = [
  "deepseek-ai/deepseek-v4-pro-0813",
  "google/gemma-4-31b-it",
  "meta/llama-3.2-11b-vision-instruct",
  "meta/llama-3.2-90b-vision-instruct",
  "moonshotai/kimi-k3",
  "mistralai/mistral-nemotron",
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
      signal: AbortSignal.timeout(150_000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return `HTTP ${r.status} ${t.slice(0, 100)}`;
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
          if (j.error) return `stream error: ${j.error.message ?? ""}`;
          const d = j.choices?.[0]?.delta ?? {};
          if (typeof d.content === "string") content += d.content;
          if (typeof d.reasoning === "string" || typeof d.reasoning_content === "string")
            reasoning += (d.reasoning ?? d.reasoning_content ?? "");
        } catch {}
      }
    }
    const cleaned = content.replace(/\s+/g, " ").trim();
    return `${sawDone ? "[done] " : ""}${JSON.stringify(cleaned.slice(0, 80))}${reasoning.length > 0 ? ` +reasoning(${reasoning.length}ch)` : ""}`;
  } catch (e) {
    return `${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 80)}`;
  }
}

for (const id of TARGETS) {
  const detail = await probe(id);
  console.log(`${detail.startsWith('"') || detail.startsWith("[done]") ? "PASS" : "FAIL"} ${id} | ${detail}`);
  await new Promise((r) => setTimeout(r, 1500));
}
