import {
  PROVIDER_GATEWAYS,
  getProviderKey,
  resolveUpstreamModelId,
  type ProviderKeyOverrides,
} from "@/lib/server/provider-gateways";

/**
 * Shared "curator" model plumbing.
 *
 * Cheap, capable side-channel models used for background jobs (memory
 * extraction, conversation auto-titling). Candidates are tried in order and
 * the first one whose provider has an API key wins; jobs are best-effort and
 * never break chat when none are live.
 */

export interface CuratorCandidate {
  model: string;
  provider: keyof typeof PROVIDER_GATEWAYS;
  envVar: string;
}

export const CURATOR_CANDIDATES: CuratorCandidate[] = [
  { model: "groq/openai/gpt-oss-120b", provider: "groq", envVar: "GROQ_API_KEY" },
  {
    model: "cohere/command-r7b-12-2024",
    provider: "cohere",
    envVar: "COHERE_API_KEY",
  },
  {
    model: "nvidia/openai/gpt-oss-20b",
    provider: "nvidia",
    envVar: "NVIDIA_API_KEY",
  },
  { model: "g4f/models/gemini-2.5-flash", provider: "g4f", envVar: "G4F_API_KEY" },
];

export function pickLiveCurator(
  overrides?: ProviderKeyOverrides,
): CuratorCandidate | null {
  for (const candidate of CURATOR_CANDIDATES) {
    if (getProviderKey(candidate.provider, overrides).length > 0) {
      return candidate;
    }
  }
  return null;
}

/**
 * Run a single-shot completion on the first live curator model.
 * Returns the completion text, or null when no provider is live or the call
 * failed — callers decide whether that's an error or a silent skip.
 */
export async function runCuratorCompletion(
  system: string,
  user: string,
  opts?: {
    maxTokens?: number;
    timeoutMs?: number;
    /** The calling account's own provider keys, used before the shared env. */
    keys?: ProviderKeyOverrides;
  },
): Promise<string | null> {
  const curator = pickLiveCurator(opts?.keys);
  if (!curator) return null;

  const gateway = PROVIDER_GATEWAYS[curator.provider];
  const upstream = resolveUpstreamModelId(curator.model);
  const apiKey = getProviderKey(curator.provider, opts?.keys);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts?.timeoutMs ?? 20_000,
    );
    const resp = await fetch(`${gateway.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: upstream,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: opts?.maxTokens ?? 600,
        temperature: 0,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return content.trim().length > 0 ? content : null;
  } catch {
    return null;
  }
}
