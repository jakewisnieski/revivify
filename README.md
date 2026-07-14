# Revivify

> **A landing page that lands — not just loads.**

Revivify is a quality gate for **people who build software with AI but don't write code themselves.**

AI coding agents (Claude Code, Cursor, and friends) are astonishingly good at *generating* a website. The hard part is knowing whether what they generated is any *good* — accessible, fast, findable — when you can't read the code to judge it yourself. Revivify closes that gap: it steers your agent toward established best practices up front, then checks the result against **citable standards** and hands you a plain-language, ship-or-don't verdict.

The first pack targets **landing / marketing pages.**

## Why it exists

I'm not a developer. I build things with AI agents. Every time, I hit the same wall: *I can ship code, but I can't tell if it's slop.* Revivify is the tool I wanted — one that lets a non-developer trust AI-written code, because its judgments come from real, published standards, not an opinion.

## How it works

1. **`revivify init`** — drops a best-practice **rules pack** that steers your coding agent, a one-page **plan + definition-of-done**, and a **hook** that runs the check automatically.
2. **Build** your landing page with your AI agent as usual — now guided.
3. **`revivify check`** — validates the output against cited standards and returns:
   - a **trust score** (e.g. *7 / 10 — 11 of 15 checks passing*),
   - each finding **citing the exact standard** it comes from,
   - fixes triaged as **"we'll fix it" / "just so you know" / "your call."**
4. The agent applies the safe fixes, Revivify re-checks, the score climbs — until it's **ship-ready.**

## What makes it different

- **Proactive, not after-the-fact.** Most tools scan a site *after* it's built. Revivify steers the agent *while* it builds — the one space the market leaves open.
- **Built for non-developers.** Every other AI-code checker assumes an engineer reads the output. Revivify assumes you can't.
- **Authority from standards, not vibes.** Verdicts cite **WCAG 2.2 AA**, **Core Web Vitals**, and **Google Search Essentials** — checked with the same deterministic engines the pros use (axe-core, Lighthouse).

## Status

🔨 **Building — M2 (a visual cockpit) has landed.** `revivify ui` opens a local web-app where you **watch the audit happen** — headless Chrome runs, the Lighthouse category gauges fill, each rule ticks to ✓/✗, and the trust dial lands on a score. It reuses the M1 engine and makes the verdict something you can *see*, not take on faith. `revivify check` still runs the same audit in the terminal. Next: **M3** (`revivify init` + the Claude Code hook that gates "done"). Milestones live in the [PRD](docs/prd.md).

**What works now — `revivify check` (the CLI; the cockpit shows the same, visually):**

```
$ revivify check ./examples/starter-slop
Running the full audit (Lighthouse) — this takes ~30–45s…

Revivify checked …/examples/starter-slop/index.html

  Trust: 6/10 — 6 of 10 checks passing
  Lighthouse: Performance 100 · Accessibility 56 · Best Practices 96 · SEO 73

  ✗ Images have alt text
      WCAG 2.2 — 1.1.1 Non-text Content (Level A)
      → Add descriptive alt text to each meaningful image…  [We'll fix it]
  ✗ Page declares its language      …
  ✗ Page has a title                …
  ✗ Page has a meta description     …

  Not yet ⚠️  — 4 checks to fix, then re-run to watch the score climb to 10.
```

The check exits `0` only at a perfect **10/10** (ship-ready) and non-zero otherwise — the deterministic gate the Claude Code hook will hang off. Add `--fast` for an instant static pre-check (no browser) while iterating. Two of the 15 catalog rules (non-text contrast, broken links) don't have a trustworthy automatic check yet and are deferred, not faked — see [decision log #10](docs/decision-log.md).

### Product docs

- [`docs/prd.md`](docs/prd.md) — the product requirements (problem, users, metrics, scope, milestones)
- [`docs/spec.md`](docs/spec.md) — the product spec
- [`docs/rule-catalog.md`](docs/rule-catalog.md) — the prioritized, cited rule set (15 MVP checks + roadmap)
- [`docs/competitive-landscape.md`](docs/competitive-landscape.md) — how Revivify sits against existing tools
- [`docs/decision-log.md`](docs/decision-log.md) — the key product & architecture decisions and their rationale

## Run it locally

Requires Node ≥ 20.

```bash
npm install
npm run ui                             # ⭐ the visual cockpit — watch the audit happen
npm run walkthrough                    # a narrated 2-minute tour
npm run check -- ./examples/perfect    # full Lighthouse audit (~30–45s)
npm run check -- ./examples/perfect --fast   # instant static pre-check (no browser)
npm test                               # run the test suite
npm run build                          # compile to dist/ (provides the `revivify` bin)
```

The full audit launches headless Chrome (auto-detected). 

`stdout` carries structured results for a coding agent; `stderr` carries the plain-language report and trust score for you.

### Try it / verify it as the end user

You don't need to read code to confirm Revivify works. Every milestone ships an end-user verification layer:

- **`npm run walkthrough`** — a guided, narrated tour of the real tool.
- **[`examples/`](examples/)** — pages with known results to check and compare against.
- **[`docs/walkthroughs/`](docs/walkthroughs/)** — a plain-language guide per milestone, each ending in an **acceptance checklist** you sign off to say "yes, this is the right thing."

## Architecture

An **[AXI](https://axi.md/)-designed CLI** (`revivify`) in **Node / TypeScript**, wrapping **Lighthouse** (which runs **axe-core** for accessibility), plus a **local web-app cockpit** (`revivify ui`) that reuses the same engine. The Claude Code hook that gates "done" arrives in M3. No MCP server — see the [decision log](docs/decision-log.md) for why.

Inside `src/`: `cli.ts` (entry) → `commands/check.ts` (orchestration; full vs `--fast`) and `commands/ui.ts` (serves the cockpit + streams the audit over SSE) → `engine/lighthouse.ts` (serves the page over loopback HTTP, drives headless Chrome, reports progress + category scores + audits) → `checks/` (rule packs: `lighthouse.ts` maps audits to cited findings, `staticHtml.ts` is the fast pre-check) → `score.ts` (trust-score rollup) → `report/` (a plain-language channel for the human and a structured channel for the agent). The cockpit's front-end lives in `web/`.
