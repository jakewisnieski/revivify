import { test } from "node:test";
import assert from "node:assert/strict";
import { staticHtmlRules } from "./staticHtml.js";
import { mapReportToFindings } from "./lighthouse.js";
import type { LighthouseReport } from "../engine/lighthouse.js";

/** A learnMore link is well-formed if it's an absolute https:// URL. */
function assertWellFormed(url: string, who: string): void {
  assert.ok(url && url.length > 0, `${who} has no learnMore URL`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    assert.fail(`${who} learnMore is not a valid URL: "${url}"`);
  }
  assert.equal(parsed.protocol, "https:", `${who} learnMore must be https: "${url}"`);
}

test("every static-HTML rule cites a well-formed learnMore URL", () => {
  for (const rule of staticHtmlRules) assertWellFormed(rule.learnMore, `static rule "${rule.id}"`);
});

test("every Lighthouse rule cites a well-formed learnMore URL (checked via the registry)", () => {
  // An empty report still yields one finding per rule (each carries its learnMore),
  // so this stays in lock-step with the live pack — a new rule without a link fails here.
  const report: LighthouseReport = { categories: {}, audits: {}, finalUrl: "https://example.com/" };
  const findings = mapReportToFindings(report);
  assert.ok(findings.length > 0, "expected findings from the Lighthouse pack");
  for (const f of findings) assertWellFormed(f.learnMore, `lighthouse rule "${f.id}"`);
});
