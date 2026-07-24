/**
 * Grounded critique prompt composition (M6.3).
 *
 * Turns the deterministic {@link DesignFacts} into the prompt sent to the vision
 * model, with the **experiment-E posture** that made grounding work without
 * suppressing visual judgment:
 *
 *  1. **Ground the numbers.** The measured facts are authoritative — the model
 *     must use only these numbers and never invent pixel sizes, contrast ratios,
 *     or spacing. This is what killed the 8B's confabulation (experiments B/D).
 *  2. **License the eyes.** The model is *explicitly* told it may — and should —
 *     judge the visual/aesthetic dimensions the facts don't cover. Without this,
 *     "trust the facts, don't invent" nudged the model to ignore a visually-broken
 *     page whose numbers looked healthy (experiment E, lesson 1).
 *  3. **Surface visual-failure signals.** The facts block includes the health
 *     signals (unstyled? real layout? default serif? hero image?) so grounding
 *     can't mask a broken page (experiment E, lesson 1).
 *
 * Pure and unit-tested — no Chrome, no model call.
 */
import type { DesignFacts } from "./measure.js";

/** Build the authoritative MEASURED FACTS block from the typed facts. */
export function factsBlock(facts: DesignFacts): string {
  const lines: string[] = [];

  if (facts.body) {
    const c = facts.body.contrast;
    lines.push(
      `- Body text: ${facts.body.fontSizePx}px, line-height ${facts.body.lineHeight}` +
        `${c !== null ? `, contrast ~${c}:1 on its background` : ""}.`,
    );
  }
  if (facts.h1) {
    const c = facts.h1.contrast;
    lines.push(
      `- Hero headline "${facts.h1.text}": ${facts.h1.fontSizePx}px, weight ${facts.h1.weight}` +
        `${c !== null ? `, contrast ~${c}:1` : ""}.`,
    );
  }
  if (facts.h2FontSizePx != null) lines.push(`- Section headings: ~${facts.h2FontSizePx}px.`);
  if (facts.primaryCta) {
    const c = facts.primaryCta;
    lines.push(
      `- Primary (hero) CTA "${c.text}": ${c.fontSizePx}px, ` +
        `${c.styledAsButton ? "a FILLED styled button" : "NOT styled as a button (plain text/link)"}` +
        `${c.contrast !== null ? `, text contrast ~${c.contrast}:1` : ""}.`,
    );
  }
  if (facts.heroCtaGapPx != null) {
    lines.push(`- Gap between the hero CTA and the adjacent link: ${facts.heroCtaGapPx}px.`);
  }
  if (facts.sectionPaddingTopPx) {
    lines.push(
      `- Section vertical padding ranges ${facts.sectionPaddingTopPx.minPx}–${facts.sectionPaddingTopPx.maxPx}px.`,
    );
  }
  lines.push(
    `- Distinct calls-to-action on the page: ` +
      `${facts.ctaTexts.map((t) => `"${t}"`).join(", ") || "none detected"}.`,
  );
  if (facts.minTextContrast !== null) {
    const passes = facts.minTextContrast >= 4.5;
    lines.push(
      `- Lowest text contrast anywhere on the page: ~${facts.minTextContrast}:1 ` +
        `(WCAG AA minimum is 4.5:1${passes ? " — passes" : " — FAILS"}).`,
    );
  }

  // Visual-failure signals — so grounding can't lull the model on a broken page (exp E).
  const v = facts.visual;
  lines.push(
    `- Visual health: ${v.authorStyleSheets} author stylesheet(s); ` +
      `${v.usesLayoutContainers ? "uses real flex/grid layout" : "NO real layout containers"}; ` +
      `${v.contentImageCount} content image(s); ` +
      `hero image ${v.heroHasImage ? "present" : "ABSENT"}; ` +
      `body font-family "${v.bodyFontFamily || "unknown"}"; ` +
      `the page ${v.looksUnstyled ? "LOOKS UNSTYLED (visually broken)" : "does not look unstyled"}.`,
  );

  return lines.join("\n");
}

const RUBRIC = `You are a senior landing-page design critic shown a screenshot of a rendered landing page. Give a concise, specific, honest critique for the page's OWNER (a non-developer). For each finding, name the design principle behind it.
Evaluate: visual hierarchy; typography; spacing/whitespace; colour & contrast; CTA & conversion; overall impression.
Rules: Be specific to THIS page — refer to elements you actually see. Return at most 5 prioritised recommendations as a bulleted list (what to change / the principle / the expected effect). Note what works. End with a one-line verdict.

MEASURED FACTS (authoritative — the page's REAL computed values, measured from the DOM; use ONLY these numbers, do not invent others; if a fact contradicts what you think you see, trust the fact):
{FACTS}

You have TWO jobs and must do both:
1. GROUND THE NUMBERS. Do NOT invent or estimate any pixel sizes, contrast ratios, or spacing values — the MEASURED FACTS are the only numbers you may cite.
2. JUDGE THE VISUALS. You ARE explicitly licensed — and expected — to judge the visual and aesthetic dimensions the facts do NOT cover: layout, hierarchy, composition, imagery, messaging/copy consistency, emphasis, polish, and conversion logic. If the visual-health signals or the screenshot show a page that looks unstyled or broken, say so plainly — do not let healthy-looking numbers talk you out of what you can see.`;

/**
 * Compose the grounded-critique prompt: an authoritative system rubric (measured
 * facts + the ground-the-numbers / judge-the-visuals posture) and the user turn
 * that carries the screenshot.
 */
export function composePrompt(facts: DesignFacts): { system: string; user: string } {
  return {
    system: RUBRIC.replace("{FACTS}", factsBlock(facts)),
    user: "Critique the landing page under review for its owner.",
  };
}
