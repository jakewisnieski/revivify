import { test } from "node:test";
import assert from "node:assert/strict";
import { capturePage } from "./measure.js";

/**
 * Real end-to-end extraction against the repo's fixture pages — launches headless
 * Chrome, so it's **skipped in CI** (Chrome is too heavy/flaky there, decision-log
 * #26) and self-verified locally in Gate 0 with `RUN_CHROME_TESTS=1 npm test`.
 */
const skip = process.env.RUN_CHROME_TESTS ? false : "set RUN_CHROME_TESTS=1 to run (launches Chrome)";

test("capturePage extracts real facts from the polished demo-site (S1)", { skip }, async () => {
  const { facts, screenshot } = await capturePage("demo-site/index.html");

  // Real hero H1 (clamp resolves to ~58px at a 1280 viewport).
  assert.ok(facts.h1 && facts.h1.fontSizePx >= 50 && facts.h1.fontSizePx <= 60, `hero H1 ${facts.h1?.fontSizePx}px`);
  // A polished page passes the AA contrast floor.
  assert.ok(facts.minTextContrast !== null && facts.minTextContrast >= 4.5, `min contrast ${facts.minTextContrast}`);
  // Deduped CTA list with several distinct calls-to-action, no duplicates.
  assert.ok(facts.ctaTexts.length >= 3, `CTAs: ${facts.ctaTexts.join(", ")}`);
  assert.equal(new Set(facts.ctaTexts).size, facts.ctaTexts.length, "CTA list should be deduped");
  // The hero CTA is the filled button, not a raw link.
  assert.equal(facts.primaryCta?.styledAsButton, true);
  // Not an unstyled page.
  assert.equal(facts.visual.looksUnstyled, false);
  assert.equal(facts.visual.usesLayoutContainers, true);
  // The screenshot rides along for M6.3.
  assert.ok(screenshot.length > 1000, "expected a non-trivial base64 screenshot");
});

test("capturePage flags the unstyled starter-slop's visual failures (S2)", { skip }, async () => {
  const { facts } = await capturePage("examples/starter-slop/index.html");

  // The visual-failure signals experiment E showed grounding otherwise masks.
  assert.equal(facts.visual.looksUnstyled, true);
  assert.equal(facts.visual.authorStyleSheets, 0);
  assert.equal(facts.visual.usesLayoutContainers, false);
  // Its "CTA" is a raw text link, not a styled button.
  assert.equal(facts.primaryCta?.styledAsButton, false);
});
