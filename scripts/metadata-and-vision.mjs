/**
 * 1) Pull context-window metadata for the verified model ids.
 * 2) Test real image input (64x64 red PNG) on vision candidates.
 * Usage: node scripts/metadata-and-vision.mjs
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const PROVIDERS = {
  cohere: { key: env.COHERE_API_KEY, url: "https://api.cohere.ai/compatibility/v1" },
  nvidia: { key: env.NVIDIA_API_KEY, url: "https://integrate.api.nvidia.com/v1" },
  openrouter: { key: env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1", extra: { "HTTP-Referer": "https://ember.local", "X-Title": "Ember" } },
};

const WANT = {
  cohere: [
    "command-a-plus-05-2026", "command-a-03-2025", "command-a-reasoning-08-2025",
    "command-a-vision-07-2025", "command-a-translate-08-2025", "c4ai-aya-expanse-32b",
    "c4ai-aya-vision-32b", "command-r-plus-08-2024", "command-r-08-2024",
    "command-r7b-12-2024", "command-r7b-arabic-02-2025", "tiny-aya-earth",
    "tiny-aya-global", "tiny-aya-water", "north-mini-code-1-0", "north-small-translate-09-2026",
  ],
  nvidia: [
    "deepseek-ai/deepseek-v4-flash-0731", "google/diffusiongemma-26b-a4b-it",
    "meta/muse-glimmer-30b", "meta/llama-3.2-11b-vision-instruct", "moonshotai/kimi-k3",
    "nvidia/ising-calibration-1.5-31b", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-ultra-550b-a55b",
    "nvidia/nemotron-3.5-lightning-30b-a3b", "openai/gpt-oss-20b",
    "poolside/laguna-xs-2.1", "z-ai/glm-5.3-flash",
  ],
  openrouter: [
    "inclusionai/ling-3.0-flash-vl:free", "inclusionai/ling-3.0-flash-sante:free",
    "inclusionai/ling-3.0-flash-fin:free", "nex-agi/nex-n2.5-mini:free",
    "nex-agi/nex-n2.5-pro:free", "dots-studio/dots-3-note-preview:free",
    "liquid/lfm-2.5-2.6b:free", "cohere/north-mini-code:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
  ],
};

const png = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAKklEQVR4nO3NMQEAwAgEwBv8//8uUyhvTQYwMDCgoKBABgYGBoaGhpaWlv8aK2YCAAGAH4cJAAAAAElFTkSuQmCC";
const VISION_TARGETS = [
  { provider: "cohere", model: "c4ai-aya-vision-32b" },
  { provider: "cohere", model: "command-a-vision-07-2025" },
  { provider: "nvidia", model: "meta/llama-3.2-11b-vision-instruct" },
  { provider: "openrouter", model: "inclusionai/ling-3.0-flash-vl:free" },
];

/* ---------- 1) metadata ---------- */
for (const [name, cfg] of Object.entries(PROVIDERS)) {
  try {
    const r = await fetch(`${cfg.url}/models`, {
      headers: { Authorization: `Bearer ${cfg.key}`, ...(cfg.extra ?? {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) { console.log(`[${name}] list HTTP ${r.status}`); continue; }
    const j = await r.json();
    const data = Array.isArray(j.data) ? j.data : j.models ?? [];
    console.log(`---- ${name} metadata (${data.length} listed) ----`);
    for (const want of WANT[name]) {
      const m = data.find((x) => (x.id ?? x.name) === want);
      if (!m) { console.log(`  ${want} | NOT IN LIST`); continue; }
      const ctx = m.context_length ?? m.context_window ?? m.top_provider?.context_length ?? "?";
      console.log(`  ${want} | ctx=${ctx}`);
    }
  } catch (e) {
    console.log(`[${name}] ERR ${e.message}`);
  }
}

/* ---------- 2) vision tests ---------- */
console.log("\n---- vision image tests ----");
for (const t of VISION_TARGETS) {
  const cfg = PROVIDERS[t.provider];
  try {
    const r = await fetch(`${cfg.url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", ...(cfg.extra ?? {}) },
      body: JSON.stringify({
        model: t.model,
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "What color is this image? One word." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.log(`VISION FAIL ${t.provider}/${t.model} | HTTP ${r.status} ${body.replace(/\s+/g, " ").slice(0, 90)}`);
      continue;
    }
    const j = await r.json();
    const content = (j.choices?.[0]?.message?.content ?? "").replace(/\s+/g, " ").trim();
    console.log(`VISION ${content ? "PASS" : "FAIL"} ${t.provider}/${t.model} | ${JSON.stringify(content.slice(0, 60))}`);
  } catch (e) {
    console.log(`VISION FAIL ${t.provider}/${t.model} | ${e?.name}: ${String(e?.message ?? "").slice(0, 80)}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
