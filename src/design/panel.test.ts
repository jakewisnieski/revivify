import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDesignPanel, DESIGN_DISCLAIMER, type DesignPanel } from "./panel.js";
import type { DesignAdvisory } from "./critique.js";
import type { DesignFinding } from "./findings.js";
import { scoreFindings } from "../score.js";
import type { Finding } from "../checks/types.js";

// --- fixtures --------------------------------------------------------------

const CTA: DesignFinding = {
  tier: 2,
  title: "3 competing calls-to-action",
  detail: "…",
  citation: "Conversion best practice: one primary call-to-action",
  learnMore: "https://www.nngroup.com/articles/clear-calls-to-action/",
};
const CONTRAST: DesignFinding = {
  tier: 1,
  title: "Some text is below the minimum contrast",
  detail: "…",
  citation: "WCAG 2.2 SC 1.4.3 Contrast (Minimum)",
  learnMore: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
};
const OPINION: DesignFinding = { tier: 3, title: "The hero feels flat", detail: "…", citation: null };

const available = (findings: DesignFinding[]): DesignAdvisory => ({ status: "available", model: "qwen3-vl:8b", findings });

// --- tiering + labels ------------------------------------------------------

test("buildDesignPanel groups findings by tier in citability order", () => {
  const panel = buildDesignPanel(available([OPINION, CONTRAST, CTA]));
  assert.equal(panel.status, "available");
  if (panel.status !== "available") return;
  assert.deepEqual(panel.groups.map((g) => g.tier), [1, 2, 3]); // objective → heuristic → taste
  assert.equal(panel.groups[0].label, "Objective");
  assert.equal(panel.groups[1].label, "Heuristic");
  assert.equal(panel.groups[2].label, "Taste");
});

test("tier-3 items are flagged opinion with no citation; tiers 1–2 keep their citation", () => {
  const panel = buildDesignPanel(available([CONTRAST, CTA, OPINION]));
  if (panel.status !== "available") return assert.fail("expected available");
  const items = panel.groups.flatMap((g) => g.items);
  const opinion = items.find((i) => i.tier === 3);
  const cited = items.filter((i) => i.tier !== 3);
  assert.equal(opinion?.opinion, true);
  assert.equal(opinion?.citation, null);
  assert.ok(cited.every((i) => i.opinion === false && i.citation));
});

test("empty groups are omitted (only the tiers present are rendered)", () => {
  const panel = buildDesignPanel(available([OPINION]));
  if (panel.status !== "available") return assert.fail("expected available");
  assert.deepEqual(panel.groups.map((g) => g.tier), [3]);
});

// --- no-oversell + unavailable --------------------------------------------

test("the panel carries the no-oversell disclaimer", () => {
  const panel = buildDesignPanel(available([CTA]));
  if (panel.status !== "available") return assert.fail("expected available");
  assert.equal(panel.disclaimer, DESIGN_DISCLAIMER);
  // the copy must make silence-≠-good and never-scored explicit (#31, exp E)
  assert.match(panel.disclaimer, /never part of the trust score/i);
  assert.match(panel.disclaimer, /not proof the design is good/i);
  assert.match(panel.disclaimer, /opinion, not a cited standard/i);
});

test("an unavailable advisory becomes an unavailable panel with the gate-unaffected note", () => {
  const panel = buildDesignPanel({ status: "unavailable", reason: "design analysis timed out" });
  assert.equal(panel.status, "unavailable");
  if (panel.status !== "unavailable") return;
  assert.equal(panel.reason, "design analysis timed out");
  assert.match(panel.note, /trust score are unaffected/i);
  // no "passed"/"good" framing anywhere on the degrade path
  assert.doesNotMatch(panel.note, /passed|looks good/i);
});

// --- score isolation (#31): the design layer feeds no input to the score ---

function objectiveFindings(): Finding[] {
  return [
    { id: "html-lang", title: "Lang", standard: "WCAG", learnMore: "http://x", verdict: "pass", triage: "well-fix-it", detail: "" },
    { id: "title", title: "Title", standard: "SEO", learnMore: "http://x", verdict: "fail", triage: "well-fix-it", detail: "" },
  ];
}

/** Every key the trust dial reads — none may appear on the design view-model. */
const SCORE_KEYS = ["score", "outOfTen", "passing", "applicable", "shipReady", "verdict"];

test("the trust score is byte-identical whether the design layer runs, is empty, or is unavailable (#31)", () => {
  const findings = objectiveFindings();
  const base = JSON.stringify(scoreFindings(findings));

  const panels: DesignPanel[] = [
    buildDesignPanel(available([CONTRAST, CTA, OPINION])), // full advisory
    buildDesignPanel(available([])), // ran, found nothing
    buildDesignPanel({ status: "unavailable", reason: "endpoint down" }), // offline
  ];

  for (const panel of panels) {
    // the score never shifts across any design-layer state
    assert.equal(JSON.stringify(scoreFindings(findings)), base);
    // the panel is structurally incapable of feeding the score: no score/verdict keys
    for (const key of SCORE_KEYS) assert.ok(!(key in panel), `panel must not expose "${key}"`);
    if (panel.status === "available") {
      for (const item of panel.groups.flatMap((g) => g.items)) {
        for (const key of SCORE_KEYS) assert.ok(!(key in item), `item must not expose "${key}"`);
      }
    }
  }
});
