import type { Finding } from "../checks/types.js";
import type { Score } from "../score.js";

/** Everything a report renderer needs — produced by the check command. */
export interface CheckOutput {
  path: string;
  /** "full" = real Lighthouse audit; "fast" = instant static pre-check. */
  mode: "full" | "fast";
  findings: Finding[];
  score: Score;
  /**
   * Checks turned off by `.revivify.yaml` toggles (M5.3 / FR-10). Dropped from
   * the score's denominator but surfaced so a disabled check is never a silent
   * green. Present only when at least one check was disabled.
   */
  disabled?: Finding[];
  /** Lighthouse category scores (0–1), present only in full mode. */
  categories?: Record<string, number | null>;
  /**
   * True when the target is a live URL: the page can be scored but fixes,
   * intent, and accept are read-only — there's no local project to write to
   * (FR-1's URL path; decision-log #29). The cockpit uses this to disable the
   * write actions with a plain reason.
   */
  readOnly?: boolean;
  /** Captured page intent from `.revivify/intent.md`, when the human wrote one. */
  intent?: string;
  /**
   * "Your call" acceptances (rule id → reason) from `.revivify.yaml`. Read and
   * surfaced here; the ship-ready bar consumes it in M4.2 (decision-log #18/#19).
   */
  accept?: Record<string, string>;
}
