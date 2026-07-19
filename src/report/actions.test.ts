import { test } from "node:test";
import assert from "node:assert/strict";
import { planActions } from "./actions.js";
import { scoreFindings } from "../score.js";
import type { Finding, Triage, Verdict } from "../checks/types.js";
import type { CheckOutput } from "./types.js";

function finding(id: string, verdict: Verdict, triage: Triage): Finding {
  return {
    id,
    title: `${id}-title`,
    standard: `${id}-standard`,
    learnMore: `https://std.test/${id}`,
    verdict,
    triage,
    detail: `${id}-detail`,
    ...(verdict === "fail" ? { fix: `${id}-fix` } : {}),
  };
}

function output(findings: Finding[], accept: Record<string, string> = {}): CheckOutput {
  return { path: "p", mode: "fast", findings, score: scoreFindings(findings, accept) };
}

test("well-fix-it fails become an ordered fix plan, each with its fix", () => {
  const actions = planActions(
    output([
      finding("a", "fail", "well-fix-it"),
      finding("ok", "pass", "well-fix-it"),
      finding("b", "fail", "well-fix-it"),
    ]),
  );
  assert.deepEqual(
    actions.wellFixIt.map((x) => x.id),
    ["a", "b"], // registry order preserved; passing check excluded
  );
  assert.ok(actions.wellFixIt.every((x) => x.fix.length > 0));
});

test("an unresolved your-call is a human decision, never in the fix plan", () => {
  const actions = planActions(output([finding("noindex", "fail", "your-call")]));
  assert.equal(actions.wellFixIt.length, 0);
  assert.deepEqual(
    actions.yourCall.map((x) => x.id),
    ["noindex"],
  );
});

test("an accepted your-call drops out of the decision queue (it's settled)", () => {
  const actions = planActions(output([finding("noindex", "fail", "your-call")], { noindex: "staging" }));
  assert.equal(actions.yourCall.length, 0);
});

test("a just-so-you-know issue is informational, not a fix or a decision", () => {
  const actions = planActions(output([finding("note", "fail", "just-so-you-know")]));
  assert.equal(actions.wellFixIt.length, 0);
  assert.equal(actions.yourCall.length, 0);
  assert.deepEqual(
    actions.jsyk.map((x) => x.id),
    ["note"],
  );
});
