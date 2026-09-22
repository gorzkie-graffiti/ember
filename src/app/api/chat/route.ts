import { DEFAULT_MODEL_ID, getModel } from "@/lib/models/catalog";
import type { ModelInfo, ProviderId } from "@/lib/models/types";
import { getProvider } from "@/lib/models/providers";
import {
  getGateway,
  getProviderBaseUrl,
  getProviderKey,
  resolveUpstreamModelId,
} from "@/lib/server/provider-gateways";
import {
  loadPromptsFile,
  getPromptDoc,
  MAX_PROMPT_INJECTION,
} from "@/lib/server/prompts-store";
import { performWebSearch } from "@/lib/server/web-search";
import { performWebFetch } from "@/lib/server/web-fetch";
import {
  StreamingLoopGuard,
} from "@/lib/server/loop-guard";
import { authGuard } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HISTORY_MESSAGES = 40;
const MAX_ATTACHMENT_CHARS = 12_000;
const MAX_TOOL_LOOPS = 3;
const MAX_OUTPUT_CHARS = 16_000;
/** Sent as the final-round user nudge when the loop budget is exhausted. */
const FINAL_ANSWER_NUDGE =
  "TOOL LOOP LIMIT REACHED. Do NOT call any more tools. Using the information you already have, write your final answer to the user's original question now. If some information is missing, say so briefly and answer with what you have.";

type ChatRole = "user" | "assistant" | "system";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface IncomingAttachment {
  name?: string;
  mime?: string;
  textContent?: string;
  visionAnalysis?: string;
  extractedText?: string;
}

interface ChatRequestBody {
  /** Catalog model id — selects the provider this request is routed to. */
  model?: string;
  messages: IncomingMessage[];
  thinking?: boolean;
  effort?: string;
  memories?: string[];
  attachments?: IncomingAttachment[];
  continuation?: boolean;
}

const EFFORT_GUIDANCE: Record<string, string> = {
  low: "Answer concisely — a few sentences unless more is truly needed.",
  medium: "Answer directly and completely with a reasonable level of detail.",
  high: "Think step by step and be thorough; use markdown structure, examples, and tables where they help.",
  max: "Think step by step and be thorough; use markdown structure, examples, and tables where they help.",
};

function truncate(text: string, max: number): string {
  return text.length <= max
    ? text
    : `${text.slice(0, max)}\n[…truncated ${text.length - max} characters…]`;
}

function sanitizeDebugPayload(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  try {
    let str = JSON.stringify(obj);
    str = str.replace(/Bearer\s+[A-Za-z0-9_\-\.\/]+/gi, "Bearer [REDACTED_API_KEY]");
    str = str.replace(/("authorization"\s*:\s*")[^"]+"/gi, '$1[REDACTED_API_KEY]"');
    str = str.replace(/("x-subscription-token"\s*:\s*")[^"]+"/gi, '$1[REDACTED_API_KEY]"');
    return JSON.parse(str);
  } catch {
    return obj;
  }
}

function buildSystemPrompt(body: ChatRequestBody, model: ModelInfo): string {
  const parts: string[] = [];

  const providerName = getProvider(model.provider).name;
  parts.push(
    `You are Ember, a premium AI assistant. The active model is ${model.displayName}, served via the ${providerName} gateway.`
  );

  // Settings: an active System Prompt doc REPLACES the built-in one;
  // an active User Instructions doc (style or prompt) is appended.
  const promptsFile = loadPromptsFile();
  const customPrompt = promptsFile.activeSystemPromptId
    ? getPromptDoc(promptsFile.activeSystemPromptId)
    : null;
  const customInstructions = promptsFile.activeInstructionsId
    ? getPromptDoc(promptsFile.activeInstructionsId)
    : null;

  if (customPrompt && customPrompt.text.trim()) {
    parts.length = 0;
    parts.push(truncate(customPrompt.text.trim(), MAX_PROMPT_INJECTION));
    // Keep the model-awareness line even under a custom system prompt.
    parts.push(
      `You are running as Ember. The active model is ${model.displayName}, served via the ${providerName} gateway.`
    );
  }

  if (customInstructions && customInstructions.text.trim()) {
    parts.push(
      [
        `The user's standing instructions (apply to every reply):`,
        truncate(customInstructions.text.trim(), MAX_PROMPT_INJECTION),
      ].join("\n")
    );
  }

  const effort =
    typeof body.effort === "string" && body.effort in EFFORT_GUIDANCE
      ? body.effort
      : "medium";
  parts.push(`Response style: ${EFFORT_GUIDANCE[effort]}`);

  // Web search & fetch tools instruction
  parts.push(
    `You have live access to the web via web tools:
1. \`web_search\`: Search the live web for current facts, recent news, documentation, and real-time information.
   Usage syntax: <tool_call>{"name": "web_search", "query": "search query here"}</tool_call>
2. \`web_fetch\`: Fetch and read the full text content of a specific web URL.
   Usage syntax: <tool_call>{"name": "web_fetch", "url": "https://example.com/page"}</tool_call>

Instructions for web tools:
- When the user asks for current events, real-time facts, recent news, web pages, or information you are unsure of, use \`web_search\` or \`web_fetch\`.
- Output the <tool_call> block clearly when you need web information.
- Make each tool call distinct: NEVER repeat a previous <tool_call> with the same query or URL — you will not get a different result.
- Use at most ${MAX_TOOL_LOOPS} tool calls per reply. After receiving each <tool_result>, move toward your final answer instead of calling more tools.
- After receiving the <tool_result>, synthesize a thorough answer and include markdown links [Source Title](url) as citations for the facts provided.`
  );

  const memories = Array.isArray(body.memories)
    ? body.memories.filter(
        (m): m is string => typeof m === "string" && m.trim().length > 0
      )
    : [];
  if (memories.length > 0) {
    parts.push(
      [
        "Persistent facts about the user (from their Memory):",
        ...memories.map((m) => `- ${m}`),
      ].join("\n")
    );
  }

  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const blocks = attachments
    .map((a) => {
      if (!a || typeof a !== "object") return null;
      const name =
        typeof a.name === "string" && a.name.trim()
          ? a.name.trim()
          : "attachment";
      const mime =
        typeof a.mime === "string" && a.mime.trim()
          ? a.mime.trim()
          : "unknown type";
      const sections: string[] = [`### ${name} (${mime})`];
      let hasContent = false;
      if (typeof a.textContent === "string" && a.textContent.trim()) {
        sections.push(
          `**Content:**\n${truncate(a.textContent, MAX_ATTACHMENT_CHARS)}`
        );
        hasContent = true;
      }
      if (typeof a.visionAnalysis === "string" && a.visionAnalysis.trim()) {
        sections.push(
          `**Vision analysis:**\n${truncate(a.visionAnalysis, MAX_ATTACHMENT_CHARS)}`
        );
        hasContent = true;
      }
      if (typeof a.extractedText === "string" && a.extractedText.trim()) {
        sections.push(
          `**Extracted text (OCR):**\n${truncate(a.extractedText, MAX_ATTACHMENT_CHARS)}`
        );
        hasContent = true;
      }
      return hasContent ? sections.join("\n\n") : null;
    })
    .filter((b): b is string => b !== null);

  if (blocks.length > 0) {
    parts.push(
      [
        "The user attached the following material to their latest message:",
        ...blocks,
      ].join("\n\n")
    );
  }

  return parts.join("\n\n");
}

function parseBody(
  raw: unknown
): { ok: true; body: ChatRequestBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const body = raw as ChatRequestBody;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: "'messages' must be a non-empty array." };
  }
  for (const message of body.messages) {
    if (!message || typeof message !== "object") {
      return {
        ok: false,
        error: "Each message must be an object with role and content.",
      };
    }
    if (message.role !== "user" && message.role !== "assistant") {
      return {
        ok: false,
        error: "Message roles must be either 'user' or 'assistant'.",
      };
    }
    if (typeof message.content !== "string") {
      return { ok: false, error: "Message content must be a string." };
    }
  }
  return { ok: true, body };
}

interface UpstreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
    };
    finish_reason?: string | null;
  }>;
  error?: { message?: string } | string;
}

function describeUpstreamFailure(
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
      return `${name} request failed (${status}): ${truncate(detail.trim(), 300)}`;
    }
  }
  if (status === 401 || status === 403) {
    return `${name}: the configured API key was rejected (${status}). Check the key in .env.`;
  }
  return `${name} request failed (${status}).`;
}

interface ParsedToolCall {
  name: "web_search" | "web_fetch";
  query?: string;
  url?: string;
  rawMatch: string;
}

/** Removes complete and (still-streaming, unterminated) <tool_call> blocks. */
function stripToolCallBlocks(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>\s*/g, "")
    .replace(/<tool_call>[\s\S]*$/g, "");
}

function parseToolCall(content: string): ParsedToolCall | null {
  const match = content.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!match) return null;
  const rawMatch = match[0];
  const innerJson = match[1].trim();

  try {
    const parsed = JSON.parse(innerJson) as {
      name?: unknown;
      query?: unknown;
      url?: unknown;
    };
    if (
      parsed.name === "web_search" &&
      typeof parsed.query === "string" &&
      parsed.query.trim().length > 0
    ) {
      return {
        name: "web_search",
        query: parsed.query,
        rawMatch,
      };
    }
    if (
      parsed.name === "web_fetch" &&
      typeof parsed.url === "string" &&
      parsed.url.trim().length > 0
    ) {
      return {
        name: "web_fetch",
        url: parsed.url,
        rawMatch,
      };
    }
  } catch {
    // Malformed JSON tool call — stripped from client content but not executed.
  }

  return null;
}

/** Stable identity of a tool call — used to detect identical repeats. */
function toolCallSignature(call: ParsedToolCall): string {
  const input = (call.query ?? call.url ?? "").trim().toLowerCase();
  return `${call.name}:${input}`;
}

export async function POST(req: Request) {
  const { user, response: authError } = await authGuard();
  if (!user) return authError;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.body;

  const requestedModelId =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : DEFAULT_MODEL_ID;
  const model = getModel(requestedModelId);
  if (!model || !model.capabilities.chatCompatible) {
    return Response.json(
      { error: `Unknown or unsupported model: "${requestedModelId}".` },
      { status: 400 }
    );
  }

  const gateway = getGateway(model.provider);
  if (!gateway) {
    return Response.json(
      { error: `No gateway is configured for provider "${model.provider}".` },
      { status: 500 }
    );
  }

  if (getProviderKey(model.provider, user.keys).length === 0) {
    return Response.json(
      {
        error: `${getProvider(model.provider).name} is not configured for your account. Add your own ${gateway.envVar} under Settings → Your API keys, or ask the admin to add it to the server .env.`,
      },
      { status: 400 }
    );
  }

  const history = body.messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  const sdkMessages: Array<{
    role: ChatRole;
    content: string;
  }> = [
    { role: "system", content: buildSystemPrompt(body, model) },
    ...history,
  ];
  if (body.continuation === true) {
    sdkMessages.push({
      role: "user",
      content:
        "Your previous reply was cut off. Continue it seamlessly from exactly where it stopped — do not repeat earlier content, do not add preamble.",
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let clientGone = false;

      const send = (event: Record<string, unknown>): boolean => {
        if (closed || clientGone) return false;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
          return true;
        } catch {
          clientGone = true;
          return false;
        }
      };
      const sendRaw = (text: string): boolean => {
        if (closed || clientGone) return false;
        try {
          controller.enqueue(encoder.encode(text));
          return true;
        } catch {
          clientGone = true;
          return false;
        }
      };

      let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null =
        null;
      const abortUpstream = () => {
        clientGone = true;
        upstreamReader?.cancel().catch(() => {});
      };
      req.signal.addEventListener("abort", abortUpstream, { once: true });

      try {
        let toolLoopCount = 0;
        let truncated = false;
        const executedToolCalls = new Set<string>();

        // Budget: MAX_TOOL_LOOPS tool rounds, plus one forced final-answer
        // round after the budget is spent (see FINAL_ANSWER_NUDGE).
        while (toolLoopCount <= MAX_TOOL_LOOPS) {
          if (req.signal.aborted || clientGone) break;

          const rawPayload = {
            model: resolveUpstreamModelId(model.id),
            messages: sdkMessages,
            stream: true,
            temperature: 0.7,
          };

          const response = await fetch(
            `${getProviderBaseUrl(model.provider)}/chat/completions`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${getProviderKey(model.provider, user.keys)}`,
                ...(model.provider === "openrouter"
                  ? { "HTTP-Referer": "https://ember.local", "X-Title": "Ember" }
                  : {}),
              },
              body: JSON.stringify(rawPayload),
              signal: req.signal,
            }
          );

          if (!response.ok || !response.body) {
            const detail = await response.text().catch(() => "");
            send({
              type: "error",
              message: describeUpstreamFailure(
                model.provider,
                response.status,
                detail
              ),
            });
            sendRaw("data: [DONE]\n\n");
            return;
          }

          const upstreamStream: ReadableStream<Uint8Array> = response.body;
          upstreamReader = upstreamStream.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let sawError = false;
          let turnContent = "";
          let turnReasoning = "";
          let outboundSent = 0;
          let totalOutputChars = 0;
          let turnLoopDetected = false;
          let turnHardCapped = false;
          const loopGuard = new StreamingLoopGuard();

          readLoop: while (true) {
            if (req.signal.aborted || clientGone) break;
            const { done, value } = await upstreamReader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              if (payload === "[DONE]") break readLoop;

              try {
                const json = JSON.parse(payload) as UpstreamChunk;
                if (json.error) {
                  sawError = true;
                  const message =
                    typeof json.error === "string"
                      ? json.error
                      : json.error.message ?? "Upstream model error.";
                  send({ type: "error", message });
                  break readLoop;
                }
                const choice = json.choices?.[0];
                const delta = choice?.delta;
                const reasoning =
                  delta?.reasoning_content ?? delta?.reasoning;
                if (typeof reasoning === "string" && reasoning.length > 0) {
                  turnReasoning += reasoning;
                  if (!send({ type: "thinking", content: reasoning }))
                    break readLoop;
                }
                if (
                  typeof delta?.content === "string" &&
                  delta.content.length > 0
                ) {
                  turnContent += delta.content;
                  totalOutputChars += delta.content.length;

                  // Repetition-loop guard: small models sometimes emit the
                  // same block over and over. Detect it mid-stream, then stop
                  // reading upstream; the trimmed text is sent as a replace
                  // event after the read loop exits.
                  if (!turnLoopDetected && totalOutputChars > 512) {
                    const guard = loopGuard.push(turnContent);
                    if (guard.loopDetected) {
                      turnLoopDetected = true;
                      truncated = true;
                      break readLoop;
                    }
                  }

                  // Hard output cap: even without a detectable loop, refuse
                  // to stream more than MAX_OUTPUT_CHARS per reply.
                  if (totalOutputChars >= MAX_OUTPUT_CHARS && !turnHardCapped) {
                    turnHardCapped = true;
                    truncated = true;
                    break readLoop;
                  }

                  // Never stream <tool_call> blocks to the client: hold back
                  // the tail of the message where a block may be forming.
                  const outbound = stripToolCallBlocks(turnContent);
                  if (outbound.length > outboundSent) {
                    const chunk = outbound.slice(outboundSent);
                    outboundSent = outbound.length;
                    if (!send({ type: "content", content: chunk }))
                      break readLoop;
                  }
                }
              } catch {
                // Ignore malformed SSE chunks
              }
            }
          }

          if (sawError) break;

          if (turnLoopDetected || turnHardCapped) {
            // Degenerate turn: send the replacement text as a truncate
            // event — the client swaps its accumulated content for this.
            const replacement = turnLoopDetected
              ? stripToolCallBlocks(loopGuard.cleanedText).trimEnd()
              : stripToolCallBlocks(turnContent.slice(0, MAX_OUTPUT_CHARS));
            send({ type: "truncate", content: replacement });
          } else {
            // A complete <tool_call> block may have been split across SSE
            // chunks after the held-back tail was already sent — sweep it.
            const outbound = stripToolCallBlocks(turnContent);
            if (outbound.length > outboundSent) {
              send({ type: "content", content: outbound.slice(outboundSent) });
            }
          }

          // Check if turnContent invoked a tool call
          const toolCall =
            turnLoopDetected || turnHardCapped
              ? null
              : parseToolCall(turnContent);

          // Stream debug telemetry payload for this turn
          send({
            type: "debug",
            turnIndex: toolLoopCount,
            request: sanitizeDebugPayload({
              endpoint: `${getProviderBaseUrl(model.provider)}/chat/completions`,
              provider: model.provider,
              payload: rawPayload,
            }),
            response: sanitizeDebugPayload({
              reasoning: turnReasoning,
              content: turnContent,
              toolCall: toolCall ? { tool: toolCall.name, query: toolCall.query, url: toolCall.url } : null,
            }),
          });

          if (!toolCall) {
            // No tool call requested — final answer reached
            break;
          }

          // Tool call detected
          if (toolLoopCount >= MAX_TOOL_LOOPS) {
            // Budget spent and the model STILL tried a tool call on the
            // forced final-answer round. Stop here: whatever it wrote
            // before the <tool_call> block has already been streamed.
            break;
          }

          if (executedToolCalls.has(toolCallSignature(toolCall))) {
            // Identical repeat: do not execute again. Consume budget and
            // demand the final answer — the nudge turn is still ahead.
            toolLoopCount += 1;
            sdkMessages.push({ role: "assistant", content: turnContent });
            sdkMessages.push({
              role: "user",
              content: `You already called ${toolCall.name} with the exact same input and got a result back. Do NOT repeat the call. Write your final answer now, using the result you already have.`,
            });
            continue;
          }
          executedToolCalls.add(toolCallSignature(toolCall));

          toolLoopCount += 1;
          const toolCallId = `tool-${Date.now()}-${toolLoopCount}`;

          if (toolCall.name === "web_search" && toolCall.query) {
            send({
              type: "tool_start",
              id: toolCallId,
              tool: "web_search",
              input: toolCall.query,
            });

            const results = await performWebSearch(toolCall.query);
            let resultFormatted = "";
            if (results.length === 0) {
              resultFormatted = `No search results found for query: "${toolCall.query}".`;
            } else {
              resultFormatted = `Found ${results.length} search results:\n` +
                results
                  .map(
                    (r, i) =>
                      `${i + 1}. [${r.title}](${r.url}) (${r.source})\n   ${r.snippet}`
                  )
                  .join("\n\n");
            }

            send({
              type: "tool_end",
              id: toolCallId,
              tool: "web_search",
              resultSummary: `Found ${results.length} results`,
            });

            // Feed tool interaction back to system messages context
            sdkMessages.push({
              role: "assistant",
              content: turnContent,
            });
            sdkMessages.push({
              role: "user",
              content: `<tool_result name="web_search" query="${toolCall.query}">\n${resultFormatted}\n</tool_result>\n\n${
                toolLoopCount >= MAX_TOOL_LOOPS
                  ? FINAL_ANSWER_NUDGE
                  : "Please use these search results to answer my question completely with inline citations [Source Title](url)."
              }`,
            });
          } else if (toolCall.name === "web_fetch" && toolCall.url) {
            send({
              type: "tool_start",
              id: toolCallId,
              tool: "web_fetch",
              input: toolCall.url,
            });

            let pageContent = "";
            let pageTitle = toolCall.url;
            try {
              const fetched = await performWebFetch(toolCall.url);
              pageTitle = fetched.title;
              pageContent = `Title: ${fetched.title}\nURL: ${fetched.url}\n\nContent:\n${fetched.content}`;
            } catch (err) {
              pageContent = `Error fetching page: ${err instanceof Error ? err.message : String(err)}`;
            }

            send({
              type: "tool_end",
              id: toolCallId,
              tool: "web_fetch",
              resultSummary: `Fetched: ${pageTitle}`,
            });

            sdkMessages.push({
              role: "assistant",
              content: turnContent,
            });
            sdkMessages.push({
              role: "user",
              content: `<tool_result name="web_fetch" url="${toolCall.url}">\n${pageContent}\n</tool_result>\n\n${
                toolLoopCount >= MAX_TOOL_LOOPS
                  ? FINAL_ANSWER_NUDGE
                  : "Please summarize or use the fetched web page content to answer my prompt with citations."
              }`,
            });
          } else {
            break;
          }
        }

        if (!clientGone) {
          send({ type: "done" });
        }
        sendRaw("data: [DONE]\n\n");
      } catch (err) {
        if (!clientGone && !req.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "Upstream request failed.";
          send({ type: "error", message });
          sendRaw("data: [DONE]\n\n");
        }
      } finally {
        req.signal.removeEventListener("abort", abortUpstream);
        if (upstreamReader) {
          upstreamReader.cancel().catch(() => {});
        }
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Stream closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
