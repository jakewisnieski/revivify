import type { Finding } from "../checks/types.js";
import type { Score } from "../score.js";

/** Everything a report renderer needs — produced by the check command. */
export interface CheckOutput {
  path: string;
  /** "full" = real Lighthouse audit; "fast" = instant static pre-check. */
  mode: "full" | "fast";
  findings: Finding[];
  score: Score;
  /** Lighthouse category scores (0–1), present only in full mode. */
  categories?: Record<string, number | null>;
  /** Captured page intent from `.revivify/intent.md`, when the human wrote one. */
  intent?: string;
  /**
   * "Your call" acceptances (rule id → reason) from `.revivify.yaml`. Read and
   * surfaced here; the ship-ready bar consumes it in M4.2 (decision-log #18/#19).
   */
  accept?: Record<string, string>;
}
