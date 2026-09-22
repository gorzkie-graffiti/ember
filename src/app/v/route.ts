import { DEFAULT_MODEL_ID, getModel } from "@/lib/models/catalog";
import {
  getGateway,
  getProviderBaseUrl,
  getProviderKey,
  resolveUpstreamModelId,
} from "@/lib/server/provider-gateways";
import { describeUpstreamFailure } from "@/lib/server/legacy-reply";

/**
 * GET /v?msg=<text>&maxlen=1500
 *
 * Legacy-client endpoint for severely constrained devices (Android 2.3,
 * J2ME MIDlets). Returns plain UTF-8 text only — no JSON, no SSE, no HTML.
 * A single non-streamed completion is routed through Ember's normal
 * provider-gateway pipeline (same model catalog, same API keys from .env).
 *
 * Query params:
 *   msg    — the user's message (required, URL-encoded)
 *   maxlen — hard cap on reply length, default 1500 chars (old devices
 *            have tiny TCP windows and 176x220 screens; brevity is mercy)
 *
 * No auth: Ember is self-hosted; the /v surface is protected by the same
 * network boundary as the rest of the server.
 */

const DEFAULT_MAXLEN = 1500;
const HARD_MAXLEN = 8000;
const MAX_MSG_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 45_000;

function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Some J2ME stacks ignore Content-Type and sniff; make it obvious.
      "X-Ember-Legacy": "1",
    },
  });
}

function fail(message: string, status = 400): Response {
  return textResponse(`Ember error: ${message}`, status);
}

function parsePositiveInt(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // The msg param arrives URL-encoded by the client. Some old midlets
  // double-encode, so decode exactly once and accept what we get.
  const msg = (url.searchParams.get("msg") ?? "").trim();
  if (msg.length === 0) {
    return fail(
      "missing msg parameter. Usage: GET /v?msg=<text>&maxlen=1500"
    );
  }
  if (msg.length > MAX_MSG_CHARS) {
    return fail(
      `msg is too long (${msg.length} chars, max ${MAX_MSG_CHARS}).`
    );
  }

  const maxlen = Math.min(
    parsePositiveInt(url.searchParams.get("maxlen")) ?? DEFAULT_MAXLEN,
    HARD_MAXLEN
  );

  // Legacy clients always want the fast, small default model — the same
  // one the web UI picks by default ("Most efficient for everyday tasks"
  // lives in the picker; DEFAULT_MODEL_ID is the compact reasoning model).
  const model = getModel(DEFAULT_MODEL_ID);
  if (!model || !model.capabilities.chatCompatible) {
    return fail("no default chat model is available in the catalog.", 500);
  }

  const gateway = getGateway(model.provider);
  if (!gateway) {
    return fail(
      `no gateway is configured for provider "${model.provider}".`,
      500
    );
  }
  if (getProviderKey(model.provider).length === 0) {
    return fail(
      `${gateway.envVar} is not set on this server — add it to .env and restart.`
    );
  }

  const systemPrompt = [
    "You are Ember, a premium AI assistant answering over a legacy text-only channel (an old phone).",
    "Rules for every reply:",
    "- Plain prose only: no markdown, no code fences, no tables, no emoji.",
    "- Lists become short lines like '1. ...' or '- ...' when a list truly helps.",
    "- Be direct and complete, then stop. No meta commentary about the channel.",
  ].join("\n");

  const upstreamPayload = {
    model: resolveUpstreamModelId(model.id),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: msg },
    ],
    stream: false,
    temperature: 0.7,
    max_tokens: Math.min(2048, Math.ceil(maxlen * 1.5)),
  };

  let controller: AbortController | null = new AbortController();
  const timeout = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${getProviderBaseUrl(model.provider)}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${getProviderKey(model.provider)}`,
          ...(model.provider === "openrouter"
            ? { "HTTP-Referer": "https://ember.local", "X-Title": "Ember" }
            : {}),
        },
        body: JSON.stringify(upstreamPayload),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return fail(
        describeUpstreamFailure(model.provider, response.status, detail),
        502
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string } | string;
    };

    if (data.error) {
      const errMsg =
        typeof data.error === "string"
          ? data.error
          : data.error.message ?? "Upstream model error.";
      return fail(errMsg, 502);
    }

    let reply = data.choices?.[0]?.message?.content ?? "";
    reply = reply
      .replace(/<tool_call>[\s\S]*?<\/tool_call>\s*/g, "")
      .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
      .trim();

    if (reply.length === 0) {
      return fail("the model returned an empty reply.", 502);
    }

    if (reply.length > maxlen) {
      reply = reply.slice(0, maxlen).trimEnd() + "…";
    }

    return textResponse(reply);
  } catch (err) {
    const aborted =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    return fail(
      aborted ? "upstream request timed out." : "upstream request failed.",
      aborted ? 504 : 502
    );
  } finally {
    clearTimeout(timeout);
    controller = null;
  }
}