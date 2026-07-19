import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFindings } from "./score.js";
import type { Finding, Triage, Verdict } from "./checks/types.js";

function finding(verdict: Verdict): Finding {
  return { id: "x", title: "x", standard: "s", verdict, triage: "just-so-you-know", detail: "" };
}

/** A finding with an explicit id/triage — for the your-call (judgment) track. */
function item(id: string, verdict: Verdict, triage: Triage): Finding {
  return { id, title: id, standard: "s", verdict, triage, detail: "" };
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

test("a your-call item stays out of the objective pass/fail denominator", () => {
  const score = scoreFindings([finding("pass"), item("noindex", "fail", "your-call")]);
  // Only the one objective check counts toward the denominator.
  assert.equal(score.applicable, 1);
  assert.equal(score.passing, 1);
  assert.equal(score.yourCall.length, 1);
});

test("an unresolved your-call item blocks the bar and is named for a decision", () => {
  const score = scoreFindings([finding("pass"), item("noindex", "fail", "your-call")]);
  assert.equal(score.shipReady, false); // objective is clean, but the your-call is open
  assert.ok(score.outOfTen <= 9, `expected <= 9, got ${score.outOfTen}`); // never a false 10
  assert.deepEqual(score.yourCall, [{ id: "noindex", title: "noindex", status: "unresolved" }]);
});

test("an accepted your-call item clears the bar and stays visible with its reason", () => {
  const score = scoreFindings(
    [finding("pass"), item("noindex", "fail", "your-call")],
    { noindex: "staging page, deliberately hidden" },
  );
  assert.equal(score.shipReady, true); // resolved → bar clears
  assert.equal(score.outOfTen, 10);
  // Still surfaced — never dropped, never scored as a pass.
  assert.deepEqual(score.yourCall, [
    { id: "noindex", title: "noindex", status: "accepted", reason: "staging page, deliberately hidden" },
  ]);
  assert.equal(score.passing, 1); // the accepted item is NOT counted among the passes
});

test("accepting without a reason does not resolve a your-call item", () => {
  // An empty reason is not a real acceptance — the item stays unresolved.
  const score = scoreFindings([item("noindex", "fail", "your-call")], { noindex: "" });
  assert.equal(score.shipReady, false);
  assert.equal(score.yourCall[0].status, "unresolved");
});

test("a fixed your-call item (now passing) counts as an objective pass and clears the bar", () => {
  // Once fixed the judgment check passes, so it's a genuine objective pass — not
  // a pending your-call. That's how "fixed → resolved" is expressed.
  const score = scoreFindings([finding("pass"), item("noindex", "pass", "your-call")]);
  assert.equal(score.shipReady, true);
  assert.equal(score.applicable, 2);
  assert.equal(score.passing, 2);
  assert.equal(score.yourCall.length, 0);
});
