import type { Triage } from "../checks/types.js";
import { INTENT_FILENAME } from "../config.js";
import type { CheckOutput } from "./types.js";

const TRIAGE_LABEL: Record<Triage, string> = {
  "well-fix-it": "We'll fix it",
  "just-so-you-know": "Just so you know",
  "your-call": "Your call",
};

const CATEGORY_LABEL: Record<string, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  seo: "SEO",
  "best-practices": "Best Practices",
};

function categoryLine(categories: Record<string, number | null>): string {
  const parts = Object.entries(categories)
    .filter(([, score]) => score !== null)
    .map(([id, score]) => `${CATEGORY_LABEL[id] ?? id} ${Math.round((score ?? 0) * 100)}`);
  return parts.length ? `  Lighthouse: ${parts.join(" · ")}` : "";
}

/**
 * The plain-language report for the human, written to stderr.
 * Speaks outcomes and next steps, never code.
 */
export function renderHumanReport(output: CheckOutput): string {
  const { path, mode, findings, score, categories } = output;
  const lines: string[] = ["", `Revivify checked ${path}`];
  if (mode === "fast") lines.push("  (fast pre-check — static checks only; run without --fast for the full audit)");
  lines.push("");
  lines.push(`  Trust: ${score.outOfTen}/10 — ${score.passing} of ${score.applicable} checks passing`);
  if (categories) {
    const line = categoryLine(categories);
    if (line) lines.push(line);
  }
  lines.push(
    output.intent
      ? `  Intent noted (${INTENT_FILENAME}).`
      : `  Tip: add ${INTENT_FILENAME} so deliberate choices aren't flagged as mistakes.`,
  );
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
      `  Not yet ⚠️  — ${failing} ${failing === 1 ? "check" : "checks"} to fix. Fix ${failing === 1 ? "it" : "them"}, then re-run revivify check to watch the score climb to 10.`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
