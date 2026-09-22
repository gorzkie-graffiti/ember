/**
 * Live model tester for Ember provider gateways.
 *
 * Usage: node scripts/test-provider-models.mjs <provider>
 *   provider: openrouter | cohere | nvidia | g4f | groq
 *
 * Reads keys from .env (never logs them). Fetches the provider's model
 * list, filters to text→text chat models, and probes each with a minimal
 * streaming chat completion. Prints PASS/FAIL per model with a short
 * reason. Does NOT modify the catalog — results are for human review.
 */
import { readFileSync } from "node:fs";

/* ---------- load .env ---------- */
const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const PROVIDERS = {
  openrouter: {
    keyEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    freeOnly: true,
  },
  cohere: {
    keyEnv: "COHERE_API_KEY",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    freeOnly: false,
  },
  nvidia: {
    keyEnv: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    freeOnly: false,
  },
  g4f: {
    keyEnv: "G4F_API_KEY",
    baseUrl: "https://g4f.space/v1",
    freeOnly: false,
  },
  groq: {
    keyEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    freeOnly: false,
  },
};

const provider = process.argv[2];
const cfg = PROVIDERS[provider];
if (!cfg) {
  console.error(`Unknown provider: ${provider}. Use one of ${Object.keys(PROVIDERS).join(", ")}`);
  process.exit(1);
}
const key = env[cfg.keyEnv];
if (!key) {
  console.error(`${cfg.keyEnv} not set in .env`);
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};
if (provider === "openrouter") {
  headers["HTTP-Referer"] = "https://ember.local";
  headers["X-Title"] = "Ember";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch and list models. */
async function listModels() {
  const r = await fetch(`${cfg.baseUrl}/models`, { headers });
  if (!r.ok) {
    throw new Error(`GET /models -> ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  const j = await r.json();
  const data = Array.isArray(j.data) ? j.data : j.models ?? [];
  return data;
}

/**
 * Probe one model with a tiny streaming chat completion.
 * Returns { ok, detail } — detail is a short human-readable reason.
 */
async function probe(modelId) {
  const body = {
    model: modelId,
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
    stream: true,
    max_tokens: 30,
  };
  try {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} ${text.slice(0, 110)}` };
    }
    if (!r.body) return { ok: false, detail: "no body" };

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let content = "";
    let sawDone = false;
    let errorText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") {
          sawDone = true;
          continue;
        }
        try {
          const j = JSON.parse(payload);
          if (j.error) errorText = j.error.message ?? JSON.stringify(j.error).slice(0, 110);
          const delta = j.choices?.[0]?.delta;
          if (typeof delta?.content === "string") content += delta.content;
          if (typeof delta?.reasoning === "string") content += "";
        } catch {
          /* ignore partial json */
        }
      }
    }
    if (errorText) return { ok: false, detail: `stream error: ${errorText}` };
    if (!sawDone && content.length === 0) {
      return { ok: false, detail: "stream ended with no content and no [DONE]" };
    }
    const cleaned = content.replace(/\s+/g, " ").trim();
    return { ok: true, detail: `content=${JSON.stringify(cleaned.slice(0, 60))}` };
  } catch (e) {
    return { ok: false, detail: `${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 110)}` };
  }
}

/* ---------- main ---------- */
const models = await listModels();
console.log(`Fetched ${models.length} models from ${provider}`);

// Keep text→text chat candidates. Provider payloads vary; be permissive:
// exclude obvious non-chat modalities when the fields exist.
function isChatCandidate(m) {
  const inModalities = m.input_modalities ?? m.architecture?.input_modalities;
  const outModalities = m.output_modalities ?? m.architecture?.output_modalities;
  if (Array.isArray(inModalities) && Array.isArray(outModalities)) {
    return inModalities.includes("text") && outModalities.includes("text");
  }
  // If no modality info at all, keep it and let the probe decide.
  return true;
}

let candidates = models.filter(isChatCandidate);
for (const m of candidates) {
  const id = m.id ?? m.name;
  const pricing = m.pricing ?? {};
  const isFree =
    pricing.prompt === "0" ||
    String(pricing.prompt ?? "").match(/^0(\.0+)?$/) !== null;
  if (cfg.freeOnly && !isFree) continue;
}

if (cfg.freeOnly) {
  const before = candidates.length;
  candidates = candidates.filter((m) => {
    const p = m.pricing ?? {};
    const prompt = String(p.prompt ?? "1");
    const completion = String(p.completion ?? "1");
    // OpenRouter free models are priced 0 (or ":free" suffix ids).
    return (parseFloat(prompt) === 0 && parseFloat(completion) === 0) || String(m.id).endsWith(":free");
  });
  console.log(`Free filter: ${before} -> ${candidates.length}`);
}

console.log(`Probing ${candidates.length} chat candidates...\n`);
const results = [];
let i = 0;
for (const m of candidates) {
  const id = m.id ?? m.name;
  i++;
  const { ok, detail } = await probe(id);
  console.log(`${ok ? "PASS" : "FAIL"} [${i}/${candidates.length}] ${id} | ${detail}`);
  results.push({ id, ok, detail, raw: m });
  await sleep(250); // be polite to rate limits
}

const passed = results.filter((r) => r.ok);
console.log(`\n==== SUMMARY ${provider} ====`);
console.log(`pass ${passed.length} / ${results.length}`);
for (const p of passed) console.log(`  OK  ${p.id}`);
