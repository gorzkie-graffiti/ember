/**
 * Sign-in code generation + hashing.
 *
 * Registration only asks for an email and a reason, so the credential has to
 * come from somewhere. We mint a high-entropy one-time code and show it to the
 * person exactly once; only its SHA-256 hash is stored. An admin can mint a
 * fresh code for anyone who loses theirs.
 */

// Crockford-style alphabet: no I, L, O, U — avoids the usual transcription
// errors when someone writes the code down or reads it off a screen.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** e.g. `EMBER-7Q4K-2M9P-XT3R` */
export function generateAccessCode(): string {
  const groups: string[] = [];
  for (let group = 0; group < 3; group += 1) {
    let chunk = "";
    const random = new Uint8Array(4);
    crypto.getRandomValues(random);
    for (let i = 0; i < 4; i += 1) {
      chunk += CODE_ALPHABET[random[i] % CODE_ALPHABET.length];
    }
    groups.push(chunk);
  }
  return `EMBER-${groups.join("-")}`;
}

/** Normalizes user input so formatting/punctuation doesn't matter. */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^EMBER/, "");
}

export async function hashCode(code: string): Promise<string> {
  const normalized = normalizeCode(code);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`ember-code:${normalized}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  const candidate = await hashCode(code);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

/** Loose email sanity check — the admin is the real gate. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
