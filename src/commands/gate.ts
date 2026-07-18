import { check } from "./check.js";
import { loadConfig, type RevivifyConfig } from "../config.js";
import type { CheckOutput } from "../report/types.js";
import type { Score } from "../score.js";

export interface GateDecision {
  /** True only when we should stop the agent from calling the work "done". */
  blocked: boolean;
  /** Process exit code: 2 blocks a Claude Code Stop hook; 0 lets it through. */
  exitCode: number;
}

/**
 * The pure gate decision: does this score clear the bar, and — given the
 * enforcement mode — should we block "done"?
 *
 * `warn` never blocks (a nudge only); `block` stops "done" until the score
 * reaches the threshold. A Claude Code Stop hook treats exit code 2 as "keep
 * going", which is exactly what a block means here.
 */
export function decideGate(score: Score, config: RevivifyConfig): GateDecision {
  const clearsBar = score.outOfTen >= config.threshold;
  if (clearsBar) return { blocked: false, exitCode: 0 };
  if (config.enforcement === "block") return { blocked: true, exitCode: 2 };
  return { blocked: false, exitCode: 0 };
}

/** A compact nudge for the hook — shorter than the full `check` report. */
export function renderGateReport(
  output: CheckOutput,
  config: RevivifyConfig,
  decision: GateDecision,
): string {
  const { score } = output;
  const modeNote = output.mode === "fast" ? " (fast pre-check)" : "";
  const lines: string[] = ["", `Revivify gate — ${output.path}${modeNote}`];
  lines.push(`  Trust: ${score.outOfTen}/10 — ${score.passing} of ${score.applicable} checks passing`);

  const failing = output.findings.filter((f) => f.verdict === "fail");
  for (const f of failing) lines.push(`  ✗ ${f.title}`);

  const clearsBar = score.outOfTen >= config.threshold;
  if (clearsBar) {
    lines.push(`  Ship-ready ✅ — clears the bar (${config.threshold}/10).`);
  } else if (decision.blocked) {
    lines.push(
      `  Not ship-ready — blocking "done" until the score reaches ${config.threshold}/10. Fix the checks above, then re-check.`,
    );
  } else {
    lines.push(
      `  Heads up: not ship-ready yet (bar is ${config.threshold}/10). This is a nudge — enforcement is "warn", so nothing is blocked.`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Run the "done" gate: read the project config, check the page, and decide
 * whether to block. The check mode follows enforcement — a fast static
 * pre-check while warning (instant, no Chrome), the full audit once blocking.
 *
 * Designed to be safe as a hook: if there's no page to check yet (mid-build),
 * it reports and exits 0 rather than crashing the agent's session.
 */
export async function runGate(dir: string): Promise<number> {
  const config = await loadConfig(dir);
  const mode = config.enforcement === "block" ? "full" : "fast";

  let output: CheckOutput;
  try {
    output = await check(dir, { mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nRevivify gate: nothing to check yet — ${message}\n\n`);
    return 0;
  }

  const decision = decideGate(output.score, config);
  process.stderr.write(renderGateReport(output, config, decision));
  return decision.exitCode;
}
