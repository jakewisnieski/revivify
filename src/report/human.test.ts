import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFindings } from "../score.js";
import { renderHumanReport } from "./human.js";
import type { Finding, Triage, Verdict } from "../checks/types.js";
import type { CheckOutput } from "./types.js";

function finding(id: string, verdict: Verdict, triage: Triage): Finding {
  return { id, title: id, standard: `${id}-standard`, learnMore: `https://std.test/${id}`, verdict, triage, detail: `${id}-detail`, ...(verdict === "fail" ? { fix: `${id}-fix` } : {}) };
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

test("the plan frames the well-fix-it batch as one approval and never offers to auto-fix your-call", () => {
  const report = render([
    finding("html-lang", "fail", "well-fix-it"),
    finding("noindex", "fail", "your-call"),
  ]);
  assert.match(report, /My plan — approve in one step/);
  // The safe batch is proposed as a single approval…
  assert.match(report, /I can safely fix the 1 "we'll fix it" check above/);
  // …and the your-call item is explicitly hands-off, not auto-fixed.
  assert.match(report, /yours to settle — I won't touch it/);
});

test("a ship-ready page shows no plan block", () => {
  const report = render([finding("html-lang", "pass", "well-fix-it")]);
  assert.doesNotMatch(report, /My plan/);
  assert.match(report, /Ship-ready/);
});

test("a failing finding shows a Learn more link to its standard (cite → teach → verify)", () => {
  const objective = render([finding("html-lang", "fail", "well-fix-it")]);
  assert.match(objective, /Learn more: https:\/\/std\.test\/html-lang/);
  // your-call items get the link too
  const yourCall = render([finding("noindex", "fail", "your-call")]);
  assert.match(yourCall, /Learn more: https:\/\/std\.test\/noindex/);
});
