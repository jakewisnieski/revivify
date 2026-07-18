import { stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { loadPage } from "../loadPage.js";
import { rules as staticRules } from "../checks/registry.js";
import { runLighthouse } from "../engine/lighthouse.js";
import { mapReportToFindings } from "../checks/lighthouse.js";
import { scoreFindings } from "../score.js";
import { loadIntent, loadConfig } from "../config.js";
import { renderHumanReport } from "../report/human.js";
import { renderAgentReport } from "../report/agent.js";
import type { Finding } from "../checks/types.js";
import type { CheckOutput } from "../report/types.js";
import type { ProgressFn } from "../engine/lighthouse.js";

/**
 * The project directory that holds `.revivify.yaml` and `.revivify/intent.md`.
 * The path Revivify is pointed at is that directory (per the `gate` convention);
 * if it's a file, its parent folder is the project root.
 */
async function projectDirOf(path: string): Promise<string> {
  const abs = resolve(path);
  try {
    if ((await stat(abs)).isDirectory()) return abs;
  } catch {
    // fall through — a non-existent path just resolves to its parent dir
  }
  return dirname(abs);
}

export interface CheckOptions {
  /** "full" runs the real Lighthouse audit (default); "fast" runs the instant static pre-check. */
  mode: "full" | "fast";
  /** Optional progress reporter, so a UI can show the audit happening live. */
  onProgress?: ProgressFn;
}

/** Build the check result for a page without rendering it (used by the CLI, walkthrough, and UI). */
export async function check(path: string, options: CheckOptions): Promise<CheckOutput> {
  // Page intent and "your call" acceptances are optional context, read from the
  // project dir. Both fall back to empty/undefined, so they never fail a check.
  const projectDir = await projectDirOf(path);
  const [intent, config] = await Promise.all([loadIntent(projectDir), loadConfig(projectDir)]);
  const accept = config.accept ?? {};
  const context = {
    ...(intent ? { intent } : {}),
    ...(Object.keys(accept).length > 0 ? { accept } : {}),
  };

  if (options.mode === "fast") {
    const page = await loadPage(path);
    const findings: Finding[] = staticRules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      standard: rule.standard,
      ...rule.run(page),
    }));
    return { path: page.path, mode: "fast", findings, score: scoreFindings(findings), ...context };
  }

  const report = await runLighthouse(path, { onProgress: options.onProgress });
  options.onProgress?.({ phase: "done", message: "Scoring the results…" });
  const findings = mapReportToFindings(report);
  return {
    path,
    mode: "full",
    findings,
    score: scoreFindings(findings),
    categories: report.categories,
    ...context,
  };
}

/**
 * Run a check and emit both audiences: a plain-language report to stderr (human)
 * and structured results to stdout (agent). Returns the exit code: 0 when
 * ship-ready (10/10), 1 otherwise.
 */
export async function runCheck(path: string, options: CheckOptions): Promise<number> {
  if (options.mode === "full") {
    process.stderr.write("Running the full audit (Lighthouse) — this takes ~30–45s…\n");
  }
  const output = await check(path, options);
  process.stderr.write(renderHumanReport(output));
  process.stdout.write(renderAgentReport(output));
  return output.score.shipReady ? 0 : 1;
}
