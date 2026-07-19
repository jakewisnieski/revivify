import type { Finding } from "./checks/types.js";

/**
 * A "your call" judgment item and how it was settled — the parallel track that
 * sits alongside the objective score, never folded into it (decision-log #18).
 */
export interface YourCallItem {
  id: string;
  title: string;
  /**
   * - `accepted`   — knowingly accepted in `.revivify.yaml` `accept:`, with a recorded reason.
   * - `unresolved` — still open; needs a human decision (accept it or fix it).
   *
   * A your-call check that *passes* isn't listed here at all — it's a genuine
   * objective pass. Only a failing judgment item needs a resolution track.
   */
  status: "accepted" | "unresolved";
  /** The recorded acceptance reason — present only when `accepted`. */
  reason?: string;
}

export interface Score {
  /** Objective checks that passed (the well-fix-it / just-so-you-know track). */
  passing: number;
  /** Objective checks that applied — the pass/fail denominator; your-call is excluded. */
  applicable: number;
  /** Headline trust score, 0–10. */
  outOfTen: number;
  /** True only when every objective check passes AND every your-call item is resolved. */
  shipReady: boolean;
  /**
   * The your-call track: judgment items kept parallel to the objective score.
   * Never counted in the denominator, never faked as a pass, never dropped —
   * an accepted item stays visible with its reason (decision-log #18).
   */
  yourCall: YourCallItem[];
}

/**
 * Roll findings up into a trust score across two separate tracks (decision-log #18):
 *
 *  - **Objective** — the pass/fail checks (well-fix-it / just-so-you-know, plus a
 *    your-call check that genuinely *passes*). Non-applicable ones drop from the
 *    denominator so a simple page isn't penalised for rules it can't violate.
 *    Ship-ready needs every one of these passing. A your-call check that has been
 *    fixed simply passes here — that's how "fixed → resolved" is expressed.
 *  - **Your call** — a *failing* judgment item only the human should settle.
 *    Resolved by fixing it (then it passes objectively) or *accepting* it with a
 *    reason in `.revivify.yaml` `accept:`. An accepted item is never scored as
 *    passing (no false green — #10/#12) and never dropped (stays visible — #9);
 *    it simply stops blocking the bar.
 *
 * The bar is a perfect 10/10 (#9): every objective check passing AND every
 * failing your-call item resolved. To keep the headline honest we never display
 * a 10 unless the page is genuinely ship-ready.
 */
export function scoreFindings(findings: Finding[], accept: Record<string, string> = {}): Score {
  // A your-call item exists only when the judgment check *fails*; a passing one
  // is a genuine objective pass and stays in the denominator.
  const isYourCallItem = (f: Finding) => f.triage === "your-call" && f.verdict === "fail";

  const objective = findings.filter((f) => f.verdict !== "not-applicable" && !isYourCallItem(f));
  const applicable = objective.length;
  const passing = objective.filter((f) => f.verdict === "pass").length;

  const yourCall: YourCallItem[] = findings.filter(isYourCallItem).map((f): YourCallItem => {
    // A judgment item resolves only with an explicit acceptance — and that needs a reason.
    const reason = accept[f.id];
    if (reason) return { id: f.id, title: f.title, status: "accepted", reason };
    return { id: f.id, title: f.title, status: "unresolved" };
  });

  const objectivePass = passing === applicable; // includes the "nothing to check" case
  const yourCallResolved = yourCall.every((y) => y.status === "accepted");
  const shipReady = objectivePass && yourCallResolved;

  const ratio = applicable === 0 ? 1 : passing / applicable;
  let outOfTen = Math.round(ratio * 10);
  if (!shipReady && outOfTen >= 10) outOfTen = 9;

  return { passing, applicable, outOfTen, shipReady, yourCall };
}
