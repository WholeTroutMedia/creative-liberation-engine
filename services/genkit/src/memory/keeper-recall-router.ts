/**
 * STRATA recall gate — skip vector recall when there is no meaningful task signal
 * (avoids noisy or pointless Chroma queries).
 */

const GENERIC_PLACEHOLDERS = new Set([
  'general session start',
  'general',
  'free',
  '',
]);

export interface RecallRouterInput {
  /** Task string from HANDOFF or explicit context */
  taskHint: string;
  /** Whether HANDOFF.md was present and parseable */
  hadHandoffFile: boolean;
}

/**
 * Returns true if KEEPER should call scribeRecall for this boot.
 */
export function shouldInvokeKeeperRecall(input: RecallRouterInput): boolean {
  const t = input.taskHint.trim().toLowerCase();
  if (!t || GENERIC_PLACEHOLDERS.has(t)) {
    return false;
  }
  if (t.startsWith('working on workstream:') && t.length < 40) {
    return input.hadHandoffFile;
  }
  return true;
}
