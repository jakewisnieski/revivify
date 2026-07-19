import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFindings } from "../score.js";
import { renderHumanReport } from "./human.js";
import type { Finding, Triage, Verdict } from "../checks/types.js";
import type { CheckOutput } from "./types.js";

function finding(id: string, verdict: Verdict, triage: Triage): Finding {
  return { id, title: id, standard: `${id}-standard`, verdict, triage, detail: `${id}-detail`, ...(verdict === "fail" ? { fix: `${id}-fix` } : {}) };
}

function render(findings: Finding[], accept: Record<string, string> = {}): string {
  const score = scoreFindings(findings, accept);
  const output: CheckOutput = { path: "p", mode: "fast", findings, score };
  return renderHumanReport(output);
}

test("the rendered ✓ count matches the 'N of M passing' headline (passing your-call included)", () => {
  // A passing your-call is a genuine objective pass — it must render as a ✓.
  const report = render([finding("html-lang", "pass", "well-fix-it"), finding("contrast", "pass", "your-call")]);
  assert.match(report, /2 of 2 checks passing/);
  assert.equal((report.match(/  ✓ /g) ?? []).length, 2);
  assert.doesNotMatch(report, /Your call — judgment/); // nothing pending, no section
});

test("an accepted your-call shows its reason and is never rendered as a passing ✓ (honesty)", () => {
  const report = render([finding("noindex", "fail", "your-call")], { noindex: "staging page" });
  assert.match(report, /Your call — judgment items/);
  assert.match(report, /\[accepted\]/);
  assert.match(report, /Accepted: "staging page"/);
  // The accepted line must not be a passing checkmark.
  assert.doesNotMatch(report, /✓ noindex/);
});

test("an unresolved your-call is named as a decision the human still owes", () => {
  const report = render([finding("noindex", "fail", "your-call")]);
  assert.match(report, /\[needs your decision\]/);
  assert.match(report, /fix it, or accept it with a reason/);
  assert.match(report, /1 your-call decision to make/); // footer
  assert.doesNotMatch(report, /Ship-ready/);
});
