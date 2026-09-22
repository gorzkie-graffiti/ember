import { getModel, getVisionModels } from "@/lib/models/catalog";
import {
  getGateway,
  getProviderBaseUrl,
  getProviderKey,
  resolveUpstreamModelId,
  type ProviderKeyOverrides,
} from "@/lib/server/provider-gateways";
import { authGuard } from "@/lib/auth/server";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VISION_TIMEOUT_MS = 60_000

const DEFAULT_INSTRUCTIONS = {
  analyze: 'Describe this image thoroughly: what it shows, any text, layout, and notable details.',
  ocr: 'Transcribe ALL text in this image verbatim, preserving structure, output as markdown. If no text exists, say so.',
} as const

interface VisionRequestBody {
  image?: unknown
  task?: unknown
  prompt?: unknown
  /** Catalog id of the vision model to use (from the fallback dialog). */
  modelId?: unknown
}

interface VisionCompletion {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * Pick the vision model to analyze with. An explicitly requested catalog id
 * wins when it is a vision-capable model with a configured provider key;
 * otherwise the highest-reliability vision model whose provider is live.
 */
function resolveVisionModel(
  requestedId: unknown,
  overrides?: ProviderKeyOverrides,
) {
  const live = (id: string): boolean => {
    const model = getModel(id);
    if (!model) return false;
    return getProviderKey(model.provider, overrides).length > 0;
  };

  if (typeof requestedId === "string" && requestedId.trim()) {
    const model = getModel(requestedId.trim());
    if (model?.capabilities.vision && live(model.id)) return model;
  }
  return getVisionModels().find((m) => live(m.id));
}

export async function POST(req: Request) {
  const { user, response: authError } = await authGuard()
  if (!user) return authError

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const body = (raw ?? {}) as VisionRequestBody

  if (typeof body.image !== 'string' || !body.image.startsWith('data:')) {
    return Response.json({ error: "Field 'image' must be a base64 data URL string." }, { status: 400 })
  }
  const task = body.task === 'analyze' || body.task === 'ocr' ? body.task : null
  if (!task) {
    return Response.json({ error: "Field 'task' must be either 'analyze' or 'ocr'." }, { status: 400 })
  }

  let instruction: string = DEFAULT_INSTRUCTIONS[task]
  if (task === 'analyze' && typeof body.prompt === 'string' && body.prompt.trim().length > 0) {
    instruction = body.prompt.trim()
  }

  const model = resolveVisionModel(body.modelId, user.keys)
  if (!model) {
    return Response.json(
      {
        error:
          'No vision-capable model is connected. Add a provider API key for a vision model (e.g. G4F_API_KEY for Gemini Flash) to .env and restart the dev server.',
      },
      { status: 400 },
    )
  }

  const gateway = getGateway(model.provider)
  if (!gateway) {
    return Response.json({ error: 'No gateway is configured for the selected vision model.' }, { status: 500 })
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  try {
    const completion = (await Promise.race([
      fetch(`${getProviderBaseUrl(model.provider)}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${getProviderKey(model.provider, user.keys)}`,
        },
        body: JSON.stringify({
          model: resolveUpstreamModelId(model.id),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: instruction },
                { type: 'image_url', image_url: { url: body.image } },
              ],
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      }).then(async (resp) => {
        if (!resp.ok) {
          const detail = await resp.text().catch(() => '')
          throw new Error(
            detail.trim()
              ? `${model.displayName} request failed (${resp.status}): ${detail.trim().slice(0, 300)}`
              : `${model.displayName} request failed (${resp.status}).`,
          )
        }
        return resp.json() as Promise<VisionCompletion>
      }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Vision request timed out after 60 seconds.')),
          VISION_TIMEOUT_MS
        )
      }),
    ])) as VisionCompletion

    const result = completion?.choices?.[0]?.message?.content
    if (typeof result !== 'string') {
      return Response.json({ error: 'Vision model returned an unexpected response.' }, { status: 502 })
    }
    return Response.json({ result, viaModelId: model.id, viaModelName: model.displayName })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision request failed.'
    return Response.json({ error: message }, { status: 502 })
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}
