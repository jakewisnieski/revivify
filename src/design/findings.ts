/**
 * The typed, tiered advisory findings model (M6.3).
 *
 * A design finding is **advisory only** — it never touches the deterministic
 * trust score (decision-log #31). Findings are **tier-labeled by citability**:
 *
 *  - **tier 1 (objective)** — a measured, standard-backed fact (e.g. a contrast
 *    ratio below WCAG AA). Carries a citation.
 *  - **tier 2 (heuristic)** — a defensible best-practice pattern (e.g. multiple
 *    competing CTAs dilute conversion focus). Carries a citation to the principle.
 *  - **tier 3 (taste)** — the vision model's aesthetic **opinion**. Carries **no
 *    citation** and is explicitly marked as model opinion — laundering opinion as
 *    cited would violate the honesty rules (#10/#12, #31).
 *
 * The split is **provenance-controlled in TS, not by the model's say-so**: tiers
 * 1–2 are derived deterministically from the M6.2 facts (so they can't fabricate
 * numbers), and tier 3 is the model's free-text critique. {@link makeFinding}
 * enforces the citation invariant so a tier-3 item can never masquerade as cited.
 */
import type { DesignFacts } from "./measure.js";

/** Citability tier: 1 objective (cited), 2 heuristic (cited), 3 taste (opinion, uncited). */
export type DesignTier = 1 | 2 | 3;

export interface DesignFinding {
  tier: DesignTier;
  /** Short label. */
  title: string;
  /** Plain-language explanation for the page's owner. */
  detail: string;
  /**
   * The standard (tier 1) or principle (tier 2) this finding cites. **Null for
   * tier 3** — model opinion is explicitly not cited (#31). Enforced by
   * {@link makeFinding}.
   */
  citation: string | null;
  /** A URL backing the citation, when one exists (tiers 1–2 only). */
  learnMore?: string;
}

/**
 * Construct a finding, enforcing the citation invariant that keeps the tiers
 * honest: a tier-3 (opinion) finding must **never** carry a citation, and a
 * tier-1/2 finding must carry one. This is the "safe by construction" guard #31
 * requires — the design layer can't oversell opinion as a cited fact.
 */
export function makeFinding(f: DesignFinding): DesignFinding {
  if (f.tier === 3 && (f.citation !== null || f.learnMore)) {
    throw new Error("tier-3 findings are model opinion and must not carry a citation");
  }
  if ((f.tier === 1 || f.tier === 2) && !f.citation) {
    throw new Error(`tier-${f.tier} findings must cite a standard or principle`);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Deterministic findings (tiers 1–2) — derived from the M6.2 facts, never the model
// ---------------------------------------------------------------------------

/** WCAG AA minimum contrast for normal-size body text. */
const AA_CONTRAST = 4.5;
/** Below this the body copy reads uncomfortably small on a landing page. */
const SMALL_BODY_PX = 14;

const WCAG_CONTRAST_URL = "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html";

/**
 * Turn the deterministic {@link DesignFacts} into tier-1/2 findings — the grounded
 * spine the vision critique leads with (experiments B/D: the model "led with the
 * deterministic finding — conflicting CTAs"). Every number here comes straight
 * from a measured fact, so nothing is fabricated. Emitted in curated reading
 * order (conversion → affordance → styling → readability), all ahead of the
 * model's tier-3 opinion.
 */
export function deriveDeterministicFindings(facts: DesignFacts): DesignFinding[] {
  const out: DesignFinding[] = [];

  // Conversion: multiple competing calls-to-action dilute focus. The marquee
  // deterministic catch — surfaced straight from the deduped CTA list.
  if (facts.ctaTexts.length >= 2) {
    out.push(
      makeFinding({
        tier: 2,
        title: `${facts.ctaTexts.length} competing calls-to-action`,
        detail:
          `The page asks visitors to do several different things: ` +
          `${facts.ctaTexts.map((t) => `“${t}”`).join(", ")}. A single, repeated primary ` +
          `call-to-action converts better than several competing ones.`,
        citation: "Conversion best practice: one primary call-to-action",
        learnMore: "https://www.nngroup.com/articles/clear-calls-to-action/",
      }),
    );
  }

  // Affordance: the primary CTA doesn't look like a button (a plain text link).
  if (facts.primaryCta && !facts.primaryCta.styledAsButton) {
    out.push(
      makeFinding({
        tier: 2,
        title: "Primary call-to-action doesn’t look clickable",
        detail:
          `The main action “${facts.primaryCta.text}” is a plain text link, not a filled ` +
          `button. A button-styled CTA reads as the obvious next step and gets more clicks.`,
        citation: "Affordance: primary actions should look actionable",
        learnMore: "https://www.nngroup.com/articles/clickable-elements/",
      }),
    );
  }

  // Styling: the page looks essentially unstyled (exp E — a visually-broken page
  // whose numbers can still look healthy).
  if (facts.visual.looksUnstyled) {
    out.push(
      makeFinding({
        tier: 2,
        title: "Page appears to be missing its styling",
        detail:
          `The page shows the signs of an unstyled document ` +
          `(${facts.visual.authorStyleSheets} author stylesheet${facts.visual.authorStyleSheets === 1 ? "" : "s"}, ` +
          `${facts.visual.usesLayoutContainers ? "" : "no real layout containers, "}` +
          `${facts.visual.defaultSerifBody ? "browser-default serif body text" : "styled body text"}). ` +
          `It likely isn’t loading its CSS or hasn’t been designed yet.`,
        citation: "Visual hierarchy: styled layout communicates structure",
        learnMore: "https://www.nngroup.com/articles/visual-hierarchy-ux-definition/",
      }),
    );
  }

  // Objective: lowest text contrast on the page is below WCAG AA.
  if (facts.minTextContrast !== null && facts.minTextContrast < AA_CONTRAST) {
    out.push(
      makeFinding({
        tier: 1,
        title: "Some text is below the minimum contrast",
        detail:
          `The lowest text contrast on the page is about ${facts.minTextContrast}:1. ` +
          `WCAG AA requires at least ${AA_CONTRAST}:1 for normal-size text, so some copy ` +
          `is hard to read.`,
        citation: "WCAG 2.2 SC 1.4.3 Contrast (Minimum)",
        learnMore: WCAG_CONTRAST_URL,
      }),
    );
  }

  // Readability: body copy is uncomfortably small for a landing page.
  if (facts.body && facts.body.fontSizePx < SMALL_BODY_PX) {
    out.push(
      makeFinding({
        tier: 2,
        title: "Body text is quite small",
        detail:
          `Body text is ${facts.body.fontSizePx}px. Landing-page body copy usually sits around ` +
          `16px so it stays comfortable to read.`,
        citation: "Readability: comfortable default body size",
        learnMore: "https://www.nngroup.com/articles/legibility-readability-comprehension/",
      }),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Model opinion (tier 3) — the vision critique, parsed into discrete findings
// ---------------------------------------------------------------------------

/** Default cap on how many opinion items we surface — mirrors the rubric's "at most 5". */
const OPINION_LIMIT = 6;

/** A leading list marker: "- ", "* ", "• ", "1. ", "2) ". */
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.*\S)\s*$/;
/** Strip inline markdown emphasis so titles read cleanly. */
const stripMarkdown = (s: string): string => s.replace(/[*_`]+/g, "").trim();

/** Take a short title from the first sentence of an item. */
function titleOf(item: string): string {
  const firstLine = item.split(/\r?\n/, 1)[0];
  // Split on sentence terminators only (not ":") so a "Label: substance" bullet
  // keeps a meaningful title instead of clipping to the bare label.
  const sentence = firstLine.split(/(?<=[.!?])\s/, 1)[0];
  const clipped = sentence.length > 80 ? `${sentence.slice(0, 77).trimEnd()}…` : sentence;
  return stripMarkdown(clipped);
}

/**
 * Parse the vision model's free-text critique into **tier-3 opinion findings**.
 *
 * Small models return prose, not JSON (experiments B–E), so we parse leniently:
 * bullet/numbered items each become a finding; if the model returned an
 * unstructured blob, the whole critique becomes one "Design critique" finding.
 * Every result is tier 3 with no citation — it's opinion by provenance, marked
 * as such regardless of how confidently the model phrased it (#31).
 */
export function parseOpinionFindings(text: string, limit = OPINION_LIMIT): DesignFinding[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];

  const items: string[] = [];
  let current: string[] | null = null;
  for (const line of trimmed.split(/\r?\n/)) {
    const m = line.match(LIST_ITEM);
    if (m) {
      if (current) items.push(current.join("\n").trim());
      current = [m[1]];
    } else if (current && line.trim()) {
      // A continuation line wrapped under the current bullet.
      current.push(line.trim());
    }
  }
  if (current) items.push(current.join("\n").trim());

  const source = items.length > 0 ? items : [trimmed];
  return source
    .map((raw) => stripMarkdown(raw))
    .filter(Boolean)
    .slice(0, limit)
    .map((item) =>
      makeFinding({
        tier: 3,
        title: items.length > 0 ? titleOf(item) : "Design critique",
        detail: item,
        citation: null,
      }),
    );
}
