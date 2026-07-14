import type { Finding } from "../checks/types.js";
import type { Score } from "../score.js";

/**
 * The structured report for the coding agent, written to stdout.
 *
 * NOTE (M0): this emits JSON. The spec calls for TOON (token-oriented notation)
 * to cut agent-token cost; that encoding swaps in behind this seam in a later
 * milestone without changing any caller.
 */
export function renderAgentReport(path: string, findings: Finding[], score: Score): string {
  const payload = {
    tool: "revivify",
    command: "check",
    path,
    score: {
      outOfTen: score.outOfTen,
      passing: score.passing,
      applicable: score.applicable,
      shipReady: score.shipReady,
    },
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
