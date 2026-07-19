import type { LighthouseAudit, LighthouseReport } from "../engine/lighthouse.js";
import type { Finding, Triage, Verdict } from "./types.js";

/**
 * The M1 full-audit pack: each rule reads one real Lighthouse audit (Lighthouse
 * runs axe-core internally for its accessibility audits) and turns it into a
 * plain-language, cited finding. Category scores come straight from Lighthouse.
 */
/** The four Lighthouse category gates a full-audit rule can belong to. */
export type Category = "performance" | "accessibility" | "seo" | "best-practices";

interface LighthouseRule {
  id: string;
  title: string;
  standard: string;
  /** A URL to the exact published standard (cite → teach → verify; decision-log #21). */
  learnMore: string;
  auditId: string;
  /** The Lighthouse category this rule rolls up under — so a `categories:` toggle can disable it. */
  category: Category;
  triage: Triage;
  passDetail: string;
  failDetail: string;
  fix: string;
}

const LIGHTHOUSE_RULES: LighthouseRule[] = [
  // ♿ Accessibility — WCAG 2.2 (via axe-core, inside Lighthouse)
  {
    id: "image-alt",
    title: "Images have alt text",
    standard: "WCAG 2.2 — 1.1.1 Non-text Content (Level A)",
    learnMore: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
    auditId: "image-alt",
    category: "accessibility",
    triage: "well-fix-it",
    passDetail: "Every image has alt text, so screen-reader users aren't left in the dark.",
    failDetail:
      "One or more images have no alt text. Screen-reader users hear nothing there, and it's a missed image-SEO signal.",
    fix: 'Add descriptive alt text to each meaningful image (alt="…"), or alt="" if it is purely decorative.',
  },
  {
    id: "text-contrast",
    title: "Text has enough contrast",
    standard: "WCAG 2.2 — 1.4.3 Contrast (Minimum) (Level AA)",
    learnMore: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    auditId: "color-contrast",
    category: "accessibility",
    triage: "your-call",
    passDetail: "Text meets the 4.5:1 contrast minimum, so it's readable for low-vision users.",
    failDetail:
      "Some text is too low-contrast against its background to meet 4.5:1. Often this is a deliberate brand choice — but it's hard to read for many people, so it's your call.",
    fix: "Darken the text or lighten the background until it reaches 4.5:1 — unless the low contrast is an intentional brand decision.",
  },
  {
    id: "html-lang",
    title: "Page declares its language",
    standard: "WCAG 2.2 — 3.1.1 Language of Page (Level A)",
    learnMore: "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html",
    auditId: "html-has-lang",
    category: "accessibility",
    triage: "well-fix-it",
    passDetail: "The <html> tag declares the page language, so assistive tech pronounces it correctly.",
    failDetail:
      "The <html> tag has no lang attribute, so assistive tech can't tell what language the page is in.",
    fix: 'Add a language to the opening <html> tag, e.g. <html lang="en">.',
  },
  {
    id: "form-labels",
    title: "Form inputs have labels",
    standard: "WCAG 2.2 — 1.3.1 / 4.1.2 (Level A)",
    learnMore: "https://www.w3.org/WAI/tutorials/forms/labels/",
    auditId: "label",
    category: "accessibility",
    triage: "well-fix-it",
    passDetail: "Form fields are labelled, so everyone knows what to type where.",
    failDetail:
      "A form field has no label. Screen-reader users (and often everyone) can't tell what it's for — common on email-capture forms.",
    fix: "Give each input a <label>, or an aria-label, that names what it's for.",
  },

  // ⚡ Performance — Core Web Vitals
  {
    id: "lcp",
    title: "Loads quickly (largest content ≤ 2.5s)",
    standard: "Core Web Vitals — Largest Contentful Paint (LCP)",
    learnMore: "https://web.dev/articles/lcp",
    auditId: "largest-contentful-paint",
    category: "performance",
    triage: "well-fix-it",
    passDetail: "The biggest thing on screen paints fast — the page feels quick.",
    failDetail:
      "The largest element takes too long to appear (target ≤ 2.5s). Usually a giant unoptimized hero image is the culprit.",
    fix: "Compress and right-size the hero image, use a modern format (WebP/AVIF), and let it load early.",
  },
  {
    id: "cls",
    title: "Layout is stable (no jumping)",
    standard: "Core Web Vitals — Cumulative Layout Shift (CLS)",
    learnMore: "https://web.dev/articles/cls",
    auditId: "cumulative-layout-shift",
    category: "performance",
    triage: "well-fix-it",
    passDetail: "Content doesn't jump around as the page loads.",
    failDetail:
      "Content shifts as the page loads (target CLS ≤ 0.1) — buttons move under people's fingers as images and fonts arrive.",
    fix: "Set width and height on images, and reserve space for anything that loads in late.",
  },
  {
    id: "image-optimization",
    title: "Images are optimized",
    standard: "Lighthouse — efficient image delivery (Core Web Vitals)",
    learnMore: "https://developer.chrome.com/docs/lighthouse/performance/uses-optimized-images",
    auditId: "image-delivery-insight",
    category: "performance",
    triage: "well-fix-it",
    passDetail: "Images are efficiently delivered — right-sized and in modern formats.",
    failDetail:
      "Some images are larger than they need to be or use older formats — the #1 fixable performance sin, and usually a heavy hero image.",
    fix: "Compress images, serve them at their display size, and use a modern format (WebP/AVIF).",
  },

  // 🔎 SEO & discoverability — Google Search Essentials
  {
    id: "doc-title",
    title: "Page has a title",
    standard: "Google Search Essentials — descriptive <title>",
    learnMore: "https://developers.google.com/search/docs/appearance/title-link",
    auditId: "document-title",
    category: "seo",
    triage: "well-fix-it",
    passDetail: "The page has a title — the browser-tab label and the biggest search-ranking signal.",
    failDetail:
      "The page has no <title>. It's the biggest search-ranking signal and the label on the tab and every search result.",
    fix: "Add a concise, descriptive <title> inside <head>.",
  },
  {
    id: "meta-description",
    title: "Page has a meta description",
    standard: "Google Search Essentials — meta description / snippet",
    learnMore: "https://developers.google.com/search/docs/appearance/snippet",
    auditId: "meta-description",
    category: "seo",
    triage: "well-fix-it",
    passDetail: "A meta description is set, so you control the search-result snippet.",
    failDetail:
      "No meta description. Google then writes the search snippet for you, usually poorly — this is your pitch in the results.",
    fix: 'Add <meta name="description" content="…"> (~150 characters) inside <head>.',
  },
  {
    id: "viewport",
    title: "Page is mobile-friendly (responsive viewport)",
    standard: "Google Search Essentials — mobile-first / responsive viewport",
    learnMore: "https://web.dev/articles/responsive-web-design-basics",
    auditId: "meta-viewport",
    category: "seo",
    triage: "well-fix-it",
    passDetail: "A responsive viewport is set, so the page adapts to phones.",
    failDetail:
      "No responsive viewport tag. On phones the page renders zoomed-out and hard to use — and Google indexes mobile-first.",
    fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside <head>.',
  },
  {
    id: "noindex",
    title: "Page isn't accidentally hidden from search engines",
    standard: "Google Search Essentials — robots meta / indexing",
    learnMore: "https://developers.google.com/search/docs/crawling-indexing/block-indexing",
    auditId: "is-crawlable",
    category: "seo",
    triage: "your-call",
    passDetail: "Nothing is blocking search engines from indexing the page.",
    failDetail:
      "This page blocks search engines (noindex / robots). If unintended, it's invisible to Google — catastrophic for a landing page. If it's a private or staging page, this is correct.",
    fix: 'If you want this page found, remove the "noindex" from the <meta name="robots"> tag.',
  },

  // ✅ Best practices & trust — Lighthouse Best Practices
  {
    id: "https",
    title: "Served securely over HTTPS",
    standard: "Google Search Essentials — HTTPS",
    learnMore: "https://web.dev/articles/why-https-matters",
    auditId: "is-on-https",
    category: "best-practices",
    triage: "well-fix-it",
    passDetail: "The page is served over HTTPS (secure).",
    failDetail:
      "The page isn't served over HTTPS. Browsers warn visitors, and Google ranks it lower.",
    fix: "Serve the site over HTTPS (most hosts do this automatically with a free certificate).",
  },
  {
    id: "console-errors",
    title: "No errors in the browser console",
    standard: "Lighthouse — Best Practices (console errors)",
    learnMore: "https://developer.chrome.com/docs/lighthouse/best-practices/errors-in-console",
    auditId: "errors-in-console",
    category: "best-practices",
    triage: "well-fix-it",
    passDetail: "No JavaScript errors or failed requests logged while the page loaded.",
    failDetail:
      "The browser logged errors while loading (broken scripts or failed requests, e.g. a missing image or file) — so visitors may hit features that silently break.",
    fix: "Open the page, check the browser console, and fix the errors — often a broken link to a missing file.",
  },
];

/** Turn a Lighthouse audit score into one of our verdicts. */
function verdictFor(audit: LighthouseAudit | undefined): Verdict {
  if (!audit || audit.score === null) return "not-applicable";
  if (["notApplicable", "manual", "informative", "error"].includes(audit.scoreDisplayMode)) {
    return "not-applicable";
  }
  // Lighthouse's "good" threshold is 0.9 (green); binary audits are 0 or 1.
  return audit.score >= 0.9 ? "pass" : "fail";
}

/** True when the audited page was served from loopback (or a file) rather than a real host. */
function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "";
  } catch {
    return true;
  }
}

/** Map a Lighthouse report into our cited, plain-language findings. */
export function mapReportToFindings(report: LighthouseReport): Finding[] {
  const local = isLocalUrl(report.finalUrl);
  return LIGHTHOUSE_RULES.map((rule) => {
    // HTTPS can't be judged from a locally-served page — browsers treat localhost as
    // a secure context, so the audit always passes. Rather than show a meaningless
    // green tick, report it as not-applicable; it's verified once the site is deployed.
    if (rule.id === "https" && local) {
      return {
        id: rule.id,
        title: rule.title,
        standard: rule.standard,
        learnMore: rule.learnMore,
        verdict: "not-applicable" as const,
        triage: "just-so-you-know" as const,
        detail:
          "Can't be verified on a local page — browsers treat localhost as secure. Revivify checks HTTPS once your site is deployed to a real URL.",
      };
    }
    const audit = report.audits[rule.auditId];
    const verdict = verdictFor(audit);
    const measured = audit?.displayValue ? ` (measured: ${audit.displayValue})` : "";
    const detail = verdict === "fail" ? rule.failDetail + measured : rule.passDetail;
    return {
      id: rule.id,
      title: rule.title,
      standard: rule.standard,
      learnMore: rule.learnMore,
      verdict,
      triage: rule.triage,
      detail,
      ...(verdict === "fail" ? { fix: rule.fix } : {}),
    };
  });
}

/** Number of rules in the full pack (for "N of M" messaging). */
export const LIGHTHOUSE_RULE_COUNT = LIGHTHOUSE_RULES.length;

/**
 * Full-audit finding id → its Lighthouse category, derived from the live rule
 * table so a `categories:` toggle can disable every check under a category
 * without a hand-kept list drifting from the rules (the decision-log #15 pattern).
 */
export const RULE_CATEGORY: Record<string, Category> = Object.fromEntries(
  LIGHTHOUSE_RULES.map((rule) => [rule.id, rule.category]),
);
