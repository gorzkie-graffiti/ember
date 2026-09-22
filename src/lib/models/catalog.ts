import type {
  EffortLevel,
  ModelCapabilities,
  ModelInfo,
  ProviderId,
  RecommendationCategory,
} from "./types";
import { PROVIDER_IDS, PROVIDERS as PROVIDER_LABELS } from "./providers";

/* ------------------------------------------------------------------ */
/* Capability presets (keeps the catalog declarative)                 */
/* ------------------------------------------------------------------ */

const caps = (overrides: Partial<ModelCapabilities>): ModelCapabilities => ({
  vision: false,
  files: false,
  thinking: false,
  reasoningRequired: false,
  effortLevels: [],
  audioInput: false,
  audioOutput: false,
  chatCompatible: true,
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* Model catalog — 5 providers / 13 chat models                        */
/*                                                                     */
/* Honesty rule: there is NO built-in provider. Every model below is   */
/* served through its provider's OpenAI-compatible gateway and only    */
/* becomes selectable once that provider's API key is present in the   */
/* server environment (see `.env.example`). Reliability/latency for    */
/* unconnected models are static catalog metadata (UI heuristics),     */
/* not measured values.                                                */
/* ------------------------------------------------------------------ */

export const MODEL_CATALOG: ModelInfo[] = [
  /* ---------- Cohere (live-tested 2026-09-13) ----------
   * All entries probed with real chat completions (trial key: 20 req/min
   * had to be paced). Image input on the two vision models timed out at
   * 150s on the trial key — vision stays unverified, so no vision flag.
   * Excluded by test: embed-* / rerank-* (not chat), cohere-transcribe
   * (audio), command-r7b-arabic is included (chat-verified).
   */
  {
    id: "cohere/command-a-plus-05-2026",
    provider: "cohere",
    displayName: "Command A Plus",
    aliases: ["command a plus", "command-a-plus", "cohere command", "command plus", "command"],
    description: "For your toughest challenges",
    reliability: 96,
    avgLatencyMs: 1100,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "cohere/command-a-03-2025",
    provider: "cohere",
    displayName: "Command A",
    aliases: ["command a", "command-a", "cohere command", "command"],
    description: "For complex tasks",
    reliability: 95,
    avgLatencyMs: 1000,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "cohere/command-a-reasoning-08-2025",
    provider: "cohere",
    displayName: "Command A Reasoning",
    aliases: ["command a reasoning", "command reasoning", "cohere reasoning"],
    description: "Deep reasoning for hard problems",
    reliability: 93,
    avgLatencyMs: 1600,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "cohere/command-a-vision-07-2025",
    provider: "cohere",
    displayName: "Command A Vision",
    aliases: ["command a vision", "command vision", "cohere vision"],
    description: "Flagship chat with image understanding",
    reliability: 94,
    avgLatencyMs: 1300,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/c4ai-aya-expanse-32b",
    provider: "cohere",
    displayName: "Aya Expanse 32B",
    aliases: ["aya", "aya expanse", "aya expanse 32b", "multilingual", "c4ai"],
    description: "Strong multilingual coverage",
    reliability: 94,
    avgLatencyMs: 900,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/c4ai-aya-vision-32b",
    provider: "cohere",
    displayName: "Aya Vision 32B",
    aliases: ["aya vision", "aya vision 32b", "c4ai vision"],
    description: "Multilingual chat with image understanding",
    reliability: 92,
    avgLatencyMs: 1200,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/command-r-plus-08-2024",
    provider: "cohere",
    displayName: "Command R Plus",
    aliases: ["command r plus", "command-r-plus", "r plus"],
    description: "Retrieval-augmented workhorse",
    reliability: 93,
    avgLatencyMs: 1400,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/command-r-08-2024",
    provider: "cohere",
    displayName: "Command R",
    aliases: ["command r", "command-r"],
    description: "Efficient RAG chat",
    reliability: 91,
    avgLatencyMs: 800,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/command-r7b-12-2024",
    provider: "cohere",
    displayName: "Command R 7B",
    aliases: ["command r 7b", "r7b", "command r7b"],
    description: "Compact and fast for everyday tasks",
    reliability: 89,
    avgLatencyMs: 500,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/command-r7b-arabic-02-2025",
    provider: "cohere",
    displayName: "Command R 7B Arabic",
    aliases: ["command arabic", "r7b arabic", "arabic"],
    description: "Arabic-optimized compact chat",
    reliability: 88,
    avgLatencyMs: 550,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/command-a-translate-08-2025",
    provider: "cohere",
    displayName: "Command A Translate",
    aliases: ["command translate", "cohere translate", "translation"],
    description: "High-fidelity translation",
    reliability: 90,
    avgLatencyMs: 700,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/tiny-aya-earth",
    provider: "cohere",
    displayName: "Tiny Aya Earth",
    aliases: ["aya earth", "tiny aya", "earth"],
    description: "Featherweight multilingual chat",
    reliability: 85,
    avgLatencyMs: 350,
    contextWindow: "8k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/tiny-aya-global",
    provider: "cohere",
    displayName: "Tiny Aya Global",
    aliases: ["aya global", "tiny global", "global"],
    description: "Broad language coverage, tiny footprint",
    reliability: 85,
    avgLatencyMs: 350,
    contextWindow: "8k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/tiny-aya-water",
    provider: "cohere",
    displayName: "Tiny Aya Water",
    aliases: ["aya water", "tiny water", "water"],
    description: "Quick multilingual replies",
    reliability: 85,
    avgLatencyMs: 350,
    contextWindow: "8k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "cohere/north-mini-code-1-0",
    provider: "cohere",
    displayName: "North Mini Code",
    aliases: ["north code", "north mini", "cohere code"],
    description: "Compact coding assistant",
    reliability: 90,
    avgLatencyMs: 650,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "cohere/north-small-translate-09-2026",
    provider: "cohere",
    displayName: "North Small Translate",
    aliases: ["north translate", "north small"],
    description: "Lightweight translation model",
    reliability: 88,
    avgLatencyMs: 500,
    contextWindow: "128k",
    connected: false,
    capabilities: caps({}),
  },

  /* ---------- Groq (live-tested 2026-09-13) ----------
   * Every entry below was verified against the live API:
   *   GET /openai/v1/models  → 14 models; audio (whisper), speech
   *   (orpheus) and the llama-prompt-guard safety classifiers were
   *   excluded — the rest answered chat completions AND streamed
   *   correctly. qwen3.6-27b also works but was dropped in favor of
   *   its newer sibling: it emits raw inline <think> tags in content.
   * Capabilities (vision / thinking) come from the API's
   * `input_modalities` / `supported_features`, confirmed by test.
   */
  {
    id: "groq/openai/gpt-oss-120b",
    provider: "groq",
    displayName: "GPT-OSS 120B",
    aliases: ["gpt-oss", "gpt oss 120b", "oss 120b", "openai"],
    description: "For your toughest challenges",
    reliability: 95,
    avgLatencyMs: 700,
    contextWindow: "131k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "groq/openai/gpt-oss-20b",
    provider: "groq",
    displayName: "GPT-OSS 20B",
    aliases: ["gpt-oss", "gpt oss 20b", "oss 20b", "openai"],
    description: "Fastest for quick answers",
    reliability: 94,
    avgLatencyMs: 600,
    contextWindow: "131k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "groq/groq/compound",
    provider: "groq",
    displayName: "Compound",
    aliases: ["compound", "groq compound", "agentic", "tool use"],
    description: "Agentic assistant with tool use",
    reliability: 92,
    avgLatencyMs: 1200,
    contextWindow: "131k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "groq/groq/compound-mini",
    provider: "groq",
    displayName: "Compound Mini",
    aliases: ["compound mini", "groq compound mini", "mini", "agentic"],
    description: "Fast agentic assistant with tool use",
    reliability: 91,
    avgLatencyMs: 900,
    contextWindow: "131k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "groq/qwen/qwen3.8-27b",
    provider: "groq",
    displayName: "Qwen3.8 27B",
    aliases: ["qwen", "qwen3.8", "qwen 3.8", "qwen3.8 27b", "vision"],
    description: "Vision-capable with thinking for complex tasks",
    reliability: 93,
    avgLatencyMs: 950,
    contextWindow: "131k",
    connected: false,
    capabilities: caps({ vision: true, thinking: true }),
  },
  {
    id: "groq/allam-2-7b",
    provider: "groq",
    displayName: "ALLaM 2 7B",
    aliases: ["allam", "allam 2", "allam 7b", "arabic"],
    description: "Compact multilingual (Arabic/English) model",
    reliability: 88,
    avgLatencyMs: 500,
    contextWindow: "4k",
    connected: false,
    capabilities: caps({}),
  },
  {
    id: "groq/openai/gpt-oss-safeguard-20b",
    provider: "groq",
    displayName: "GPT-OSS Safeguard 20B",
    aliases: ["safeguard", "gpt oss safeguard", "safety", "moderation"],
    description: "Safety-tuned GPT-OSS for guarded workloads",
    reliability: 90,
    avgLatencyMs: 650,
    contextWindow: "131k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },

  /* ---------- G4F (live-tested 2026-09-13) ----------
   * Upstream ids are server-scoped (`srv_<hash>:<slug>`); the bare
   * `models/gemini-*` ids ALSO work, so catalog ids stay short and
   * upstreamModel carries the exact working slug. Vision was NOT verified
   * by image test (probe never reached image input) — flags dropped.
   * Excluded by test: relays 400'ing upstream (gpt-oss-120b, qwen3.8,
   * groq/compound on that server), deepseek relay (upstream key invalid),
   * kimi-k3 relay and auto router (persistent timeouts), uncensored/
   * community GGUF listings (unsafe provenance).
   */
  {
    id: "g4f/models/gemini-3.5-flash",
    provider: "g4f",
    displayName: "Gemini 3.5 Flash",
    aliases: ["gemini", "gemini 3.5", "gemini flash", "google"],
    description: "For complex tasks",
    reliability: 93,
    avgLatencyMs: 800,
    contextWindow: "1M",
    connected: false,
    upstreamModel: "models/gemini-3.5-flash",
    capabilities: caps({}),
  },
  {
    id: "g4f/models/gemini-2.5-flash",
    provider: "g4f",
    displayName: "Gemini 2.5 Flash",
    aliases: ["gemini 2.5", "gemini flash 2.5", "google flash"],
    description: "Most efficient for everyday tasks",
    reliability: 94,
    avgLatencyMs: 750,
    contextWindow: "1M",
    connected: false,
    upstreamModel: "models/gemini-2.5-flash",
    capabilities: caps({}),
  },
  {
    id: "g4f/models/gemini-3.1-flash-lite",
    provider: "g4f",
    displayName: "Gemini 3.1 Flash Lite",
    aliases: ["gemini 3.1", "flash lite", "gemini lite"],
    description: "Fastest for quick answers",
    reliability: 92,
    avgLatencyMs: 650,
    contextWindow: "1M",
    connected: false,
    upstreamModel: "models/gemini-3.1-flash-lite",
    capabilities: caps({}),
  },
  {
    id: "g4f/claude-sonnet-4-5",
    provider: "g4f",
    displayName: "Claude Sonnet 4.5",
    aliases: ["claude", "sonnet", "claude sonnet", "sonnet 4.5"],
    description: "Frontier quality for hard tasks",
    reliability: 94,
    avgLatencyMs: 1500,
    contextWindow: "200k",
    connected: false,
    upstreamModel: "srv_mp1v9cyha31b95fa8c9a:anthropic/claude-sonnet-4-5",
    capabilities: caps({}),
  },
  {
    id: "g4f/claude-haiku-4-5",
    provider: "g4f",
    displayName: "Claude Haiku 4.5",
    aliases: ["haiku", "claude haiku", "haiku 4.5"],
    description: "Fast frontier chat",
    reliability: 92,
    avgLatencyMs: 900,
    contextWindow: "200k",
    connected: false,
    upstreamModel: "srv_mp1v9cyha31b95fa8c9a:anthropic/claude-haiku-4-5",
    capabilities: caps({}),
  },
  {
    id: "g4f/glm-5.3",
    provider: "g4f",
    displayName: "GLM 5.3",
    aliases: ["glm", "glm 5.3", "z ai"],
    description: "Z.ai flagship chat",
    reliability: 91,
    avgLatencyMs: 1100,
    contextWindow: "128k",
    connected: false,
    upstreamModel: "srv_mp1v9cyha31b95fa8c9a:z-ai/glm-5.3",
    capabilities: caps({}),
  },
  {
    id: "g4f/grok-4-fast",
    provider: "g4f",
    displayName: "Grok 4 Fast",
    aliases: ["grok", "grok 4", "grok fast"],
    description: "Speedy xAI chat",
    reliability: 90,
    avgLatencyMs: 950,
    contextWindow: "256k",
    connected: false,
    upstreamModel: "srv_mtsj8uzo97d3c0d49960:xai-z/grok-4-fast-non-reasoning",
    capabilities: caps({}),
  },
  {
    id: "g4f/muse-glimmer-30b",
    provider: "g4f",
    displayName: "Muse Glimmer 30B",
    aliases: ["muse glimmer", "glimmer g4f", "muse"],
    description: "Creative reasoning companion",
    reliability: 88,
    avgLatencyMs: 1000,
    contextWindow: "128k",
    connected: false,
    upstreamModel: "srv_mkombumpae45db46dcb8:meta/muse-glimmer-30b",
    capabilities: caps({}),
  },

  /* ---------- NVIDIA (live-tested 2026-09-13) ----------
   * 82 ids listed upstream; ~55 are delisted (404 on every call). The
   * entries below all passed a natural-language chat probe. Excluded by
   * test: content-safety / safety-guard classifiers, riva-translate
   * (echoes/translates instead of chatting), nemotron-parse (no text
   * input), mistral-nemotron (persistent timeouts + 500s), and the
   * 404'd llama-3.3-nemotron-super-49b-v1.5 (removed from catalog).
   */
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    provider: "nvidia",
    displayName: "Nemotron 3 Ultra 550B",
    aliases: ["nemotron", "nemotron ultra", "nemotron 3", "nvidia"],
    description: "For your toughest challenges",
    reliability: 96,
    avgLatencyMs: 1400,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    provider: "nvidia",
    displayName: "Nemotron 3 Super 120B",
    aliases: ["nemotron super", "nemotron 120b", "super 120b"],
    description: "For complex tasks",
    reliability: 94,
    avgLatencyMs: 1100,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    provider: "nvidia",
    displayName: "Nemotron 3.5 Lightning 30B",
    aliases: ["lightning", "nemotron lightning", "nemotron 3.5"],
    description: "Lightning-fast reasoning",
    reliability: 93,
    avgLatencyMs: 700,
    contextWindow: "256k",
    connected: false,
    caveat: "This model may leak its CoT in responses",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    provider: "nvidia",
    displayName: "Nemotron 3 Nano Omni 30B",
    aliases: ["nano omni", "nemotron nano", "omni"],
    description: "Compact reasoning with multimodal training",
    reliability: 91,
    avgLatencyMs: 800,
    contextWindow: "256k",
    connected: false,
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/deepseek-ai/deepseek-v4-flash-0731",
    provider: "nvidia",
    displayName: "DeepSeek V4 Flash",
    aliases: ["deepseek", "deepseek v4", "deepseek flash"],
    description: "Fast deep-reasoning chat",
    reliability: 93,
    avgLatencyMs: 900,
    contextWindow: "164k",
    connected: false,
    upstreamModel: "deepseek-ai/deepseek-v4-flash-0731",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/meta/llama-3.2-11b-vision-instruct",
    provider: "nvidia",
    displayName: "Llama 3.2 Vision 11B",
    aliases: ["llama vision", "llama 3.2", "nvidia llama"],
    description: "Multimodal chat for everyday tasks",
    reliability: 90,
    avgLatencyMs: 950,
    contextWindow: "128k",
    connected: false,
    upstreamModel: "meta/llama-3.2-11b-vision-instruct",
    capabilities: caps({}),
  },
  {
    id: "nvidia/moonshotai/kimi-k3",
    provider: "nvidia",
    displayName: "Kimi K3",
    aliases: ["kimi", "kimi k3", "moonshot"],
    description: "Long-context reasoning assistant",
    reliability: 92,
    avgLatencyMs: 1300,
    contextWindow: "256k",
    connected: false,
    upstreamModel: "moonshotai/kimi-k3",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/meta/muse-glimmer-30b",
    provider: "nvidia",
    displayName: "Muse Glimmer 30B",
    aliases: ["muse", "muse glimmer", "glimmer"],
    description: "Creative reasoning companion",
    reliability: 90,
    avgLatencyMs: 1000,
    contextWindow: "128k",
    connected: false,
    upstreamModel: "meta/muse-glimmer-30b",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/nvidia/ising-calibration-1.5-31b",
    provider: "nvidia",
    displayName: "Ising Calibration 31B",
    aliases: ["ising", "ising calibration", "calibration"],
    description: "Research-grade calibrated chat",
    reliability: 87,
    avgLatencyMs: 1100,
    contextWindow: "128k",
    connected: false,
    upstreamModel: "nvidia/ising-calibration-1.5-31b",
    capabilities: caps({}),
  },
  {
    id: "nvidia/google/diffusiongemma-26b-a4b-it",
    provider: "nvidia",
    displayName: "DiffusionGemma 26B",
    aliases: ["diffusiongemma", "diffusion gemma", "gemma nvidia"],
    description: "Diffusion-based Gemma chat",
    reliability: 88,
    avgLatencyMs: 900,
    contextWindow: "128k",
    connected: false,
    upstreamModel: "google/diffusiongemma-26b-a4b-it",
    capabilities: caps({}),
  },
  {
    id: "nvidia/openai/gpt-oss-20b",
    provider: "nvidia",
    displayName: "GPT-OSS 20B (NVIDIA)",
    aliases: ["gpt oss nvidia", "oss 20b nvidia"],
    description: "OpenAI OSS weights on NVIDIA infra",
    reliability: 91,
    avgLatencyMs: 750,
    contextWindow: "131k",
    connected: false,
    upstreamModel: "openai/gpt-oss-20b",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "nvidia/poolside/laguna-xs-2.1",
    provider: "nvidia",
    displayName: "Laguna XS 2.1",
    aliases: ["laguna", "laguna xs", "poolside"],
    description: "Code-fluent compact assistant",
    reliability: 89,
    avgLatencyMs: 800,
    contextWindow: "—",
    connected: false,
    upstreamModel: "poolside/laguna-xs-2.1",
    capabilities: caps({}),
  },
  {
    id: "nvidia/z-ai/glm-5.3-flash",
    provider: "nvidia",
    displayName: "GLM 5.3 Flash (NVIDIA)",
    aliases: ["glm nvidia", "glm flash nvidia", "z ai nvidia"],
    description: "Z.ai GLM on NVIDIA infra",
    reliability: 90,
    avgLatencyMs: 800,
    contextWindow: "128k",
    connected: false,
    upstreamModel: "z-ai/glm-5.3-flash",
    capabilities: caps({ thinking: true }),
  },

  /* ---------- OpenRouter (live-tested 2026-09-13, free tier only) ----------
   * 445 listed upstream, 22 priced :free today. Excluded by test:
   * nemotron-3.5-content-safety:free (classifier),
   * inkling ×2 (403, agentic-harness-only), gemma-4 ×2 :free (persistent
   * 429 — could not verify), lyria ×2 (music models). Daily free quota
   * is limited; free entries may rate-limit under load.
   */
  {
    id: "openrouter/free",
    provider: "openrouter",
    displayName: "OpenRouter Auto",
    aliases: ["free", "openrouter free", "auto route", "router", "auto"],
    description: "Auto-routes to the best model for your prompt",
    reliability: 90,
    avgLatencyMs: 1500,
    contextWindow: "Varies",
    connected: false,
    upstreamModel: "openrouter/auto",
    capabilities: caps({}),
  },
  {
    id: "openrouter/nex-agi/nex-n2.5-pro:free",
    provider: "openrouter",
    displayName: "Nex N2.5 Pro",
    aliases: ["nex pro", "nex n2.5", "nexagi"],
    description: "Free frontier-class reasoning",
    reliability: 89,
    avgLatencyMs: 1800,
    contextWindow: "262k",
    connected: false,
    upstreamModel: "nex-agi/nex-n2.5-pro:free",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "openrouter/nex-agi/nex-n2.5-mini:free",
    provider: "openrouter",
    displayName: "Nex N2.5 Mini",
    aliases: ["nex mini", "nex n2.5 mini"],
    description: "Free everyday reasoning",
    reliability: 87,
    avgLatencyMs: 1200,
    contextWindow: "262k",
    connected: false,
    upstreamModel: "nex-agi/nex-n2.5-mini:free",
    capabilities: caps({}),
  },
  {
    id: "openrouter/inclusionai/ling-3.0-flash-vl:free",
    provider: "openrouter",
    displayName: "Ling 3.0 Flash VL",
    aliases: ["ling", "ling vl", "ling flash"],
    description: "Vision-language chat, free tier",
    reliability: 88,
    avgLatencyMs: 1300,
    contextWindow: "262k",
    connected: false,
    upstreamModel: "inclusionai/ling-3.0-flash-vl:free",
    capabilities: caps({}),
  },
  {
    id: "openrouter/inclusionai/ling-3.0-flash-sante:free",
    provider: "openrouter",
    displayName: "Ling 3.0 Flash Sante",
    aliases: ["ling sante", "ling health"],
    description: "Health-focused Ling variant",
    reliability: 86,
    avgLatencyMs: 1400,
    contextWindow: "262k",
    connected: false,
    upstreamModel: "inclusionai/ling-3.0-flash-sante:free",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "openrouter/inclusionai/ling-3.0-flash-fin:free",
    provider: "openrouter",
    displayName: "Ling 3.0 Flash Fin",
    aliases: ["ling fin", "ling finance"],
    description: "Finance-tuned Ling variant",
    reliability: 86,
    avgLatencyMs: 1400,
    contextWindow: "262k",
    connected: false,
    upstreamModel: "inclusionai/ling-3.0-flash-fin:free",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "openrouter/dots-studio/dots-3-note-preview:free",
    provider: "openrouter",
    displayName: "Dots 3 Note",
    aliases: ["dots", "dots note", "dots 3"],
    description: "Long-context free preview",
    reliability: 87,
    avgLatencyMs: 1600,
    contextWindow: "512k",
    connected: false,
    upstreamModel: "dots-studio/dots-3-note-preview:free",
    capabilities: caps({}),
  },
  {
    id: "openrouter/liquid/lfm-2.5-2.6b:free",
    provider: "openrouter",
    displayName: "LFM 2.5 2.6B",
    aliases: ["lfm", "liquid", "lfm 2.5"],
    description: "Tiny and fast free chat",
    reliability: 84,
    avgLatencyMs: 600,
    contextWindow: "65k",
    connected: false,
    upstreamModel: "liquid/lfm-2.5-2.6b:free",
    capabilities: caps({}),
  },
  {
    id: "openrouter/nvidia/nemotron-3.5-lightning:free",
    provider: "openrouter",
    displayName: "Nemotron 3.5 Lightning",
    aliases: ["lightning free", "nemotron lightning free"],
    description: "Lightning-fast reasoning, free tier",
    reliability: 86,
    avgLatencyMs: 1200,
    contextWindow: "1M",
    connected: false,
    upstreamModel: "nvidia/nemotron-3.5-lightning:free",
    caveat: "This model may leak its CoT in responses",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
    provider: "openrouter",
    displayName: "Nemotron 3 Ultra 550B",
    aliases: ["nemotron ultra free", "ultra 550b free"],
    description: "Free flagship reasoning, 1M context",
    reliability: 88,
    avgLatencyMs: 2200,
    contextWindow: "1M",
    connected: false,
    upstreamModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    caveat: "This model may leak its CoT in responses",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "openrouter/nvidia/nemotron-3-super-120b-a12b:free",
    provider: "openrouter",
    displayName: "Nemotron 3 Super 120B",
    aliases: ["nemotron super free", "super 120b free"],
    description: "Free long-context reasoning",
    reliability: 87,
    avgLatencyMs: 1600,
    contextWindow: "262k",
    connected: false,
    upstreamModel: "nvidia/nemotron-3-super-120b-a12b:free",
    caveat: "This model may leak its CoT in responses",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "openrouter/cohere/north-mini-code:free",
    provider: "openrouter",
    displayName: "North Mini Code",
    aliases: ["north mini code", "north code free"],
    description: "Free coding assistant",
    reliability: 88,
    avgLatencyMs: 1100,
    contextWindow: "256k",
    connected: false,
    upstreamModel: "cohere/north-mini-code:free",
    capabilities: caps({ thinking: true }),
  },
  {
    id: "openrouter/poolside/laguna-s-2.1:free",
    provider: "openrouter",
    displayName: "Laguna S 2.1",
    aliases: ["laguna s", "laguna free"],
    description: "Code-fluent free chat",
    reliability: 87,
    avgLatencyMs: 1300,
    contextWindow: "—",
    connected: false,
    upstreamModel: "poolside/laguna-s-2.1:free",
    capabilities: caps({}),
  },
  {
    id: "openrouter/poolside/laguna-xs-2.1:free",
    provider: "openrouter",
    displayName: "Laguna XS 2.1",
    aliases: ["laguna xs", "poolside free"],
    description: "Compact code-aware free chat",
    reliability: 86,
    avgLatencyMs: 1100,
    contextWindow: "—",
    connected: false,
    upstreamModel: "poolside/laguna-xs-2.1:free",
    capabilities: caps({}),
  },
  {
    id: "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    provider: "openrouter",
    displayName: "Nemotron 3 Nano Omni",
    aliases: ["nano omni free", "nemotron nano free"],
    description: "Free compact reasoning",
    reliability: 86,
    avgLatencyMs: 1200,
    contextWindow: "256k",
    connected: false,
    upstreamModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    capabilities: caps({ thinking: true }),
  },
];

/* ------------------------------------------------------------------ */
/* Recommended models (picker level 1)                                 */
/*                                                                     */
/* The four categories point at catalog models that light up as soon   */
/* as their provider key is added — the cards stay visible either way  */
/* and render "Not connected" until then.                              */
/* ------------------------------------------------------------------ */

export const RECOMMENDED_MODEL_IDS = [
  "cohere/command-a-plus-05-2026", // For your toughest challenges
  "groq/openai/gpt-oss-120b", // For complex tasks
  "g4f/models/gemini-2.5-flash", // Most efficient for everyday tasks ← default
  "groq/openai/gpt-oss-20b", // Fastest for quick answers
] as const;

/** The model selected by default: "Most efficient for everyday tasks" */
export const DEFAULT_MODEL_ID = "groq/openai/gpt-oss-120b";

export const DEFAULT_EFFORT: EffortLevel = "medium";
export const DEFAULT_THINKING = true;

export const RECOMMENDATION_LABELS: Record<
  RecommendationCategory,
  { title: string; short: string }
> = {
  toughest: {
    title: "For your toughest challenges",
    short: "Toughest challenges",
  },
  complex: { title: "For complex tasks", short: "Complex tasks" },
  everyday: {
    title: "Most efficient for everyday tasks",
    short: "Everyday efficiency",
  },
  fastest: { title: "Fastest for quick answers", short: "Quick answers" },
};

/* ------------------------------------------------------------------ */
/* Lookups & queries                                                   */
/* ------------------------------------------------------------------ */

export function getModel(id: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

export function getModelOrThrow(id: string): ModelInfo {
  const model = getModel(id);
  if (!model) throw new Error(`Unknown model: ${id}`);
  return model;
}

/** Chat-compatible models only — what the chat model picker may show. */
export function getChatModels(): ModelInfo[] {
  return MODEL_CATALOG.filter((m) => m.capabilities.chatCompatible);
}

/** Models this deployment's backend can actually serve. */
export function getConnectedModels(): ModelInfo[] {
  return getChatModels().filter((m) => m.connected);
}

/** All models grouped by provider (catalog order preserved). */
export function getModelsGroupedByProvider(): Array<{
  providerId: ProviderId;
  models: ModelInfo[];
}> {
  return PROVIDER_IDS.map((providerId) => ({
    providerId,
    models: getChatModels().filter((m) => m.provider === providerId),
  })).filter((g) => g.models.length > 0);
}

export function getRecommendedModels(): Array<{
  category: RecommendationCategory;
  model: ModelInfo;
}> {
  const categories: RecommendationCategory[] = [
    "toughest",
    "complex",
    "everyday",
    "fastest",
  ];
  return RECOMMENDED_MODEL_IDS.map((modelId, i) => ({
    category: categories[i],
    model: getModelOrThrow(modelId),
  }));
}

/**
 * Vision-capable chat models, best reliability first.
 *
 * NOTE: this is the static catalog baseline only. Callers MUST filter the
 * result through the model store's runtime provider liveness (`isModelLive`)
 * so images are only ever analyzed by a model the backend can actually
 * serve right now.
 */
export function getVisionModels(): ModelInfo[] {
  return getChatModels()
    .filter((m) => m.capabilities.vision)
    .sort((a, b) => b.reliability - a.reliability);
}

/**
 * Search chat models by name, alias, description and provider name.
 * Results are sorted by reliability score (descending). Unconnected
 * (catalog-only) models may appear — the picker renders them disabled.
 */
export function searchChatModels(query: string): ModelInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getChatModels()
    .filter((m) => {
      const haystack = [
        m.displayName.toLowerCase(),
        ...m.aliases,
        m.description.toLowerCase(),
        m.provider,
        PROVIDER_LABELS[m.provider]?.name.toLowerCase() ?? m.provider,
      ].join(" ");
      return haystack.includes(q);
    })
    .sort((a, b) => b.reliability - a.reliability);
}

export function reliabilityTone(reliability: number): "high" | "medium" | "low" {
  if (reliability >= 96) return "high";
  if (reliability >= 92) return "medium";
  return "low";
}
