import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRgb,
  relativeLuminance,
  contrastRatio,
  isCta,
  dedupeCtas,
  minTextContrast,
  assembleFacts,
  type RawExtract,
} from "./measure.js";

// --- colour + contrast math ------------------------------------------------

test("parseRgb reads the leading channels of rgb()/rgba()", () => {
  assert.deepEqual(parseRgb("rgb(23, 40, 31)"), [23, 40, 31]);
  assert.deepEqual(parseRgb("rgba(255, 255, 255, 0.5)"), [255, 255, 255]);
  assert.equal(parseRgb("transparent"), null);
});

test("contrastRatio matches WCAG anchors (black/white = 21, white/white = 1)", () => {
  assert.equal(contrastRatio("rgb(0, 0, 0)", "rgb(255, 255, 255)"), 21);
  assert.equal(contrastRatio("rgb(255, 255, 255)", "rgb(255, 255, 255)"), 1);
  assert.equal(contrastRatio("rgb(255,255,255)", "not-a-colour"), null);
});

test("relativeLuminance is 0 for black and 1 for white", () => {
  assert.equal(relativeLuminance([0, 0, 0]), 0);
  assert.equal(relativeLuminance([255, 255, 255]), 1);
});

// --- CTA detection + dedup -------------------------------------------------

test("isCta matches action words, not navigation", () => {
  assert.equal(isCta("Get early access"), true);
  assert.equal(isCta("Join the waitlist"), true);
  assert.equal(isCta("Learn more"), false);
  assert.equal(isCta("Home"), false);
});

test("dedupeCtas filters non-CTAs, de-dups, and preserves order", () => {
  const out = dedupeCtas(["Get early access", "Get early access", "Home", "Join the waitlist", "Learn more", ""]);
  assert.deepEqual(out, ["Get early access", "Join the waitlist"]);
});

test("dedupeCtas respects the cap", () => {
  const many = ["Get 1", "Start 2", "Join 3", "Buy 4", "Try 5"];
  assert.equal(dedupeCtas(many, 3).length, 3);
});

// --- min contrast scan -----------------------------------------------------

test("minTextContrast returns the worst pair, skips unparseable, null when empty", () => {
  const grey = contrastRatio("rgb(150, 150, 150)", "rgb(255, 255, 255)"); // ~3.0 — the worst
  const pairs: [string, string][] = [
    ["rgb(0, 0, 0)", "rgb(255, 255, 255)"], // 21
    ["rgb(150, 150, 150)", "rgb(255, 255, 255)"],
    ["bad", "rgb(255, 255, 255)"], // unparseable → skipped
  ];
  const min = minTextContrast(pairs);
  assert.equal(min, grey); // picked the worst *valid* pair
  assert.ok(min !== null && min < 21); // below the black/white pair
  assert.equal(minTextContrast([]), null);
});

// --- fact assembly ---------------------------------------------------------

function styledRaw(overrides: Partial<RawExtract> = {}): RawExtract {
  return {
    viewportWidth: 1280,
    authorStyleSheets: 1,
    body: { fontSizePx: 17, lineHeight: "27.2px", fontFamily: "Inter, system-ui, sans-serif", color: "rgb(23, 40, 31)", bg: "rgb(255, 255, 255)" },
    h1: { text: "Plants that forgive you", fontSizePx: 58, weight: "700", color: "rgb(23, 40, 31)", bg: "rgb(255, 255, 255)" },
    h2FontSizePx: 36,
    primaryCta: { text: "Join the waitlist", fontSizePx: 16, filled: true, hasRadius: true, color: "rgb(255, 255, 255)", bg: "rgb(34, 139, 87)" },
    heroCtaGapPx: 14,
    sectionPaddingsTopPx: [48, 64, 64, 56],
    ctaCandidates: ["Get early access", "Get early access", "Join the waitlist", "Home", "Start with one plant"],
    usesLayoutContainers: true,
    contentImageCount: 3,
    heroHasImage: true,
    textColorPairs: [["rgb(23, 40, 31)", "rgb(255, 255, 255)"]],
    ...overrides,
  };
}

test("assembleFacts shapes a styled page: contrast computed, CTAs deduped, spacing ranged, not unstyled", () => {
  const f = assembleFacts(styledRaw(), "demo-site/index.html");
  assert.equal(f.h1?.fontSizePx, 58);
  assert.ok(f.body?.contrast && f.body.contrast > 10);
  assert.equal(f.primaryCta?.styledAsButton, true);
  assert.ok(f.primaryCta?.contrast && f.primaryCta.contrast > 3);
  assert.deepEqual(f.ctaTexts, ["Get early access", "Join the waitlist", "Start with one plant"]);
  assert.deepEqual(f.sectionPaddingTopPx, { minPx: 48, maxPx: 64 });
  assert.equal(f.visual.looksUnstyled, false);
  assert.equal(f.visual.usesLayoutContainers, true);
});

test("assembleFacts flags an unstyled page (no author CSS, serif default, raw-link CTA)", () => {
  const raw = styledRaw({
    authorStyleSheets: 0,
    body: { fontSizePx: 16, lineHeight: "normal", fontFamily: "Times New Roman", color: "rgb(0, 0, 0)", bg: "rgb(255, 255, 255)" },
    primaryCta: { text: "Get early access", fontSizePx: 16, filled: false, hasRadius: false, color: "rgb(0, 0, 238)", bg: "rgba(0, 0, 0, 0)" },
    usesLayoutContainers: false,
  });
  const f = assembleFacts(raw, "examples/starter-slop/index.html");
  assert.equal(f.visual.looksUnstyled, true);
  assert.equal(f.visual.authorStyleSheets, 0);
  assert.equal(f.visual.defaultSerifBody, true);
  assert.equal(f.visual.usesLayoutContainers, false);
  assert.equal(f.primaryCta?.styledAsButton, false);
  assert.equal(f.primaryCta?.contrast, null); // not a filled button → no text-on-button contrast
});

test("assembleFacts degrades to a clean partial when facts are missing (no throw)", () => {
  const raw: RawExtract = {
    viewportWidth: 1280,
    authorStyleSheets: 1,
    body: null,
    h1: null,
    h2FontSizePx: null,
    primaryCta: null,
    heroCtaGapPx: null,
    sectionPaddingsTopPx: [],
    ctaCandidates: [],
    usesLayoutContainers: true,
    contentImageCount: 0,
    heroHasImage: false,
    textColorPairs: [],
  };
  const f = assembleFacts(raw, "https://example.com");
  assert.equal(f.body, undefined);
  assert.equal(f.h1, undefined);
  assert.equal(f.primaryCta, undefined);
  assert.equal(f.sectionPaddingTopPx, undefined);
  assert.deepEqual(f.ctaTexts, []);
  assert.equal(f.minTextContrast, null);
  assert.equal(f.visual.looksUnstyled, false);
});
