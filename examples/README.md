# Example gallery

A set of landing pages to run `revivify check` against — each with a **known** result, so you can confirm the tool behaves. Every page is the same fictional "Bloom" landing page; what differs is what's wrong with it.

Run any one and compare against the "Expected" column (the default check is the **full Lighthouse audit**, ~30–45s):

```bash
npm run check -- ./examples/missing-alt
```

| Example | What's planted | Expected (full audit) |
|---|---|---|
| [`perfect/`](perfect/) | Nothing — every applicable check passes | **10 / 10 · Ship-ready ✅** (exit 0) |
| [`starter-slop/`](starter-slop/) | A raw page with no guardrails: no language, title, or description, and a hero image with no alt text | **6 / 10 · Not yet ⚠️** (4 checks failing) |
| [`missing-alt/`](missing-alt/) | One accessibility miss: the hero image has no alt text | **9 / 10 · Not yet ⚠️** (WCAG 1.1.1) |
| [`no-meta-description/`](no-meta-description/) | One SEO miss: no meta description | **9 / 10 · Not yet ⚠️** (Search Essentials) |
| [`accidental-noindex/`](accidental-noindex/) | A leftover `noindex` hiding the page from Google — flagged as **"Your call"**, not auto-fixed, because it can be deliberate | **9 / 10 · Not yet ⚠️** (your-call unresolved — accept it in `.revivify.yaml` or fix it to reach 10/10) |

The exit code is `0` only for a perfect **10 / 10** (ship-ready) and non-zero otherwise — the same signal the Claude Code hook will use to gate "done." `Form inputs have labels` shows as *not applicable* on these pages (no forms), so it drops out of the denominator.

A **"Your call"** finding (like the `noindex` above) also sits outside the objective pass/fail score — it's a judgment item you resolve by *fixing* it or *accepting* it with a reason in `.revivify.yaml` (`accept:  { noindex: "staging page" }`). It's never scored as a passing check and never silently dropped: an unresolved one stays visible and keeps the page below the 10/10 bar until you decide.

> **Full vs. fast.** The default runs the real Lighthouse audit (13 rules incl. performance, contrast, HTTPS, console errors). Adding `--fast` runs only the six instant static checks as a quick pre-check — a *narrower* look, so its score isn't directly comparable to the full audit (e.g. `starter-slop` is 6/10 full but 2/10 fast).

> These pages are also the fixtures the guided tour (`npm run walkthrough`) and the tests use, so if a change ever alters a result here, you'll see it immediately.
