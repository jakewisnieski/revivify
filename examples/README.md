# Example gallery

A set of landing pages to run `revivify check` against — each with a **known** result, so you can confirm the tool behaves. Every page is the same fictional "Bloom" landing page; what differs is what's wrong with it.

Run any one and compare against the "Expected" column:

```bash
npm run check -- ./examples/missing-alt
```

| Example | What's planted | Expected result |
|---|---|---|
| [`perfect/`](perfect/) | Nothing — every check passes | **10 / 10 · Ship-ready ✅** (exit 0) |
| [`starter-slop/`](starter-slop/) | A raw page with no guardrails: no language, title, description, or mobile viewport, and a hero image with no alt text | **2 / 10 · Not yet ⚠️** (5 checks failing) |
| [`missing-alt/`](missing-alt/) | One accessibility miss: the hero image has no alt text | **8 / 10 · Not yet ⚠️** (WCAG 1.1.1) |
| [`no-meta-description/`](no-meta-description/) | One SEO miss: no meta description | **8 / 10 · Not yet ⚠️** (Search Essentials) |
| [`accidental-noindex/`](accidental-noindex/) | A leftover `noindex` hiding the page from Google — flagged as **"Your call"**, not auto-fixed, because it can be deliberate | **8 / 10 · Not yet ⚠️** |

The exit code is `0` only for a perfect **10 / 10** (ship-ready) and non-zero otherwise — the same signal the Claude Code hook will use to gate "done."

> These are also the fixtures the guided tour (`npm run walkthrough`) and the automated tests use, so if a change ever alters a result here, you'll see it immediately.
