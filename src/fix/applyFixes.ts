import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { parse } from "node-html-parser";
import { loadPage } from "../loadPage.js";
import { staticHtmlRules } from "../checks/staticHtml.js";

/**
 * The own-the-fix loop, made real in the cockpit (M5.6, refines decision #20).
 *
 * Revivify may now apply the **safe, honestly-sourced** "we'll fix it" fixes to a
 * page on explicit approval — but only values it can source from the page or its
 * assets, **never fabricated** (a machine-written `alt` is worse than none, the
 * false-reassurance line of #10/#12). Anything it can't source honestly is left
 * for the coding agent, which understands the page's content.
 *
 * Edits are **string surgery** on the raw HTML (the config.ts spirit), so the
 * doctype, comments, and formatting are preserved; a read-only parse computes
 * what to change and derives the values.
 */

export interface FixChange {
  id: string;
  title: string;
  /** Plain-language note of what was applied or why it was skipped. */
  description: string;
}

export interface FixOutcome {
  html: string;
  changed: FixChange[];
  skipped: FixChange[];
}

export interface ApplyResult {
  file: string;
  changed: FixChange[];
  skipped: FixChange[];
  /** True if the fixes were withheld because they would have lowered the score (guardrail). */
  regressed: boolean;
}

/** Resolve an `<img>`'s accessible name from the asset itself — never fabricated. */
export type AltResolver = (src: string, imgTitle: string | undefined) => Promise<string | undefined>;

const attrEscape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tidy = (s: string, n: number): string => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
};

/** Count the objective static checks a page passes — the guardrail's before/after measure. */
function staticPassCount(html: string): number {
  const page = { path: "", html, root: parse(html) };
  return staticHtmlRules.filter((rule) => rule.run(page).verdict === "pass").length;
}

/**
 * Compute the safe fixes for a page's HTML. Pure: returns the new HTML plus what
 * it changed and what it deliberately skipped (left for the agent).
 */
export async function computeSafeFixes(html: string, deriveAlt: AltResolver): Promise<FixOutcome> {
  const root = parse(html);
  const changed: FixChange[] = [];
  const skipped: FixChange[] = [];
  let out = html;

  // Locate the first *real* (non-comment) match of `re` in the current `out`.
  // We search a copy with comments masked to spaces so structural regexes never
  // match inside a comment — the demo page literally documents "<html>" and
  // "<img>" in a comment, which a naive match would edit by mistake. Offsets in
  // the masked copy line up 1:1 with `out`.
  const findReal = (re: RegExp): { text: string; index: number } | null => {
    const masked = out.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));
    const m = new RegExp(re.source, re.flags.replace("g", "")).exec(masked);
    return m ? { text: out.slice(m.index, m.index + m[0].length), index: m.index } : null;
  };
  const splice = (index: number, length: number, replacement: string): void => {
    out = out.slice(0, index) + replacement + out.slice(index + length);
  };
  const insertInHead = (snippet: string): boolean => {
    const head = findReal(/<\/head\s*>/i);
    if (!head) return false;
    splice(head.index, 0, `  ${snippet}\n  `);
    return true;
  };

  // 1. html-lang → a deterministic default.
  const htmlEl = root.querySelector("html");
  if (htmlEl && !(htmlEl.getAttribute("lang") ?? "").trim()) {
    const tag = findReal(/<html\b[^>]*>/i);
    if (tag && !/\blang=/i.test(tag.text)) {
      splice(tag.index, tag.text.length, tag.text.replace(/<html\b/i, '<html lang="en"'));
      changed.push({ id: "html-lang", title: "Page declares its language", description: 'Added lang="en" to the <html> tag.' });
    }
  }

  // 2. meta-viewport → the standard, deterministic tag.
  if (!root.querySelector('meta[name="viewport"]') && insertInHead('<meta name="viewport" content="width=device-width, initial-scale=1" />')) {
    changed.push({ id: "meta-viewport", title: "Page is mobile-friendly (responsive viewport)", description: "Added a responsive viewport meta tag." });
  }

  // 3. doc-title → sourced from the page's own <h1>.
  if (!root.querySelector("title")?.text?.trim()) {
    const h1 = root.querySelector("h1")?.text?.trim();
    if (h1 && insertInHead(`<title>${attrEscape(tidy(h1, 70))}</title>`)) {
      changed.push({ id: "doc-title", title: "Page has a title", description: "Added a <title> from the page's heading." });
    } else if (!h1 && findReal(/<\/head\s*>/i)) {
      skipped.push({ id: "doc-title", title: "Page has a title", description: "No <h1> to source a title from — left for your agent." });
    }
  }

  // 4. meta-description → sourced from the page's own lede copy.
  const descContent = (root.querySelector('meta[name="description"]')?.getAttribute("content") ?? "").trim();
  if (!descContent) {
    const lede = root.querySelectorAll("p").map((p) => p.text.trim()).find((t) => t.length > 40);
    if (lede && insertInHead(`<meta name="description" content="${attrEscape(tidy(lede, 155))}" />`)) {
      changed.push({ id: "meta-description", title: "Page has a meta description", description: "Added a meta description from the page's own copy." });
    } else if (!lede && findReal(/<\/head\s*>/i)) {
      skipped.push({ id: "meta-description", title: "Page has a meta description", description: "No page copy to source a description from — left for your agent." });
    }
  }

  // 5. img-alt → sourced from the image asset's own declared accessible name.
  for (const img of root.querySelectorAll("img").filter((i) => i.getAttribute("alt") === undefined)) {
    const src = img.getAttribute("src") ?? "";
    const found = src
      ? findReal(new RegExp(`<img\\b[^>]*\\bsrc=["']${reEscape(src)}["'][^>]*>`, "i"))
      : findReal(/<img\b(?![^>]*\balt=)[^>]*>/i);
    if (!found || /\balt=/i.test(found.text)) continue;
    const alt = await deriveAlt(src, img.getAttribute("title") ?? undefined);
    if (alt) {
      splice(found.index, found.text.length, found.text.replace(/<img\b/i, `<img alt="${attrEscape(alt)}"`));
      changed.push({ id: "img-alt", title: "Images have alt text", description: `Set alt text on ${src || "an image"} from its own description.` });
    } else {
      skipped.push({ id: "img-alt", title: "Images have alt text", description: `${src || "An image"} has no sourceable description — left for your agent to describe.` });
    }
  }

  return { html: out, changed, skipped };
}

/** The default resolver: only a local asset's *own* declared accessible name (SVG title / aria-label) or an explicit img `title`. */
export function assetAltResolver(pageDir: string): AltResolver {
  return async (src, imgTitle) => {
    if (imgTitle?.trim()) return imgTitle.trim();
    if (!src || /^(https?:|data:|\/\/)/i.test(src)) return undefined; // only local assets
    if (!/\.svg(?:$|[?#])/i.test(src)) return undefined; // only SVGs carry a name we can trust
    try {
      const svg = parse(await readFile(join(pageDir, src.split(/[?#]/)[0]), "utf8"));
      const label = svg.querySelector("svg")?.getAttribute("aria-label")?.trim();
      if (label) return label;
      const title = svg.querySelector("title")?.text?.trim();
      if (title) return title;
    } catch {
      /* asset unreadable — leave it for the agent */
    }
    return undefined;
  };
}

/**
 * Apply the safe fixes to the page at `pathInput` and write them back.
 *
 * Guardrail (§4 auto-fix-regression metric): the fixes are strictly additive, so
 * they can't lower the score — but we verify it anyway. If the objective
 * static-pass count didn't improve, nothing is written and the change is reported
 * as withheld rather than silently applied.
 */
export async function applySafeFixes(pathInput: string): Promise<ApplyResult> {
  const { path: file, html } = await loadPage(pathInput);
  const outcome = await computeSafeFixes(html, assetAltResolver(dirname(file)));

  if (outcome.changed.length === 0) {
    return { file, changed: [], skipped: outcome.skipped, regressed: false };
  }

  if (staticPassCount(outcome.html) < staticPassCount(html)) {
    return { file, changed: [], skipped: outcome.changed, regressed: true };
  }

  await writeFile(file, outcome.html, "utf8");
  return { file, changed: outcome.changed, skipped: outcome.skipped, regressed: false };
}
