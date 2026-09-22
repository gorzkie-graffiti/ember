/**
 * Repetition-loop guard for streamed model output.
 *
 * Small open-weight models served through OpenAI-compatible gateways
 * (Cohere Command models in particular) occasionally degenerate into a
 * sampling loop: the same line, bullet, or multi-line block is emitted
 * over and over until the token budget runs out. Left unchecked, one chat
 * message can burn tens of thousands of tokens repeating itself.
 *
 * This module watches the accumulated text while it streams and:
 *  1. Detects the loop — the tail of the output consists of the same
 *     1..MAX_PERIOD-line cycle repeated several times in a row (healthy
 *     text never does this; markdown legitimately repeats only short
 *     lines like "|" or "-", which are excluded by the length filter).
 *  2. Trims the loop body — everything after the FIRST full cycle is cut,
 *     so the client sees the content appear once and the message simply
 *     end, instead of a duplicated wall of text.
 *
 * Detection is deliberately conservative to avoid false trims.
 */

/** Minimum length of a line to be considered a repeatable unit. */
const MIN_UNIT_LENGTH = 24;

/** Repeats of a single line required to declare a loop. */
const SINGLE_LINE_THRESHOLD = 4;

/** Repeats of a multi-line cycle required to declare a loop. */
const CYCLE_THRESHOLD = 3;

/** Largest multi-line cycle considered. */
const MAX_PERIOD = 10;

interface LineInfo {
  /** Character offset of this line's start within the accumulated text. */
  start: number;
  /** Normalized repeatable unit, or null when the line is too short. */
  unit: string | null;
}

/**
 * Normalize a line for comparison: lowercase, collapse whitespace, and
 * strip digits so trivial jitter (a counter inside an otherwise identical
 * line) does not defeat detection. Words themselves must still match.
 */
function normalizeUnit(line: string): string {
  return line.toLowerCase().replace(/[0-9]+/g, "#").replace(/\s+/g, " ");
}

/** Map every line of the accumulated text to its offset + unit. */
function mapLines(text: string): LineInfo[] {
  const infos: LineInfo[] = [];
  let start = 0;
  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    infos.push({
      start,
      unit: trimmed.length >= MIN_UNIT_LENGTH ? normalizeUnit(trimmed) : null,
    });
    start += raw.length + 1;
  }
  return infos;
}

export interface LoopGuardResult {
  /** True when the accumulated text ends in a repetition loop. */
  loopDetected: boolean;
  /** The accumulated text with the repeated tail removed (when detected). */
  cleanedText: string;
  /** Character count removed from the tail (0 when no loop). */
  trimmedChars: number;
}

/**
 * Inspect the accumulated response text and remove a degenerate repeated
 * tail if one is present. Safe to call repeatedly while streaming: when
 * no loop is present it returns the input unchanged.
 */
export function inspectForLoop(accumulated: string): LoopGuardResult {
  const noLoop: LoopGuardResult = {
    loopDetected: false,
    cleanedText: accumulated,
    trimmedChars: 0,
  };

  const lines = mapLines(accumulated);

  // Indices of lines that qualify as repeatable units. Short/blank lines
  // between them are skipped, so blocks separated by blank lines still
  // count as adjacent repetitions.
  const seq: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].unit !== null) seq.push(i);
  }
  const n = seq.length;
  if (n < SINGLE_LINE_THRESHOLD) return noLoop;

  // For each period p, count how many times the final p-unit cycle
  // repeats back-to-back at the tail of the sequence.
  for (let p = 1; p <= MAX_PERIOD; p++) {
    if (n < p * CYCLE_THRESHOLD) break;

    let occurrences = 1;
    while (n - (occurrences + 1) * p >= 0) {
      let same = true;
      for (let j = 0; j < p; j++) {
        if (
          lines[seq[n - p + j]].unit !== lines[seq[n - (occurrences + 1) * p + j]].unit
        ) {
          same = false;
          break;
        }
      }
      if (!same) break;
      occurrences++;
    }

    const threshold = p === 1 ? SINGLE_LINE_THRESHOLD : CYCLE_THRESHOLD;
    if (occurrences < threshold) continue;

    // Cut from the start of the second copy of the cycle, keeping the
    // first full cycle so the content still reads naturally.
    const cutSeqIdx = n - occurrences * p + p;
    const cutOffset = lines[seq[cutSeqIdx]].start;
    return {
      loopDetected: true,
      cleanedText: accumulated.slice(0, cutOffset).replace(/\s+$/, ""),
      trimmedChars: accumulated.length - cutOffset,
    };
  }

  return noLoop;
}

/**
 * Streaming wrapper around inspectForLoop. Feed the full accumulated text
 * after each appended chunk; the first detection returns the cleaned text
 * once, after which the caller is expected to stop streaming.
 */
export class StreamingLoopGuard {
  private triggered_ = false;
  private cleaned_ = "";

  push(
    accumulated: string
  ): { cleanedText: string | null; loopDetected: boolean } {
    if (this.triggered_) {
      return { cleanedText: null, loopDetected: true };
    }
    const result = inspectForLoop(accumulated);
    if (result.loopDetected) {
      this.triggered_ = true;
      this.cleaned_ = result.cleanedText;
      return { cleanedText: result.cleanedText, loopDetected: true };
    }
    return { cleanedText: null, loopDetected: false };
  }

  /** Cleaned full text as of the moment the loop was detected. */
  get cleanedText(): string {
    return this.cleaned_;
  }

  get triggered(): boolean {
    return this.triggered_;
  }
}
