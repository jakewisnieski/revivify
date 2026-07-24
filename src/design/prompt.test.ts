import { test } from "node:test";
import assert from "node:assert/strict";
import { factsBlock, composePrompt } from "./prompt.js";
import type { DesignFacts } from "./measure.js";

function demoFacts(overrides: Partial<DesignFacts> = {}): DesignFacts {
  return {
    target: "demo-site/index.html",
    viewportWidthPx: 1280,
    body: { fontSizePx: 17, lineHeight: "27.2px", contrast: 15.4 },
    h1: { text: "Plants that forgive you", fontSizePx: 58, weight: "700", contrast: 15.4 },
    h2FontSizePx: 36,
    primaryCta: { text: "Join the waitlist", fontSizePx: 16, styledAsButton: true, contrast: 9.4 },
    heroCtaGapPx: 14,
    sectionPaddingTopPx: { minPx: 48, maxPx: 64 },
    ctaTexts: ["Get early access", "Join the waitlist", "Start with one plant"],
    minTextContrast: 9,
    visual: {
      authorStyleSheets: 1,
      bodyFontFamily: "Inter, system-ui, sans-serif",
      defaultSerifBody: false,
      usesLayoutContainers: true,
      contentImageCount: 3,
      heroHasImage: true,
      looksUnstyled: false,
    },
    ...overrides,
  };
}

test("factsBlock cites the real measured numbers from the facts", () => {
  const block = factsBlock(demoFacts());
  assert.match(block, /Body text: 17px, line-height 27\.2px, contrast ~15\.4:1/);
  assert.match(block, /Hero headline "Plants that forgive you": 58px, weight 700/);
  assert.match(block, /Primary \(hero\) CTA "Join the waitlist": 16px, a FILLED styled button, text contrast ~9\.4:1/);
  assert.match(block, /Gap between the hero CTA and the adjacent link: 14px/);
  assert.match(block, /Section vertical padding ranges 48–64px/);
  assert.match(block, /"Get early access", "Join the waitlist", "Start with one plant"/);
  assert.match(block, /Lowest text contrast anywhere on the page: ~9:1 .*passes/);
});

test("factsBlock surfaces visual-failure signals so grounding can't mask a broken page (exp E)", () => {
  const block = factsBlock(
    demoFacts({
      primaryCta: { text: "Get early access", fontSizePx: 16, styledAsButton: false, contrast: null },
      minTextContrast: 21,
      visual: {
        authorStyleSheets: 0,
        bodyFontFamily: "Times New Roman",
        defaultSerifBody: true,
        usesLayoutContainers: false,
        contentImageCount: 0,
        heroHasImage: false,
        looksUnstyled: true,
      },
    }),
  );
  assert.match(block, /0 author stylesheet/);
  assert.match(block, /NO real layout containers/);
  assert.match(block, /hero image ABSENT/);
  assert.match(block, /LOOKS UNSTYLED/);
  // a non-button CTA is called out plainly, not smoothed over
  assert.match(block, /NOT styled as a button/);
});

test("factsBlock omits facts that weren't measured, without inventing them", () => {
  const sparse: DesignFacts = {
    target: "https://example.com",
    viewportWidthPx: 1280,
    ctaTexts: [],
    minTextContrast: null,
    visual: {
      authorStyleSheets: 1,
      bodyFontFamily: "",
      defaultSerifBody: false,
      usesLayoutContainers: true,
      contentImageCount: 0,
      heroHasImage: false,
      looksUnstyled: false,
    },
  };
  const block = factsBlock(sparse);
  assert.ok(!/Body text:/.test(block)); // no body fact → no body line
  assert.ok(!/Hero headline/.test(block));
  assert.ok(!/Lowest text contrast/.test(block)); // null contrast → omitted, not "~null:1"
  assert.match(block, /Distinct calls-to-action on the page: none detected/);
});

test("composePrompt grounds the numbers AND licenses visual judgment (exp E posture)", () => {
  const { system, user } = composePrompt(demoFacts());
  // grounding: authoritative facts, don't invent numbers
  assert.match(system, /use ONLY these numbers, do not invent others/);
  assert.match(system, /do NOT invent or estimate any pixel sizes, contrast ratios, or spacing/i);
  // license the eyes: explicitly allowed to judge visual/aesthetic dimensions
  assert.match(system, /licensed .* to judge the visual and aesthetic dimensions/i);
  assert.match(system, /looks unstyled or broken, say so/i);
  // the measured facts are embedded
  assert.match(system, /58px/);
  // the user turn carries the ask; the screenshot rides alongside it in the service
  assert.match(user, /Critique the landing page/);
});
