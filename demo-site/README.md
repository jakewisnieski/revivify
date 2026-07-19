# The Bloom demo site

A landing page that **looks shippable but fails silently** — the demo Revivify is built to
catch. It's a styled "Bloom" houseplant page (real CSS, hero, features, pricing, reviews,
footer) with four defects planted the way an AI coding agent hands them to a non-developer
without guardrails. Nothing here looks broken in a browser; the failures are all invisible.

This is the subject of the README hero GIF and the [M5 walkthrough](../docs/walkthroughs/).
It is **not** a test fixture — the automated fixtures live in [`examples/`](../examples/).

## What's planted

| # | Seed | Rule | Triage |
|---|---|---|---|
| 1 | `<html>` has no `lang` | `html-lang` (WCAG 3.1.1) | **We'll fix it** |
| 2 | the hero `<img>` has no `alt` | `img-alt` (WCAG 1.1.1) | **We'll fix it** |
| 3 | no `<meta name="description">` | `meta-description` (Search Essentials) | **We'll fix it** |
| 4 | a leftover `<meta name="robots" content="noindex">` | `noindex` (Search Essentials) | **Your call** |

Everything else is correct — colours clear WCAG AA contrast, images are optimized, the page
has a title and a responsive viewport — so those are the *only* findings.

## Expected results (full audit)

```bash
revivify check ./demo-site
```

**Before — 7 / 10 · Not yet ⚠️** (exit 1)

- Three **We'll fix it** findings: `html-lang`, `img-alt`, `meta-description`, each cited to its standard.
- One **Your call**: the `noindex`, unresolved — which keeps the page below the 10/10 bar
  even though every objective check passes.

**After — 10 / 10 · Ship-ready ✅** (exit 0), once you:

1. Add `lang="en"` to `<html>`, add `alt` to the hero image, and add a `<meta name="description">` (the three safe fixes), **and**
2. Resolve the `noindex` your-call — either remove it, or knowingly **accept** it with a reason
   (in the cockpit's *Accept* control, or in `.revivify.yaml`):

   ```yaml
   accept:
     noindex: "Staging preview — this build is intentionally hidden from Google."
   ```

An accepted your-call stays **visible** in the report with its reason — it's never scored as a
pass and never silently dropped (decision-log #18).

> If you change this page and the numbers above no longer match, that's the signal to update
> this table — the demo is only useful while its result is known.
