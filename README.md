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

📋 **Spec complete — build starting.** This repo currently holds the product definition:

- [`docs/spec.md`](docs/spec.md) — the product spec
- [`docs/rule-catalog.md`](docs/rule-catalog.md) — the prioritized, cited rule set (15 MVP checks + roadmap)
- [`docs/competitive-landscape.md`](docs/competitive-landscape.md) — how Revivify sits against existing tools
- [`docs/decision-log.md`](docs/decision-log.md) — the key product & architecture decisions and their rationale

## Planned architecture

An **[AXI](https://axi.md/)-designed CLI** (`revivify`) plus a **Claude Code hook**, in **Node / TypeScript**, wrapping **axe-core** and **Lighthouse**. No MCP server — see the [decision log](docs/decision-log.md) for why.
