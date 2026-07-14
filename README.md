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

🔨 **Building — M0 (walking skeleton) has landed.** `revivify check` runs end-to-end today: a first pack of citable, source-only checks → a trust score → dual output (structured for the agent, plain-language for you). Next: **M1** wires axe-core + Lighthouse and the full 15-rule set. Milestones live in the [PRD](docs/prd.md).

**What works now — `revivify check`:**

```
$ revivify check ./demo-site

Revivify checked …/demo-site/index.html

  Trust: 5/10 — 3 of 6 checks passing

  ✗ Page declares its language
      WCAG 2.2 — 3.1.1 Language of Page (Level A)
      → Add a language to the opening <html> tag, e.g. <html lang="en">.  [We'll fix it]
  ✗ Page has a meta description   …
  ✗ Images have alt text          …

  Not yet ⚠️  — 3 checks to fix, then re-run to watch the score climb to 10.
```

The check exits `0` only at a perfect **10/10** (ship-ready) and non-zero otherwise — the deterministic gate the Claude Code hook will hang off. The M0 pack covers six source-checkable Tier-1 rules: `<html lang>`, `<title>`, meta description, responsive viewport, image alt text, and accidental `noindex`.

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
npm run walkthrough            # a narrated 2-minute tour (start here)
npm run check -- ./demo-site   # check a folder (or an .html file)
npm test                       # run the test suite
npm run build                  # compile to dist/ (provides the `revivify` bin)
```

`stdout` carries structured results for a coding agent; `stderr` carries the plain-language report and trust score for you.

### Try it / verify it as the end user

You don't need to read code to confirm Revivify works. Every milestone ships an end-user verification layer:

- **`npm run walkthrough`** — a guided, narrated tour of the real tool.
- **[`examples/`](examples/)** — pages with known results to check and compare against.
- **[`docs/walkthroughs/`](docs/walkthroughs/)** — a plain-language guide per milestone, each ending in an **acceptance checklist** you sign off to say "yes, this is the right thing."

## Planned architecture

An **[AXI](https://axi.md/)-designed CLI** (`revivify`) plus a **Claude Code hook**, in **Node / TypeScript**, wrapping **axe-core** and **Lighthouse**. No MCP server — see the [decision log](docs/decision-log.md) for why.

Inside `src/`: `cli.ts` (entry) → `commands/check.ts` (orchestration) → `checks/` (a registry of citable rule packs) → `score.ts` (trust-score rollup) → `report/` (a plain-language channel for the human and a structured channel for the agent).
