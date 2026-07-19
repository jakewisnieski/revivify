import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAgentReport } from "./agent.js";
import { scoreFindings } from "../score.js";
import type { Finding } from "../checks/types.js";
import type { CheckOutput } from "./types.js";

const findings: Finding[] = [
  { id: "html-lang", title: "lang", standard: "s", verdict: "fail", triage: "well-fix-it", detail: "d", fix: "add lang" },
  { id: "noindex", title: "noindex", standard: "s", verdict: "fail", triage: "your-call", detail: "d", fix: "remove noindex" },
  { id: "title", title: "title", standard: "s", verdict: "pass", triage: "just-so-you-know", detail: "d" },
];

test("the agent report emits the triage-as-actions grouping", () => {
  const output: CheckOutput = { path: "p", mode: "fast", findings, score: scoreFindings(findings) };
  const payload = JSON.parse(renderAgentReport(output));

  assert.ok(payload.actions, "payload has an actions object");
  assert.deepEqual(payload.actions.wellFixIt.map((x: { id: string }) => x.id), ["html-lang"]);
  assert.deepEqual(payload.actions.yourCall.map((x: { id: string }) => x.id), ["noindex"]);
  // The full findings list is still present for completeness.
  assert.equal(payload.findings.length, 3);
});
