import { loadPage } from "../loadPage.js";
import { rules } from "../checks/registry.js";
import { scoreFindings } from "../score.js";
import { renderHumanReport } from "../report/human.js";
import { renderAgentReport } from "../report/agent.js";
import type { Finding } from "../checks/types.js";

/**
 * Run every registered check against a page and emit both audiences:
 * a plain-language report to stderr (human) and structured results to stdout (agent).
 * Returns the process exit code: 0 when ship-ready (10/10), 1 otherwise.
 */
export async function runCheck(path: string): Promise<number> {
  const page = await loadPage(path);

  const findings: Finding[] = rules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    standard: rule.standard,
    ...rule.run(page),
  }));

  const score = scoreFindings(findings);

  process.stderr.write(renderHumanReport(page.path, findings, score));
  process.stdout.write(renderAgentReport(page.path, findings, score));

  return score.shipReady ? 0 : 1;
}
