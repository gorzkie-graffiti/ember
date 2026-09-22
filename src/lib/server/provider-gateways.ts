import type { ProviderId } from "@/lib/models/types";
import { getModel } from "@/lib/models/catalog";

/**
 * Server-side provider gateway registry.
 *
 * A provider becomes "live" the moment its API key is present in the
 * environment — i.e. set in `/home/z/my-project/.env` (then restart the
 * dev server; Next.js reads .env at startup). Key VALUES never leave the
 * server: `/api/providers` only reports presence, never content.
 *
 * All external gateways speak the OpenAI-compatible
 * `POST {baseUrl}/chat/completions` streaming protocol, so a single
 * client implementation serves every provider.
 */
export interface ProviderGateway {
  id: ProviderId;
  /** Environment variable that holds the API key. */
  envVar: string;
  /** OpenAI-compatible base URL (ends with the version segment, e.g. /v1). */
  baseUrl: string;
}

export const PROVIDER_GATEWAYS: Record<ProviderId, ProviderGateway> = {
  cohere: {
    id: "cohere",
    envVar: "COHERE_API_KEY",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
  },
  groq: {
    id: "groq",
    envVar: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
  },
  g4f: {
    id: "g4f",
    envVar: "G4F_API_KEY",
    baseUrl: "https://g4f.space/v1",
  },
  nvidia: {
    id: "nvidia",
    envVar: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  },
  openrouter: {
    id: "openrouter",
    envVar: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
  },
};

export function getGateway(id: ProviderId): ProviderGateway | null {
  return PROVIDER_GATEWAYS[id] ?? null;
}

/**
 * Per-account key overrides (provider id → key). Every account brings its own
 * `User.keys` map; when a provider has no personal key we fall back to the
 * deployment's `.env` value.
 */
export type ProviderKeyOverrides = Partial<Record<ProviderId, string>>;

/**
 * Raw key lookup — server only. The value must never leave this module.
 * Personal keys win over the shared `.env` key.
 */
export function getProviderKey(
  id: ProviderId,
  overrides?: ProviderKeyOverrides,
): string {
  const personal = overrides?.[id];
  if (typeof personal === "string" && personal.trim().length > 0) {
    return personal.trim();
  }
  const gateway = getGateway(id);
  if (!gateway) return "";
  const value = process.env[gateway.envVar];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Base URL with an optional per-provider env override, e.g. `GROQ_BASE_URL`
 * (useful for self-hosted OpenAI-compatible proxies like LiteLLM/one-api).
 * Trailing slashes are normalized away.
 */
export function getProviderBaseUrl(id: ProviderId): string {
  const gateway = getGateway(id);
  if (!gateway) return "";
  const overrideName = `${gateway.envVar.replace(/_API_KEY$/, "")}_BASE_URL`;
  const override = process.env[overrideName];
  const value = typeof override === "string" ? override.trim() : "";
  if (value.length > 0) return value.replace(/\/+$/, "");
  return gateway.baseUrl.replace(/\/+$/, "");
}

/**
 * The model id sent upstream. Defaults to the catalog id minus its
 * `provider/` prefix; models whose catalog id diverges from the upstream
 * slug declare an explicit `upstreamModel` in the catalog.
 */
export function resolveUpstreamModelId(catalogModelId: string): string {
  const model = getModel(catalogModelId);
  if (!model) return catalogModelId;
  if (model.upstreamModel) return model.upstreamModel;
  return catalogModelId.slice(model.provider.length + 1);
}

/** True when this deployment can serve the provider right now. */
export function isProviderLive(
  id: ProviderId,
  overrides?: ProviderKeyOverrides,
): boolean {
  return getProviderKey(id, overrides).length > 0;
}

/** The env var that would enable the provider (null if unknown). */
export function getProviderEnvVar(id: ProviderId): string | null {
  return getGateway(id)?.envVar ?? null;
}
