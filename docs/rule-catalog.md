# Revivify rule catalog (landing-page pack)

The full set of checks the landing-page pack covers and grows into — every rule tied to a published standard.

**Tier 1 = MVP (15)** · **Tier 2 = fast-follow (5)** · **Tier 3 = roadmap (11)**. Standards: **WCAG 2.2 Level A/AA** · **Core Web Vitals** · **Google Search Essentials**. ⏳ = fuzzy/interaction-based/higher-effort · 🧑 = often a "your call" judgment finding.

> **Build status (M1):** 13 of the 15 Tier-1 rules are **live** via Lighthouse/axe. Two are **deferred, not faked** — non-text/UI contrast (1.4.11) and broken links / 404s have no trustworthy automatic check yet ([decision log #10](decision-log.md)). The trust score counts *applicable* rules ("N of M passing"), not a fixed 15.

## ♿ Accessibility — WCAG 2.2 (A/AA)

| Rule (cited standard) | Why it matters | Tier |
|---|---|---|
| Images missing alt text — WCAG 1.1.1 Non-text Content (A) | AI omits constantly; doubles as image SEO | **1** |
| Text contrast < 4.5:1 — WCAG 1.4.3 Contrast Minimum (AA) | 🧑 low-contrast aesthetic text; sometimes brand-intentional | **1** |
| Missing `<html lang>` — WCAG 3.1.1 Language of Page (A) | Near-universal miss; one-line fix | **1** |
| Form inputs without labels — WCAG 1.3.1 / 4.1.2 (A) | Email-capture forms everywhere | **1** |
| UI/graphic contrast < 3:1 — WCAG 1.4.11 Non-text Contrast (AA) | Faint borders, icons, form outlines | **1** |
| Broken heading order / missing or multiple H1 — WCAG 1.3.1 (A) | a11y + SEO; AI scatters headings | **2** |
| Buttons/icons without accessible names — WCAG 4.1.2 (A) | Icon-only buttons read as nothing | **2** |
| No visible focus indicator — WCAG 2.4.7 Focus Visible (AA) | Most common AI regression (`outline:none`) | **2** |
| Non-descriptive link text ("click here") — WCAG 2.4.4 (A) | Screen readers navigate by link list | 3 |
| Meaning by color alone — WCAG 1.4.1 Use of Color (A) | Required fields, error states | 3 |
| Tap targets < 24×24px — WCAG 2.5.8 Target Size (AA, 2.2) | Tiny mobile buttons | 3 |
| Horizontal scroll / no reflow at 320px — WCAG 1.4.10 Reflow (AA) | Fixed-width layouts break on phones | 3 |

## ⚡ Performance — Core Web Vitals + Lighthouse

| Rule (cited standard) | Why it matters | Tier |
|---|---|---|
| LCP ≤ 2.5s — Core Web Vitals (LCP) | Usually a giant unoptimized hero image | **1** |
| CLS ≤ 0.1 — Core Web Vitals (CLS) | Content jumps as images/fonts load | **1** |
| Oversized / non-next-gen images (WebP/AVIF) — Lighthouse | #1 fixable perf sin | **1** |
| Image width/height not set — Lighthouse (feeds CLS) | Reserve space to stop shift | **2** |
| Render-blocking CSS/JS — Lighthouse | Delays first paint | 3 |
| Unused CSS/JS shipped — Lighthouse | Whole frameworks for a static page | 3 |
| Webfont hides text while loading (`font-display: swap`) — Lighthouse | Invisible text flash | 3 |
| INP ≤ 200ms — Core Web Vitals (INP) ⏳ | Interaction responsiveness; hard to measure statically | 3 |

## 🔎 SEO & discoverability — Google Search Essentials + Lighthouse SEO

| Rule (cited standard) | Why it matters | Tier |
|---|---|---|
| Missing/duplicate `<title>` — Search Essentials / Lighthouse | Biggest ranking + tab signal | **1** |
| Missing meta description — Search Essentials / Lighthouse | Controls the search snippet | **1** |
| Missing viewport / not mobile-friendly — Search Essentials | Google indexes mobile-first | **1** |
| Accidental noindex / robots block — Search Essentials ⚠️ | Catastrophic when present — page invisible to Google; cheap deterministic check | **1** |
| Missing Open Graph / Twitter cards — social-share best practice | Blank share previews kill clicks | **2** |
| Links not crawlable (no real `href`) — Lighthouse | JS-only "links" invisible to crawlers | 3 |
| Missing canonical tag — Search Essentials | Duplicate-URL dilution | 3 |
| Missing structured data (Organization/LocalBusiness) — Google ⏳ | Rich results; higher effort | 3 |

## ✅ Best practices & trust — Lighthouse Best Practices

| Rule (cited standard) | Why it matters | Tier |
|---|---|---|
| Not served over HTTPS — Search Essentials / Lighthouse | Trust + ranking + browser warnings | **1** |
| Console errors / invalid HTML — Lighthouse Best Practices | Signals fragile output | **1** |
| Broken links / 404s — general | Dead CTAs = lost conversions | **1** |

---

**Trust score:** headline **X / 10** shown beside a concrete **"N of 15 checks passing"** (failing ones named); composed from Lighthouse category scores (0–100 for Perf/A11y/SEO/Best-Practices) + axe results across the 15 MVP checks; non-applicable checks (e.g. no form) drop out of the denominator so it's never unfair.
