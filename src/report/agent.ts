import type { CheckOutput } from "./types.js";
import { planActions } from "./actions.js";

/**
 * The structured report for the coding agent, written to stdout.
 *
 * NOTE (M0): this emits JSON. The spec calls for TOON (token-oriented notation)
 * to cut agent-token cost; that encoding swaps in behind this seam in a later
 * milestone without changing any caller.
 */
export function renderAgentReport(output: CheckOutput): string {
  const { path, mode, findings, score, categories } = output;
  const actions = planActions(output);
  const payload = {
    tool: "revivify",
    command: "check",
    mode,
    path,
    score: {
      outOfTen: score.outOfTen,
      passing: score.passing,
      applicable: score.applicable,
      shipReady: score.shipReady,
      // The your-call track: judgment items and how each is settled. Parallel to
      // the objective pass/fail, never folded into it (decision-log #18).
      yourCall: score.yourCall.map((y) => ({
        id: y.id,
        title: y.title,
        status: y.status,
        ...(y.reason ? { reason: y.reason } : {}),
      })),
    },
    ...(categories
      ? {
          categories: Object.fromEntries(
            Object.entries(categories).map(([id, value]) => [
              id,
              value === null ? null : Math.round(value * 100),
            ]),
          ),
        }
      : {}),
    ...(output.intent ? { intent: output.intent } : {}),
    ...(output.accept && Object.keys(output.accept).length > 0 ? { accept: output.accept } : {}),
    // Triage-as-actions: the own-the-fix loop the agent drives (decision-log #20).
    // well-fix-it = an ordered fix plan the agent applies; your-call = a human
    // decision queue, never auto-applied; just-so-you-know = informational.
    actions,
    findings: findings.map((f) => ({
      id: f.id,
      title: f.title,
      verdict: f.verdict,
      standard: f.standard,
      triage: f.triage,
      detail: f.detail,
      ...(f.fix ? { fix: f.fix } : {}),
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
