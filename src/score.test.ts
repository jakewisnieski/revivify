import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFindings } from "./score.js";
import type { Finding, Verdict } from "./checks/types.js";

function finding(verdict: Verdict): Finding {
  return { id: "x", title: "x", standard: "s", verdict, triage: "just-so-you-know", detail: "" };
}

test("all applicable checks passing → a perfect 10 and ship-ready", () => {
  const score = scoreFindings([finding("pass"), finding("pass")]);
  assert.equal(score.outOfTen, 10);
  assert.equal(score.shipReady, true);
});

test("a single failing check makes the page not ship-ready", () => {
  const score = scoreFindings([finding("pass"), finding("fail")]);
  assert.equal(score.shipReady, false);
});

test("non-applicable checks drop out of the denominator", () => {
  const score = scoreFindings([finding("pass"), finding("pass"), finding("not-applicable")]);
  assert.equal(score.applicable, 2);
  assert.equal(score.passing, 2);
  assert.equal(score.shipReady, true);
});

test("the headline never shows 10 unless every applicable check passes", () => {
  // 19 pass / 1 fail rounds to 10, but ship-ready is 10/10 — so cap at 9.
  const findings: Finding[] = Array.from({ length: 19 }, () => finding("pass"));
  findings.push(finding("fail"));
  const score = scoreFindings(findings);
  assert.equal(score.shipReady, false);
  assert.ok(score.outOfTen <= 9, `expected <= 9, got ${score.outOfTen}`);
});
