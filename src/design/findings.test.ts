import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeFinding,
  deriveDeterministicFindings,
  parseOpinionFindings,
  type DesignFinding,
} from "./findings.js";
import type { DesignFacts } from "./measure.js";

// --- fixtures --------------------------------------------------------------

/** demo-site "Bloom" facts (exp E): styled, healthy numbers, competing CTAs. */
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

/** starter-slop facts (exp E): unstyled, raw-link CTA, but 21:1 contrast. */
function unstyledFacts(overrides: Partial<DesignFacts> = {}): DesignFacts {
  return {
    target: "examples/starter-slop/index.html",
    viewportWidthPx: 1280,
    body: { fontSizePx: 16, lineHeight: "normal", contrast: 21 },
    h1: { text: "Bloom", fontSizePx: 32, weight: "700", contrast: 21 },
    primaryCta: { text: "Get early access", fontSizePx: 16, styledAsButton: false, contrast: null },
    ctaTexts: ["Get early access"],
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
    ...overrides,
  };
}

/** The invariant #31 requires: opinion is never cited, cited tiers always are. */
function assertCitationInvariant(f: DesignFinding): void {
  if (f.tier === 3) {
    assert.equal(f.citation, null, `tier-3 "${f.title}" must not be cited`);
    assert.equal(f.learnMore, undefined, `tier-3 "${f.title}" must not carry a learnMore`);
  } else {
    assert.ok(f.citation, `tier-${f.tier} "${f.title}" must be cited`);
  }
}

// --- makeFinding invariant -------------------------------------------------

test("makeFinding rejects a tier-3 finding that carries a citation", () => {
  assert.throws(() => makeFinding({ tier: 3, title: "x", detail: "y", citation: "WCAG" }), /must not carry a citation/);
  assert.throws(
    () => makeFinding({ tier: 3, title: "x", detail: "y", citation: null, learnMore: "http://x" }),
    /must not carry a citation/,
  );
});

test("makeFinding rejects a tier-1/2 finding with no citation", () => {
  assert.throws(() => makeFinding({ tier: 1, title: "x", detail: "y", citation: null }), /must cite/);
  assert.throws(() => makeFinding({ tier: 2, title: "x", detail: "y", citation: "" }), /must cite/);
});

test("makeFinding passes valid findings through unchanged", () => {
  const opinion: DesignFinding = { tier: 3, title: "looks flat", detail: "…", citation: null };
  assert.equal(makeFinding(opinion), opinion);
  const cited: DesignFinding = { tier: 1, title: "contrast", detail: "…", citation: "WCAG 2.2 SC 1.4.3" };
  assert.equal(makeFinding(cited), cited);
});

// --- deterministic findings ------------------------------------------------

test("deriveDeterministicFindings leads with the competing-CTA finding", () => {
  const findings = deriveDeterministicFindings(demoFacts());
  assert.ok(findings.length > 0);
  assert.match(findings[0].title, /competing calls-to-action/);
  assert.equal(findings[0].tier, 2);
  // it names every CTA it counted — straight from the facts, no fabrication
  for (const cta of demoFacts().ctaTexts) assert.ok(findings[0].detail.includes(cta));
});

test("deriveDeterministicFindings: every finding is tier 1 or 2 and cited", () => {
  const findings = deriveDeterministicFindings(demoFacts());
  for (const f of findings) {
    assert.notEqual(f.tier, 3); // deterministic spine is never opinion
    assertCitationInvariant(f);
  }
});

test("deriveDeterministicFindings flags an unstyled page and a non-button CTA", () => {
  const findings = deriveDeterministicFindings(unstyledFacts());
  assert.ok(findings.some((f) => /missing its styling/.test(f.title)));
  assert.ok(findings.some((f) => /doesn.t look clickable/.test(f.title)));
  // healthy 21:1 contrast → no contrast finding (facts don't lie)
  assert.ok(!findings.some((f) => /contrast/.test(f.title)));
});

test("deriveDeterministicFindings emits a tier-1 WCAG finding on low contrast", () => {
  const findings = deriveDeterministicFindings(demoFacts({ minTextContrast: 3.1 }));
  const contrast = findings.find((f) => /contrast/.test(f.title));
  assert.ok(contrast);
  assert.equal(contrast.tier, 1);
  assert.match(contrast.citation ?? "", /WCAG 2\.2 SC 1\.4\.3/);
  assert.match(contrast.learnMore ?? "", /^https:\/\//);
});

test("deriveDeterministicFindings stays quiet on a clean single-CTA page", () => {
  const clean = demoFacts({ ctaTexts: ["Join the waitlist"] });
  const findings = deriveDeterministicFindings(clean);
  assert.ok(!findings.some((f) => /competing/.test(f.title))); // one CTA → no conflict
  assert.ok(!findings.some((f) => /styling/.test(f.title))); // styled → not flagged
});

test("deriveDeterministicFindings flags small body text", () => {
  const findings = deriveDeterministicFindings(demoFacts({ body: { fontSizePx: 12, lineHeight: "16px", contrast: 15 } }));
  assert.ok(findings.some((f) => /small/.test(f.title)));
});

// --- opinion parsing (tier 3) ----------------------------------------------

test("parseOpinionFindings splits a bulleted critique into tier-3 opinion findings", () => {
  const text = `Here's my critique:
- Strengthen the hero hierarchy — the headline competes with the nav for attention.
- The palette is cohesive, which works well.
* Consider tightening whitespace between sections.
Verdict: solid but generic.`;
  const findings = parseOpinionFindings(text);
  assert.equal(findings.length, 3);
  for (const f of findings) assertCitationInvariant(f);
  assert.equal(findings[0].tier, 3);
  assert.match(findings[0].title, /Strengthen the hero hierarchy/);
});

test("parseOpinionFindings handles a numbered list with wrapped continuation lines", () => {
  const text = `1. Increase contrast on the secondary text
   so it reads on the tinted panel.
2) Add a product image to the hero.`;
  const findings = parseOpinionFindings(text);
  assert.equal(findings.length, 2);
  assert.match(findings[0].detail, /reads on the tinted panel/); // continuation folded in
  assert.match(findings[1].title, /product image/);
});

test("parseOpinionFindings wraps an unstructured blob as one finding", () => {
  const findings = parseOpinionFindings("The page feels flat and lacks a clear focal point.");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].title, "Design critique");
  assert.equal(findings[0].tier, 3);
  assert.equal(findings[0].citation, null);
});

test("parseOpinionFindings returns nothing for empty/whitespace input", () => {
  assert.deepEqual(parseOpinionFindings(""), []);
  assert.deepEqual(parseOpinionFindings("   \n  "), []);
});

test("parseOpinionFindings caps the number of items", () => {
  const text = ["- one", "- two", "- three", "- four"].join("\n");
  assert.equal(parseOpinionFindings(text, 2).length, 2);
});
