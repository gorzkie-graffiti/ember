import { getProvider } from "@/lib/models/providers";
import type { ProviderId } from "@/lib/models/types";

/**
 * Human-readable failure message for a failed upstream chat-completions
 * call. Shared by the streaming /api/chat route and the legacy plain-text
 * /v endpoint so both surfaces report provider problems identically.
 */
export function describeUpstreamFailure(
  provider: ProviderId,
  status: number,
  detail: string
): string {
  const name = getProvider(provider).name;
  try {
    const parsed = JSON.parse(detail) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === "string" && parsed.error)
      return `${name}: ${parsed.error}`;
    if (
      parsed.error &&
      typeof parsed.error !== "string" &&
      parsed.error.message
    ) {
      return `${name}: ${parsed.error.message}`;
    }
    if (parsed.message) return `${name}: ${parsed.message}`;
  } catch {
    if (detail.trim()) {
      return `${name} request failed (${status}): ${detail.slice(0, 300)}`;
    }
  }
  if (status === 401 || status === 403) {
    return `${name}: the configured API key was rejected (${status}). Check the key in .env.`;
  }
  return `${name} request failed (${status}).`;
}
