import type { CheckOutput } from "./types.js";

/**
 * The structured report for the coding agent, written to stdout.
 *
 * NOTE (M0): this emits JSON. The spec calls for TOON (token-oriented notation)
 * to cut agent-token cost; that encoding swaps in behind this seam in a later
 * milestone without changing any caller.
 */
export function renderAgentReport(output: CheckOutput): string {
  const { path, mode, findings, score, categories } = output;
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
