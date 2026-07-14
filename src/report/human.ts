import type { Finding, Triage } from "../checks/types.js";
import type { Score } from "../score.js";

const TRIAGE_LABEL: Record<Triage, string> = {
  "well-fix-it": "We'll fix it",
  "just-so-you-know": "Just so you know",
  "your-call": "Your call",
};

/**
 * The plain-language report for the human, written to stderr.
 * Speaks outcomes and next steps, never code.
 */
export function renderHumanReport(path: string, findings: Finding[], score: Score): string {
  const lines: string[] = ["", `Revivify checked ${path}`, ""];
  lines.push(`  Trust: ${score.outOfTen}/10 — ${score.passing} of ${score.applicable} checks passing`);
  lines.push("");

  for (const f of findings) {
    if (f.verdict === "not-applicable") continue;
    lines.push(`  ${f.verdict === "pass" ? "✓" : "✗"} ${f.title}`);
    lines.push(`      ${f.standard}`);
    if (f.verdict === "fail") {
      lines.push(`      ${f.detail}`);
      if (f.fix) lines.push(`      → ${f.fix}  [${TRIAGE_LABEL[f.triage]}]`);
    }
    lines.push("");
  }

  const notApplicable = findings.filter((f) => f.verdict === "not-applicable");
  if (notApplicable.length > 0) {
    lines.push(`  (Not applicable here: ${notApplicable.map((f) => f.title).join(", ")})`);
    lines.push("");
  }

  if (score.shipReady) {
    lines.push("  Ship-ready ✅  — a perfect 10/10. Nothing broken was left behind.");
  } else {
    const failing = findings.filter((f) => f.verdict === "fail").length;
    lines.push(
      `  Not yet ⚠️  — ${failing} ${failing === 1 ? "check" : "checks"} to fix. Fix them, then re-run revivify check to watch the score climb to 10.`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
