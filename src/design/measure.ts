/**
 * Deterministic design-measurement extractor (M6.2).
 *
 * Drives headless Chrome over CDP to read the page's **real computed styles**
 * and returns a typed facts object — the factual substrate the grounded critique
 * (M6.3) reasons over so it can't confabulate numbers (experiments D/E). Per
 * experiment E it also captures **visual-failure signals** (unstyled page, no
 * real layout, default serif) so grounding can't mask a visually-broken page
 * (decision-log #31).
 *
 * The in-page script only *reads* raw DOM values; every interpretation —
 * WCAG contrast, CTA dedup, unstyled detection — happens here in TS, so it's
 * unit-tested without launching Chrome (Chrome-in-CI is avoided per #26; the
 * real end-to-end run is a skip-in-CI integration test, self-verified in Gate 0).
 */
import * as chromeLauncher from "chrome-launcher";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { isUrl } from "../target.js";
import { connectCdp } from "./cdp.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw readings pulled straight from the live DOM (no interpretation yet). */
export interface RawExtract {
  viewportWidth: number;
  authorStyleSheets: number;
  body: { fontSizePx: number; lineHeight: string; fontFamily: string; color: string; bg: string } | null;
  h1: { text: string; fontSizePx: number; weight: string; color: string; bg: string } | null;
  h2FontSizePx: number | null;
  primaryCta: { text: string; fontSizePx: number; filled: boolean; hasRadius: boolean; color: string; bg: string } | null;
  heroCtaGapPx: number | null;
  sectionPaddingsTopPx: number[];
  ctaCandidates: string[];
  usesLayoutContainers: boolean;
  contentImageCount: number;
  heroHasImage: boolean;
  /** [foreground, resolved-background] colour pairs for the min-contrast scan. */
  textColorPairs: [string, string][];
}

export interface Typography {
  fontSizePx: number;
  lineHeight: string;
  contrast: number | null;
}

export interface Heading {
  text: string;
  fontSizePx: number;
  weight: string;
  contrast: number | null;
}

export interface PrimaryCta {
  text: string;
  fontSizePx: number;
  /** A filled shape with a radius reads as a button; a plain text link does not. */
  styledAsButton: boolean;
  /** Text-on-button contrast, or null when the CTA isn't a filled button. */
  contrast: number | null;
}

export interface SpacingRange {
  minPx: number;
  maxPx: number;
}

/** Signals that a page is visually broken even when its numbers look healthy (experiment E). */
export interface VisualSignals {
  authorStyleSheets: number;
  bodyFontFamily: string;
  defaultSerifBody: boolean;
  usesLayoutContainers: boolean;
  contentImageCount: number;
  heroHasImage: boolean;
  /** A summary flag: the page looks essentially unstyled. */
  looksUnstyled: boolean;
}

/** The typed, structured facts the critique reasons over. */
export interface DesignFacts {
  target: string;
  viewportWidthPx: number;
  body?: Typography;
  h1?: Heading;
  h2FontSizePx?: number;
  primaryCta?: PrimaryCta;
  heroCtaGapPx?: number;
  sectionPaddingTopPx?: SpacingRange;
  ctaTexts: string[];
  minTextContrast: number | null;
  visual: VisualSignals;
}

export interface PageCapture {
  facts: DesignFacts;
  /** Full-page screenshot as base64 PNG — the vision input for M6.3. */
  screenshot: string;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a browser)
// ---------------------------------------------------------------------------

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Parse the leading r,g,b out of a CSS colour like "rgb(23, 40, 31)" / "rgba(…)". */
export function parseRgb(color: string): [number, number, number] | null {
  const nums = color.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}

/** WCAG relative luminance of an sRGB colour. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two CSS colours (1 dp), or null if unparseable. */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseRgb(fg);
  const b = parseRgb(bg);
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return round1((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05));
}

const CTA_RE = /access|start|join|get|sign|buy|waitlist|try|subscribe|shop/i;

/** Does this link/button text read as a call-to-action? */
export function isCta(text: string): boolean {
  return CTA_RE.test(text);
}

/** Distinct CTA texts, in order, capped — surfaces conflicting calls-to-action. */
export function dedupeCtas(texts: string[], limit = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of texts) {
    const t = raw.trim();
    if (!t || !isCta(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** The lowest text contrast among the scanned colour pairs, or null if none. */
export function minTextContrast(pairs: [string, string][]): number | null {
  let min: number | null = null;
  for (const [fg, bg] of pairs) {
    const c = contrastRatio(fg, bg);
    if (c === null) continue;
    if (min === null || c < min) min = c;
  }
  return min;
}

/** A body font-family that's a UA serif default reads as an unstyled page. */
function isDefaultSerif(fontFamily: string): boolean {
  return /(^|,)\s*(times new roman|times|serif)\s*$/i.test(fontFamily.trim());
}

function buildVisual(raw: RawExtract): VisualSignals {
  const bodyFontFamily = raw.body?.fontFamily ?? "";
  const defaultSerifBody = raw.authorStyleSheets === 0 || isDefaultSerif(bodyFontFamily);
  const looksUnstyled = raw.authorStyleSheets === 0 || (!raw.usesLayoutContainers && defaultSerifBody);
  return {
    authorStyleSheets: raw.authorStyleSheets,
    bodyFontFamily,
    defaultSerifBody,
    usesLayoutContainers: raw.usesLayoutContainers,
    contentImageCount: raw.contentImageCount,
    heroHasImage: raw.heroHasImage,
    looksUnstyled,
  };
}

/**
 * Shape raw DOM readings into typed facts — computing contrast, deduping CTAs,
 * and summarizing visual health. Missing raw fields degrade to omitted facts
 * (a clean partial result), never a throw.
 */
export function assembleFacts(raw: RawExtract, target: string): DesignFacts {
  const facts: DesignFacts = {
    target,
    viewportWidthPx: raw.viewportWidth,
    ctaTexts: dedupeCtas(raw.ctaCandidates),
    minTextContrast: minTextContrast(raw.textColorPairs),
    visual: buildVisual(raw),
  };

  if (raw.body) {
    facts.body = {
      fontSizePx: raw.body.fontSizePx,
      lineHeight: raw.body.lineHeight,
      contrast: contrastRatio(raw.body.color, raw.body.bg),
    };
  }
  if (raw.h1) {
    facts.h1 = {
      text: raw.h1.text,
      fontSizePx: raw.h1.fontSizePx,
      weight: raw.h1.weight,
      contrast: contrastRatio(raw.h1.color, raw.h1.bg),
    };
  }
  if (raw.h2FontSizePx != null) facts.h2FontSizePx = raw.h2FontSizePx;
  if (raw.primaryCta) {
    const cta = raw.primaryCta;
    const styledAsButton = cta.filled && cta.hasRadius;
    facts.primaryCta = {
      text: cta.text,
      fontSizePx: cta.fontSizePx,
      styledAsButton,
      contrast: cta.filled ? contrastRatio(cta.color, cta.bg) : null,
    };
  }
  if (raw.heroCtaGapPx != null) facts.heroCtaGapPx = raw.heroCtaGapPx;
  if (raw.sectionPaddingsTopPx.length > 0) {
    facts.sectionPaddingTopPx = {
      minPx: Math.min(...raw.sectionPaddingsTopPx),
      maxPx: Math.max(...raw.sectionPaddingsTopPx),
    };
  }
  return facts;
}

// ---------------------------------------------------------------------------
// In-page extraction (runs in the browser; reads raw values only)
// ---------------------------------------------------------------------------

/**
 * Runs IN the page and returns a {@link RawExtract}. Kept as a plain JS string
 * (not a transpiled function's `.toString()`) so bundler helpers never leak into
 * the injected code. All *interpretation* is done in TS above.
 */
const EXTRACT_JS = `(() => {
  const css = (el) => getComputedStyle(el);
  const px = (s) => Math.round(parseFloat(s));
  const transparent = (c) => !c || /rgba?\\(0, 0, 0, 0\\)|transparent/.test(c);
  const bgOf = (el) => { let e = el; while (e) { const c = css(e).backgroundColor; if (!transparent(c)) return c; e = e.parentElement; } return "rgb(255, 255, 255)"; };
  const q = (s) => document.querySelector(s);
  const text = (el) => ((el && el.textContent) || "").trim();
  const isCta = (t) => /access|start|join|get|sign|buy|waitlist|try|subscribe|shop/i.test(t);

  const out = { viewportWidth: window.innerWidth, authorStyleSheets: document.styleSheets.length };

  const body = document.body;
  out.body = body ? (() => { const s = css(body); return { fontSizePx: px(s.fontSize), lineHeight: s.lineHeight, fontFamily: s.fontFamily, color: s.color, bg: bgOf(body) }; })() : null;

  const h1 = q("h1");
  out.h1 = h1 ? (() => { const s = css(h1); return { text: text(h1).slice(0, 60), fontSizePx: px(s.fontSize), weight: s.fontWeight, color: s.color, bg: bgOf(h1) }; })() : null;
  const h2 = q("h2");
  out.h2FontSizePx = h2 ? px(css(h2).fontSize) : null;

  // A styled page's hero button wins; otherwise the largest CTA-ish control,
  // INCLUDING a bare <a> — an unstyled "raw link" CTA is a signal we want (exp E).
  const primaryEls = [...document.querySelectorAll(".hero .btn-primary, [class*=hero] .btn-primary, .btn-primary, button, a.btn, a")];
  const heroCta = q(".hero .btn-primary") || q("[class*=hero] .btn-primary")
    || primaryEls.filter((b) => isCta(text(b))).sort((a, b) => parseFloat(css(b).fontSize) - parseFloat(css(a).fontSize))[0]
    || primaryEls[0] || null;
  if (heroCta) {
    const s = css(heroCta);
    const filled = !transparent(s.backgroundColor);
    out.primaryCta = { text: text(heroCta).slice(0, 40), fontSizePx: px(s.fontSize), filled, hasRadius: s.borderRadius !== "0px", color: s.color, bg: s.backgroundColor };
    const row = heroCta.parentElement;
    const cg = row ? css(row).columnGap : "";
    const g = (cg && cg !== "normal") ? cg : (row ? css(row).gap : "");
    out.heroCtaGapPx = (g && g !== "normal") ? px(g) : null;
  } else {
    out.primaryCta = null;
    out.heroCtaGapPx = null;
  }

  out.ctaCandidates = [...document.querySelectorAll(".btn, button, a")].map(text).filter(Boolean).slice(0, 60);

  const secs = [...document.querySelectorAll("section, .hero, .features, .pricing, .reviews, .signup")].slice(0, 12);
  out.sectionPaddingsTopPx = secs.map((s) => px(css(s).paddingTop)).filter((n) => n > 0);

  out.usesLayoutContainers = [...document.querySelectorAll("body *")].slice(0, 400).some((el) => {
    const d = css(el).display;
    return d === "flex" || d === "grid" || d === "inline-flex" || d === "inline-grid";
  });
  out.contentImageCount = [...document.querySelectorAll("img")].filter((im) => (im.getAttribute("src") || "").trim().length > 0).length;
  const heroRegion = q(".hero") || q("[class*=hero]") || q("header") || body;
  out.heroHasImage = !!(heroRegion && heroRegion.querySelector("img[src]"));

  out.textColorPairs = [...document.querySelectorAll("h1,h2,h3,p,a,li,span")].slice(0, 150).filter((el) => text(el)).map((el) => [css(el).color, bgOf(el)]);
  return out;
})()`;

// ---------------------------------------------------------------------------
// Chrome capture (integration-tested; skipped in CI)
// ---------------------------------------------------------------------------

/** Let the page settle/render before we read computed styles. */
const SETTLE_MS = 1500;
/** Cap a full-page screenshot's height so a very tall page can't blow up memory. */
const MAX_SHOT_HEIGHT = 6000;

interface EvaluateResponse {
  result?: { value?: unknown };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

/** Find the page target's WebSocket debugger URL, retrying until Chrome is ready. */
async function pageWebSocketUrl(port: number): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl?: string }[];
    const page = targets.find((t) => t.type === "page");
    if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Couldn't find a Chrome page target to inspect.");
}

/** Capture a clipped full-page screenshot as base64 PNG. */
async function captureScreenshot(client: ReturnType<typeof connectCdp>, viewportWidth: number): Promise<string> {
  const metrics = (await client.send("Page.getLayoutMetrics")) as {
    cssContentSize?: { height: number };
    contentSize?: { height: number };
  };
  const contentHeight = (metrics.cssContentSize ?? metrics.contentSize)?.height ?? 1600;
  const height = Math.min(Math.ceil(contentHeight), MAX_SHOT_HEIGHT);
  const shot = (await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: viewportWidth || 1280, height, scale: 1 },
  })) as { data: string };
  return shot.data;
}

/**
 * Launch headless Chrome at a local build or a live URL, extract the design
 * facts and a full-page screenshot in one session, then clean up.
 */
export async function capturePage(target: string): Promise<PageCapture> {
  const url = isUrl(target) ? target.trim() : pathToFileURL(resolve(target)).href;
  const chrome = await chromeLauncher.launch({
    startingUrl: url,
    chromeFlags: [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1280,1600",
    ],
  });
  try {
    const wsUrl = await pageWebSocketUrl(chrome.port);
    const client = connectCdp(wsUrl);
    await client.ready;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    const evaluated = (await client.send("Runtime.evaluate", {
      expression: EXTRACT_JS,
      returnByValue: true,
    })) as EvaluateResponse;
    if (evaluated.exceptionDetails) {
      throw new Error(
        `Design extraction failed in the page: ${evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text ?? "unknown error"}`,
      );
    }
    const raw = evaluated.result?.value as RawExtract | undefined;
    if (!raw) throw new Error("Design extraction returned no facts.");

    const facts = assembleFacts(raw, target);
    const screenshot = await captureScreenshot(client, raw.viewportWidth);
    client.close();
    return { facts, screenshot };
  } finally {
    // chrome-launcher's temp-dir cleanup throws EPERM on Windows; the work is done, so ignore it.
    try {
      chrome.kill();
    } catch {
      /* ignore Chrome cleanup errors */
    }
  }
}
