import type { Rule } from "./types.js";

/**
 * The M0 pack: Tier-1 checks that can be judged from the HTML source alone,
 * with no browser, axe-core, or Lighthouse. These prove the pipeline end-to-end;
 * axe-core / Lighthouse checks join them in M1.
 */

const langRule: Rule = {
  id: "html-lang",
  title: "Page declares its language",
  standard: "WCAG 2.2 — 3.1.1 Language of Page (Level A)",
  run(page) {
    const lang = page.root.querySelector("html")?.getAttribute("lang")?.trim();
    if (lang) {
      return {
        verdict: "pass",
        triage: "just-so-you-know",
        detail: `The page declares its language as "${lang}", so screen readers pronounce it correctly.`,
      };
    }
    return {
      verdict: "fail",
      triage: "well-fix-it",
      detail:
        "The <html> tag has no lang attribute, so assistive tech can't tell what language the page is in — leading to wrong pronunciation and translation.",
      fix: 'Add a language to the opening <html> tag, e.g. <html lang="en">.',
    };
  },
};

const titleRule: Rule = {
  id: "doc-title",
  title: "Page has a title",
  standard: "Google Search Essentials — descriptive <title>",
  run(page) {
    const title = page.root.querySelector("title")?.text?.trim();
    if (title) {
      return {
        verdict: "pass",
        triage: "just-so-you-know",
        detail: `The page title is "${title}".`,
      };
    }
    return {
      verdict: "fail",
      triage: "well-fix-it",
      detail:
        "The page has no <title>. It's the biggest search-ranking signal and the label on the browser tab and every search result.",
      fix: "Add a concise, descriptive <title> inside <head>.",
    };
  },
};

const metaDescriptionRule: Rule = {
  id: "meta-description",
  title: "Page has a meta description",
  standard: "Google Search Essentials — meta description / snippet",
  run(page) {
    const content = page.root
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim();
    if (content) {
      return {
        verdict: "pass",
        triage: "just-so-you-know",
        detail: "A meta description is set, so you control the search snippet.",
      };
    }
    return {
      verdict: "fail",
      triage: "well-fix-it",
      detail:
        "No meta description. Google then writes the search-result snippet for you, usually poorly — this is your pitch in the results.",
      fix: 'Add <meta name="description" content="…"> (~150 characters) inside <head>.',
    };
  },
};

const viewportRule: Rule = {
  id: "meta-viewport",
  title: "Page is mobile-friendly (responsive viewport)",
  standard: "Google Search Essentials — mobile-first / responsive viewport",
  run(page) {
    const content =
      page.root.querySelector('meta[name="viewport"]')?.getAttribute("content")?.toLowerCase() ??
      "";
    if (content.includes("width=device-width")) {
      return {
        verdict: "pass",
        triage: "just-so-you-know",
        detail: "A responsive viewport is set, so the page adapts to phones.",
      };
    }
    return {
      verdict: "fail",
      triage: "well-fix-it",
      detail:
        "No responsive viewport tag. On phones the page renders zoomed-out and hard to use — and Google indexes mobile-first.",
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside <head>.',
    };
  },
};

const imgAltRule: Rule = {
  id: "img-alt",
  title: "Images have alt text",
  standard: "WCAG 2.2 — 1.1.1 Non-text Content (Level A)",
  run(page) {
    const images = page.root.querySelectorAll("img");
    if (images.length === 0) {
      return {
        verdict: "not-applicable",
        triage: "just-so-you-know",
        detail: "The page has no <img> elements.",
      };
    }
    // An absent alt attribute is a miss; alt="" is a valid choice for purely decorative images.
    const missing = images.filter((img) => img.getAttribute("alt") === undefined);
    if (missing.length === 0) {
      return {
        verdict: "pass",
        triage: "just-so-you-know",
        detail: `All ${images.length} image(s) have an alt attribute.`,
      };
    }
    const examples = missing
      .slice(0, 3)
      .map((img) => img.getAttribute("src") ?? "(no src)")
      .join(", ");
    return {
      verdict: "fail",
      triage: "well-fix-it",
      detail: `${missing.length} of ${images.length} image(s) are missing alt text (e.g. ${examples}). Screen-reader users hear nothing there, and it's a missed image-SEO signal.`,
      fix: 'Add descriptive alt text to each meaningful image (alt="…"), or alt="" if it is purely decorative.',
    };
  },
};

const noindexRule: Rule = {
  id: "noindex",
  title: "Page is not accidentally hidden from search engines",
  standard: "Google Search Essentials — robots meta / indexing",
  run(page) {
    const content =
      page.root.querySelector('meta[name="robots"]')?.getAttribute("content")?.toLowerCase() ?? "";
    if (content.includes("noindex")) {
      return {
        verdict: "fail",
        triage: "your-call",
        detail:
          "This page tells search engines NOT to index it (noindex). If that wasn't deliberate, the page is invisible to Google — catastrophic for a landing page. If it's a private or staging page, this is correct.",
        fix: 'If you want this page found, remove "noindex" from the <meta name="robots"> tag.',
      };
    }
    return {
      verdict: "pass",
      triage: "just-so-you-know",
      detail: "Nothing is blocking search engines from indexing the page.",
    };
  },
};

export const staticHtmlRules: Rule[] = [
  langRule,
  titleRule,
  metaDescriptionRule,
  viewportRule,
  imgAltRule,
  noindexRule,
];
