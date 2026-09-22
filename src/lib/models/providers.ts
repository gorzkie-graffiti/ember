import type { ProviderId, ProviderInfo } from "./types";

/**
 * Provider configuration — accent colors live HERE, not in components.
 * Components read provider accent via `getProvider(providerId).accent`.
 *
 * Honesty note: being listed here does NOT mean the backend can serve a
 * provider. Every provider below is catalog-visible only (see
 * `ModelInfo.connected`) until its API key is added to the server env.
 */
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  cohere: {
    id: "cohere",
    name: "Cohere",
    logo: "/provider-logos/cohere.svg",
    accent: "#D18EE2",
    tagline: "Enterprise-grade language models",
  },
  groq: {
    id: "groq",
    name: "Groq",
    logo: "/provider-logos/groq.svg",
    accent: "#F55036",
    tagline: "Ultra-low latency inference",
  },
  g4f: {
    id: "g4f",
    name: "G4F",
    logo: "/provider-logos/g4f.svg",
    accent: "#22C5A9",
    tagline: "Free multi-provider gateway",
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA",
    logo: "/provider-logos/nvidia.svg",
    accent: "#76B900",
    tagline: "NIM microservices on accelerated hardware",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    logo: "/provider-logos/openrouter.svg",
    accent: "#E8A33D",
    tagline: "One API, every frontier model",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function getProvider(id: ProviderId): ProviderInfo {
  return PROVIDERS[id];
}
