import { PROVIDER_IDS } from "@/lib/models/providers";
import type { ProviderId } from "@/lib/models/types";
import {
  getProviderEnvVar,
  isProviderLive,
} from "@/lib/server/provider-gateways";
import { authGuard } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProviderStatus {
  id: ProviderId;
  /** Whether this account can use the provider right now. */
  live: boolean;
  /** Which .env variable enables it (null if the provider is unknown). */
  envVar: string | null;
}

/**
 * Reports which providers this account can use. A provider is live when either
 * the signed-in user has supplied their own key or the deployment has one in
 * `.env`. Presence only — key values are NEVER included in the response.
 */
export async function GET() {
  const { user, response } = await authGuard();
  if (!user) return response;

  const providers: ProviderStatus[] = PROVIDER_IDS.map((id) => ({
    id,
    live: isProviderLive(id, user.keys),
    envVar: getProviderEnvVar(id),
  }));

  return Response.json(
    { providers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
