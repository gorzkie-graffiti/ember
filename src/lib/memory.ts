/**
 * Claude-style memory domain logic, shared by client and server.
 *
 * Mirrors Claude.ai's memory system:
 * - Topic-based entries captured in real time (not conversation summaries).
 * - Sensitive topics (health, race, religion, politics, gender identity)
 *   are never captured by default; user can opt in.
 * - A hard-never list (government IDs, financial accounts, criminal history,
 *   immigration status) is excluded even with sensitive topics enabled.
 * - Retrieval is relevance-weighted: entries are scored against what the
 *   user is actually asking, never injected wholesale.
 */

export const MEMORY_CATEGORIES = [
  "work-role",
  "preferences",
  "technical",
  "projects",
  "people",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  "work-role": "Work & Role",
  preferences: "Preferences",
  technical: "Technical",
  projects: "Projects",
  people: "People & Places",
};

/** Max entries kept overall (Claude keeps memory curated, not exhaustive). */
export const MAX_MEMORY_ENTRIES = 60;
/** Max content length of a single entry. */
export const MAX_MEMORY_CONTENT_LENGTH = 300;

/** Hard-never content: excluded regardless of the sensitive-topics toggle. */
export const HARD_NEVER_PATTERNS: RegExp[] = [
  /\b(?:ssn|social security(?: number)?|passport(?: number)?|driver'?s licen[cs]e|national id(?: number)?|government id)\b/i,
  /\b(?:credit|debit|bank) card number\b/i,
  /\b(?:account|routing|iban|swift)\s*(?:number|no\.?|#)\b/i,
  /\b(?:criminal record|arrest record|felony|convicted of)\b/i,
  /\b(?:visa status|green card|asylum|immigration status|citizenship status)\b/i,
];

/**
 * Sensitive topics Claude excludes by default. Entries matching these are
 * only captured when the user turns "Include sensitive topics" on.
 *
 * Note: slang/compound spellings people actually use ("audhd", "pmdd",
 * "burnout", "meds") are listed explicitly — \badhd\b does NOT match
 * inside "audhd" because of the word boundary.
 */
export const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:depress\w*|anxiety|anxious|bipolar|adhd|audhd|autism|autistic|neurodiverg\w*|ocd|ptsd|pmdd|burnout|panic attacks?|therapy|therapist|medication|meds|diagnos\w*|chronic|disabilit\w*|illness|cancer|hiv|pregnan\w*|mental health)\b/i,
  /\b(?:race|racis\w*|ethnic\w*|religio\w*|christian\w*|muslim\w*|jewish|hindu|buddhis\w*|atheis\w*|catholic\w*)\b/i,
  /\b(?:democrat|republican|conservativ\w*|liberal\w*|libertarian\w*|politica\w*|election|vote for|left-wing|right-wing)\b/i,
  /\b(?:transgender|non-?binary|gender identit\w*|lgbtq?|queer|sexual orientation|gay|lesbian|bisexual)\b/i,
];

export function matchesAny(content: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(content));
}

/**
 * The single gate every capture candidate passes through. Returns a reason
 * string when the entry must be dropped, null when it's allowed.
 */
export function screenMemoryContent(
  content: string,
  includeSensitive: boolean,
): "hard-never" | "sensitive" | null {
  if (matchesAny(content, HARD_NEVER_PATTERNS)) return "hard-never";
  if (!includeSensitive && matchesAny(content, SENSITIVE_PATTERNS))
    return "sensitive";
  return null;
}

/* ------------------------------------------------------------------ */
/* Relevance-weighted retrieval                                        */
/* ------------------------------------------------------------------ */

/** Cheap, deterministic term overlap scoring — no embedding needed. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "you", "your", "our", "are",
  "was", "were", "has", "have", "had", "not", "but", "all", "can", "will",
  "what", "when", "where", "who", "how", "why", "from", "they", "their",
  "them", "she", "him", "his", "her", "its", "into", "about", "out", "use",
  "using", "used", "want", "need", "make", "made", "get", "got", "like",
]);

/**
 * Score one memory against the current turn. Recency gives a small boost so
 * ties resolve toward what the user has been working on lately, but content
 * overlap always dominates — mirroring Claude's relevance-weighting.
 */
export function scoreMemory(
  memory: string,
  query: string,
  updatedAt: number,
): number {
  const memTokens = new Set(tokenize(memory));
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || memTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (memTokens.has(token)) overlap += 1;
  }
  if (overlap === 0) return 0;

  const recencyBoost =
    0.5 * Math.max(0, 1 - (Date.now() - updatedAt) / (1000 * 60 * 60 * 24 * 14));

  return overlap / queryTokens.length + recencyBoost;
}

/* ------------------------------------------------------------------ */
/* Extraction prompt (server-side curator model)                       */
/* ------------------------------------------------------------------ */

/**
 * Built per-request: when the user opts into sensitive topics the curator is
 * ALLOWED to write them down — a static prompt that always bans health terms
 * means "include sensitive topics" silently does nothing (the curator returns
 * [] before the server-side gate ever runs).
 */
export function buildExtractionSystemPrompt(includeSensitive: boolean): string {
  const sensitiveBlock = includeSensitive
    ? `Sensitive topics (health conditions, neurodivergence, mental health, race/ethnicity, religion, politics, gender identity, sexual orientation) are ALLOWED and should be captured when the user shares them about themselves — this user has opted in.`
    : `NEVER output sensitive topics: health conditions, neurodivergence, mental health, race/ethnicity, religious beliefs, political views, gender identity, sexual orientation. Skip such facts entirely.`;

  return `You are the memory curator for an AI assistant. Read the recent exchange and extract durable facts about the USER worth remembering for future conversations.

The user writes CASUALLY: slang, abbreviations, venting, typos, internet speak. Venting still reveals durable facts — the emotion is ephemeral, the underlying fact about the user is not. Examples:
- "bro i hate my audhd" → "User has AUDHD (autism and ADHD)"
- "my pmdd is killing me again lol" → "User has PMDD"
- "back on the grindi n my sauna gap yr" → "User is on a gap year and works out at a sauna regularly"
- "me and sarah broke up bruh" → "User's partner Sarah and they recently broke up"

Capture (durable — true beyond this conversation):
- Identity: name, location, languages, life circumstances the user shares.
- Neurotype / health context the user shares about themselves.
- Work & role, ongoing projects, what they're building.
- Preferences: tools, stack, coding style, communication style, likes/dislikes.
- People & places in the user's life.

Ignore:
- One-off task details, requests, questions, small talk with no durable fact.
- The assistant's own output.

Rules for each memory:
- ONE self-contained, timeless sentence about the user, starting with "User" ("User prefers...", "User is building...", "User's ... is ..."). Never use "I".
- Normalize slang/typos but keep the user's own identity terms (e.g. AUDHD, PMDD).
- Max ${MAX_MEMORY_CONTENT_LENGTH} characters each. At most 5 memories.
- If nothing durable is present, return []

${sensitiveBlock}
NEVER output (unconditionally): government IDs, financial account numbers, criminal history, immigration status.

Respond with ONLY a JSON array of strings — no prose, no code fences. Example: ["User prefers concise answers", "User is building a Next.js app called Ember"]. Empty array if nothing qualifies.`;
}

/**
 * Parse the curator's completion into candidate memory strings.
 *
 * Tolerant of real-world model output: code fences, a "Memories:" preamble,
 * or a bare newline-separated list when the model skipped JSON entirely.
 */
export function parseExtractionResponse(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed: unknown = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return normalizeCandidates(parsed);
      }
    } catch {
      // Fall through to line-based parsing below.
    }
  }

  // Fallback: the model wrote prose/lines instead of JSON. Keep lines that
  // read like a memory sentence; drop JSON remnants, quotes, empties.
  const lines = text
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*[-*\d.)\s]+/, "")
        .replace(/^["'`\s]+|["'`,\s]+$/g, "")
        .trim(),
    )
    .filter(
      (l) =>
        l.length > 8 &&
        !l.startsWith("[") &&
        !l.startsWith("]") &&
        // Header/intro lines ("Memories:", "Here are the memories", ...).
        !/[:；]$/.test(l) &&
        !/^\{|^\}|^```|^Here (are|is)/i.test(l),
    );
  return normalizeCandidates(lines);
}

function normalizeCandidates(items: unknown[]): string[] {
  return items
    .filter(
      (m): m is string =>
        typeof m === "string" &&
        m.trim().length > 2 &&
        // JSON artifacts some models emit per item.
        !/^[{\[}"]]$/.test(m.trim()),
    )
    .map((m) => m.trim().slice(0, MAX_MEMORY_CONTENT_LENGTH))
    .slice(0, 5);
}
