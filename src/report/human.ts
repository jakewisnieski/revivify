import type { Finding, Triage } from "../checks/types.js";
import { CONFIG_FILENAME, INTENT_FILENAME } from "../config.js";
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
 *
 * "Your call" judgment items get their own section (decision-log #18): an
 * accepted one shows with its reason and is *never* rendered as a passing ✓;
 * an unresolved one is named as a decision the human still owes.
 */
export function renderHumanReport(output: CheckOutput): string {
  const { path, mode, findings, score, categories } = output;
  const byId = new Map(findings.map((f) => [f.id, f]));
  const accepted = score.yourCall.filter((y) => y.status === "accepted");
  const unresolved = score.yourCall.filter((y) => y.status === "unresolved");

  const lines: string[] = ["", `Revivify checked ${path}`];
  if (mode === "fast") lines.push("  (fast pre-check — static checks only; run without --fast for the full audit)");
  lines.push("");
  lines.push(`  Trust: ${score.outOfTen}/10 — ${score.passing} of ${score.applicable} checks passing`);
  if (accepted.length > 0) {
    lines.push(`  ${accepted.length} your-call ${plural(accepted.length, "item")} accepted — shown below with the reason (not counted as passing).`);
  }
  if (unresolved.length > 0) {
    lines.push(`  ${unresolved.length} your-call ${plural(unresolved.length, "item")} still your call — accept or fix (see below).`);
  }
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

  // Objective checks. A *failing* your-call is held out for its own section
  // below; a passing your-call is a genuine objective pass and shows here as ✓
  // (so the ✓ count matches the "N of M passing" headline).
  for (const f of findings) {
    if (f.verdict === "not-applicable") continue;
    if (f.triage === "your-call" && f.verdict === "fail") continue;
    lines.push(`  ${f.verdict === "pass" ? "✓" : "✗"} ${f.title}`);
    lines.push(`      ${f.standard}`);
    if (f.verdict === "fail") {
      lines.push(`      ${f.detail}`);
      if (f.fix) lines.push(`      → ${f.fix}  [${TRIAGE_LABEL[f.triage]}]`);
      lines.push(`      Learn more: ${f.learnMore}`);
    }
    lines.push("");
  }

  if (score.yourCall.length > 0) {
    lines.push("  Your call — judgment items only you can settle:");
    lines.push("");
    for (const y of score.yourCall) {
      const f = byId.get(y.id);
      if (y.status === "accepted") {
        // Deliberately NOT a ✓ — an accepted item is resolved, not passing (honesty, #10/#12).
        lines.push(`  ◇ ${y.title}  [accepted]`);
        if (f) lines.push(`      ${f.standard}`);
        if (f) lines.push(`      ${f.detail}`);
        if (f) lines.push(`      Learn more: ${f.learnMore}`);
        lines.push(`      Accepted: "${y.reason}"`);
      } else {
        lines.push(`  ◇ ${y.title}  [needs your decision]`);
        if (f) lines.push(`      ${f.standard}`);
        if (f) lines.push(`      ${f.detail}`);
        if (f?.fix) lines.push(`      → ${f.fix}`);
        if (f) lines.push(`      Learn more: ${f.learnMore}`);
        lines.push(`      This one's your call: fix it, or accept it with a reason in ${CONFIG_FILENAME} (accept:).`);
      }
      lines.push("");
    }
  }

  const notApplicable = findings.filter((f) => f.verdict === "not-applicable");
  if (notApplicable.length > 0) {
    lines.push(`  (Not applicable here: ${notApplicable.map((f) => f.title).join(", ")})`);
    lines.push("");
  }

  const disabled = output.disabled ?? [];
  if (disabled.length > 0) {
    lines.push(
      `  (Disabled in ${CONFIG_FILENAME}, not scored: ${disabled.map((f) => f.title).join(", ")})`,
    );
    lines.push("");
  }

  // The own-the-fix plan: frame the safe batch as one approval, keep your-call
  // items out of it (decision-log #20 — "we'll fix it" is defined-safe; your-call
  // is decided individually and never auto-applied).
  const fixable = findings.filter((f) => f.triage === "well-fix-it" && f.verdict === "fail");
  if (fixable.length > 0 || unresolved.length > 0) {
    lines.push("  My plan — approve in one step:");
    if (fixable.length > 0) {
      lines.push(
        `    • I can safely fix the ${fixable.length} "we'll fix it" ${plural(fixable.length, "check")} above (the → items) in one batch, then re-check. Want me to?`,
      );
    }
    if (unresolved.length > 0) {
      lines.push(
        `    • The ${unresolved.length} "your call" ${plural(unresolved.length, "item")} ${unresolved.length === 1 ? "is" : "are"} yours to settle — I won't touch ${unresolved.length === 1 ? "it" : "them"}. Fix, or accept with a reason.`,
      );
    }
    lines.push("");
  }

  if (score.shipReady) {
    lines.push("  Ship-ready ✅  — a perfect 10/10. Nothing broken was left behind.");
  } else {
    lines.push(`  Not yet ⚠️  — ${todoSentence(findings, unresolved.length)}`);
  }
  lines.push("");

  return lines.join("\n");
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/** What's left before the bar clears: objective fixes and/or your-call decisions. */
function todoSentence(findings: Finding[], unresolved: number): string {
  const objectiveFails = findings.filter((f) => f.verdict === "fail" && f.triage !== "your-call").length;
  const parts: string[] = [];
  if (objectiveFails > 0) {
    parts.push(`${objectiveFails} ${plural(objectiveFails, "check")} to fix`);
  }
  if (unresolved > 0) {
    parts.push(`${unresolved} your-call ${plural(unresolved, "decision")} to make (accept or fix)`);
  }
  const todo = parts.join(", and ");
  return `${todo}. Sort ${objectiveFails + unresolved === 1 ? "it" : "them"} out, then re-run revivify check to watch the score climb to 10.`;
}
