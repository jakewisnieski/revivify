# Revivify — Product Spec (landing-page pack)

## Positioning
**"A landing page that lands, not just loads."** Revivify is a trust/quality gate that helps **non-developers** ship real-quality landing pages built with AI coding agents — enforcing citable best practices so the output isn't slop.

## Target user
Non-developers building **landing / marketing sites with coding agents** (Claude Code, Cursor, and similar) — people who can *generate* code but can't read or evaluate it. v0/Lovable = later fast-follow; visual no-code (Webflow/Framer) and copy-pasters = out of scope for the beachhead.

## Product identity — a guardrailed lifecycle-in-a-box (four pillars)
1. **Plan / method** — a tiny opinionated lifecycle: *goal → build-with-guardrails → check → fix → ship-ready*; "definition of done" = passing the gate. MVP = a one-page plan + definition-of-done dropped at init.
2. **Guardrails** — a rules pack (`CLAUDE.md` / `.cursorrules`) that steers the agent to best practices *up front*.
3. **Validate** — deterministic checks (wrapping **axe-core** + **Lighthouse**) → trust score + cited findings + fixes.
4. **Education woven through** — every finding teaches the *why* and cites the exact standard.

Two credibility principles: authority comes from **codifying established, citable standards** (not "our AI is smart"); the product is built **for people who can't read the code.**

## Integration — AXI CLI + Claude Code hook (no MCP)
- **`revivify init`** → drops the rules pack + one-page plan/definition-of-done + `.revivify.yaml` config, and installs the check-on-"done" hook.
- **`revivify check ./site`** → an **[AXI](https://axi.md/)-designed CLI** (structured TOON to stdout for the agent, progress to stderr) that runs the deterministic validators.
- **Claude Code hook** (`PostToolUse` / `Stop`) auto-runs `check` and **blocks "done" until the trust score clears the bar** — the deterministic guardrail.
- **Dual-audience output:** structured for the coding agent; plain-language report + trust score for the human.
- Later adapters (out of scope now): non-Claude agents, v0/Lovable.

## Check experience
- **Intent-first:** capture the page's goal up front (contextualizes findings, avoids flagging deliberate choices).
- **Three-way triage per finding:** **"We'll fix it"** (safe, agent-applied) · **"Just so you know"** (info) · **"Your call"** (judgment, e.g. brand-driven contrast). The human stays in charge of judgment calls.
- **Own-the-fix loop:** propose fix → user approves → the coding agent applies it → re-check → score updates.
- **Outcome:** **"Ship-ready ✅ / Not yet ⚠️"** + trust score + a clear next step.

## Trust score
**X / 10** headline, always shown beside a concrete **"N of 15 checks passing"** (failing ones named). Composed from Lighthouse category scores (0–100 for Performance/Accessibility/SEO/Best-Practices) + axe results across the 15 MVP checks; non-applicable checks drop from the denominator.

## Rules
MVP = 15 checks; fast-follow = 5; roadmap = 11. Full cited catalog → [`rule-catalog.md`](rule-catalog.md). Standards: WCAG 2.2 AA, Core Web Vitals, Google Search Essentials.

## Stack
**Node / TypeScript CLI** — axe-core and Lighthouse are JS/npm, so wrapping them keeps the stack single-language and agent-friendly.

## Out of scope (for now)
Tier-2/3 rules; v0/Lovable + MCP adapters; additional domain packs beyond landing pages; building/shipping the product itself (this document is the spec that a build effort implements).
