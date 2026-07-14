import { test } from "node:test";
import assert from "node:assert/strict";
import { LIGHTHOUSE_RULE_COUNT, mapReportToFindings } from "./lighthouse.js";
import { scoreFindings } from "../score.js";
import type { LighthouseAudit, LighthouseReport } from "../engine/lighthouse.js";

// The Lighthouse audit ids the rules read (kept in sync with lighthouse.ts).
const AUDIT_IDS = [
  "image-alt", "color-contrast", "html-has-lang", "label",
  "largest-contentful-paint", "cumulative-layout-shift", "image-delivery-insight",
  "document-title", "meta-description", "meta-viewport", "is-crawlable",
  "is-on-https", "errors-in-console",
];

function report(overrides: Record<string, LighthouseAudit> = {}): LighthouseReport {
  const audits: Record<string, LighthouseAudit> = {};
  for (const id of AUDIT_IDS) audits[id] = { id, score: 1, scoreDisplayMode: "binary" };
  return {
    categories: { performance: 1, accessibility: 1, seo: 1, "best-practices": 1 },
    audits: { ...audits, ...overrides },
    finalUrl: "http://localhost/",
  };
}

function byId(findings: ReturnType<typeof mapReportToFindings>, id: string) {
  const f = findings.find((x) => x.id === id);
  assert.ok(f, `no finding with id ${id}`);
  return f;
}

test("an all-passing report yields one passing finding per rule and a perfect 10/10", () => {
  const findings = mapReportToFindings(report());
  assert.equal(findings.length, LIGHTHOUSE_RULE_COUNT);
  assert.ok(findings.every((f) => f.verdict === "pass"));
  const score = scoreFindings(findings);
  assert.equal(score.outOfTen, 10);
  assert.equal(score.shipReady, true);
});

test("a failing binary audit becomes a failing finding with a fix", () => {
  const findings = mapReportToFindings(report({ "image-alt": { id: "image-alt", score: 0, scoreDisplayMode: "binary" } }));
  const f = byId(findings, "image-alt");
  assert.equal(f.verdict, "fail");
  assert.equal(f.triage, "well-fix-it");
  assert.ok(f.fix);
  assert.equal(scoreFindings(findings).shipReady, false);
});

test("a null / notApplicable audit drops out of the denominator", () => {
  const findings = mapReportToFindings(report({ label: { id: "label", score: null, scoreDisplayMode: "notApplicable" } }));
  assert.equal(byId(findings, "form-labels").verdict, "not-applicable");
  const score = scoreFindings(findings);
  assert.equal(score.applicable, LIGHTHOUSE_RULE_COUNT - 1);
  assert.equal(score.shipReady, true); // everything else still passes
});

test("a numeric metric passes at >= 0.9 and fails below, appending the measured value", () => {
  assert.equal(
    byId(mapReportToFindings(report({ "largest-contentful-paint": { id: "lcp", score: 0.9, scoreDisplayMode: "numeric" } })), "lcp").verdict,
    "pass",
  );
  const failing = byId(
    mapReportToFindings(report({ "largest-contentful-paint": { id: "lcp", score: 0.4, scoreDisplayMode: "numeric", displayValue: "4.2 s" } })),
    "lcp",
  );
  assert.equal(failing.verdict, "fail");
  assert.match(failing.detail, /measured: 4\.2 s/);
});

test("an accidental noindex is a failing 'your call' finding", () => {
  const f = byId(
    mapReportToFindings(report({ "is-crawlable": { id: "is-crawlable", score: 0, scoreDisplayMode: "binary" } })),
    "noindex",
  );
  assert.equal(f.verdict, "fail");
  assert.equal(f.triage, "your-call");
});
