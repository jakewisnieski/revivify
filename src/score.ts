import type { Finding } from "./checks/types.js";

export interface Score {
  /** Applicable checks that passed. */
  passing: number;
  /** Checks that applied to this page (non-applicable ones drop out). */
  applicable: number;
  /** Headline trust score, 0–10. */
  outOfTen: number;
  /** True only when every applicable check passes — the ship-ready bar. */
  shipReady: boolean;
}

/**
 * Roll findings up into a trust score.
 *
 * Non-applicable checks drop out of the denominator so a simple page is never
 * penalised for rules it can't violate. Ship-ready is a perfect 10/10
 * (decision log #9): every applicable check passing. To keep the headline
 * honest, we never display a 10 unless the page is genuinely ship-ready.
 */
export function scoreFindings(findings: Finding[]): Score {
  const applicableFindings = findings.filter((f) => f.verdict !== "not-applicable");
  const applicable = applicableFindings.length;
  const passing = applicableFindings.filter((f) => f.verdict === "pass").length;

  const shipReady = passing === applicable; // includes the "nothing to check" case
  const ratio = applicable === 0 ? 1 : passing / applicable;
  let outOfTen = Math.round(ratio * 10);
  if (!shipReady && outOfTen >= 10) outOfTen = 9;

  return { passing, applicable, outOfTen, shipReady };
}
