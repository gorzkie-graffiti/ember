import { runCuratorCompletion } from "@/lib/server/curator";
import { authGuard } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auto-names conversations with a cheap curator model.
 *
 * The client POSTs the first exchange right after the opening reply finishes
 * streaming; the server asks a small model for a short, human-style title and
 * returns it. Purely cosmetic + best-effort: any failure falls back to the
 * client's existing first-message truncation title (the client keeps its
 * `deriveTitle` fallback and just ignores a failed request).
 *
 * Same provider-ladder pattern as /api/memories/extract: the cheapest capable
 * model from whichever providers are live, tried in order.
 */

const MAX_TITLE_LENGTH = 60;

interface TitleBody {
  messages?: Array<{ role?: unknown; content?: unknown }>;
}

function sanitizeTitle(raw: string): string | null {
  const clean = raw
    // Strip code fences, surrounding quotes, and list markers models like to add.
    .replace(/^```[\s\S]*?```$/g, "")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/^\s*[-*\d.)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length < 3 || clean.length > MAX_TITLE_LENGTH) return null;
  // Refuse the model narrating instead of titling.
  if (/^(here(?:'s| is)|sure|title\s*:)/i.test(clean)) return null;
  return clean;
}

export async function POST(req: Request) {
  const { user, response: authError } = await authGuard();
  if (!user) return authError;

  let body: TitleBody;
  try {
    body = (await req.json()) as TitleBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const exchange = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(0, 4)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 2000),
    }));

  const userTurn = exchange.find((m) => m.role === "user");
  if (!userTurn) {
    return Response.json({ ok: false, reason: "no-user-message" });
  }

  const completion = await runCuratorCompletion(
    `You name chat conversations. Given the opening exchange, write a short title (2-6 words) capturing what the conversation is about.

Rules:
- Style: like a bookmark name — specific, plain, no fluff. "Debugging Prisma enum migration", not "A Question About Databases".
- Preserve key technical terms, file names, or proper nouns verbatim.
- Title-case lightly; do not end with punctuation; no quotes.
- Respond with ONLY the title text — nothing else.
- If the exchange is pure small talk ("hi", "thanks"), respond with exactly: New chat`,
    exchange
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n"),
    { maxTokens: 32, timeoutMs: 12_000, keys: user.keys },
  );

  if (!completion) {
    return Response.json({ ok: false, reason: "no-provider" });
  }

  const title = sanitizeTitle(completion);
  if (!title) {
    return Response.json({ ok: false, reason: "bad-title" });
  }

  return Response.json({ ok: true, title });
}
