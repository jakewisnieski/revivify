# Revivify — Product Requirements Document

> **A landing page that lands, not just loads.**
> A trust/quality gate that lets non-developers ship real-quality landing pages built with AI coding agents — by steering the agent toward citable best practices up front, then validating the result against published standards.

| | |
|---|---|
| **Status** | Draft v1 — build starting |
| **Owner** | Jake Wisnieski (product) |
| **Last updated** | 2026-07-14 |
| **Related** | [`spec.md`](spec.md) · [`rule-catalog.md`](rule-catalog.md) · [`competitive-landscape.md`](competitive-landscape.md) · [`decision-log.md`](decision-log.md) |

This PRD is the product contract the build implements. The **spec** describes *what the system is*; this document describes *who it's for, why it wins, what "good" means, and in what order we build it.* Where they overlap, the spec is the source of truth for mechanics and this PRD for intent, scope, and success.

---

## 1. Problem

AI coding agents (Claude Code, Cursor, and friends) have made it possible for **people who don't write code** to generate a working website in an afternoon. Generation is solved. **Judgment is not.**

The non-developer who ships an AI-built landing page hits one wall every time: *I can ship code, but I can't tell if it's slop.* They can't read the output to know whether it's accessible, fast, or findable — the three things that decide whether a landing page actually **lands** (converts, ranks, works for everyone) instead of merely **loading**.

Two facts make this urgent and this shape of solution the right one:

- **The failure modes are common, invisible to the author, and citable.** AI-generated pages routinely ship missing `alt` text, no `<html lang>`, unlabeled forms, an accidental `noindex` (catastrophic — invisible to Google), oversized hero images (blown LCP), and missing titles/meta. Each maps to a **published standard** (WCAG 2.2 AA, Core Web Vitals, Google Search Essentials) and to a **deterministic engine** (axe-core, Lighthouse) — so a verdict can be *proven*, not opined.
- **The market leaves the winning move open.** Every AI-code reviewer (Greptile, CodeRabbit, Qodo, SonarQube, Codacy, Cursor/Copilot/Claude Code built-ins) is built **for developers, in-IDE, per-seat.** Every non-dev landing-page quality tool (Siteimprove, accessScan, "AI website checkers") **scans after the fact.** Nobody **steers a non-developer's coding agent up front.** (Full scan: [`competitive-landscape.md`](competitive-landscape.md).)

## 2. Target user & jobs-to-be-done

**Primary persona — "Casey, the non-dev builder."** Founder / marketer / solo operator who builds landing and marketing pages with an AI coding agent. Can *describe* what they want and *generate* code; **cannot read or evaluate** the result. Cares about outcomes (conversions, launch, looking professional), not about WCAG success criteria by number.

**Jobs-to-be-done**
- *When my agent says a page is done,* **I want to know whether it's actually good enough to ship,** *so I don't launch something broken, inaccessible, or invisible to Google.*
- *When something's wrong,* **I want it fixed without having to understand the code,** *so I can stay in charge of the decisions that are mine (brand, judgment) and hand the rest back to the agent.*
- *While I'm building,* **I want the agent guided toward doing it right the first time,** *so I'm not cleaning up avoidable mistakes after the fact.*

**Explicit non-users (beachhead):** professional developers (served by every existing tool); visual no-code builders (Webflow/Framer); v0/Lovable users (a *later* fast-follow, not now).

## 3. Goals & non-goals

**Goals**
1. Give a non-developer a **trustworthy ship / don't-ship signal** for an AI-built landing page, every verdict tied to a citable standard.
2. **Steer the agent up front** so fewer defects exist to catch — the defensible, uncrowded wedge.
3. Make fixing **not require reading code**: triage, plain language, and an own-the-fix loop where the agent does the work.
4. **Teach as it goes** — every finding explains the *why* and cites the source, so trust compounds.

**Non-goals (now)**
- Not a developer code-review tool, and not per-seat/in-IDE.
- Not an after-the-fact-only scanner (we scan *and* steer; steering is the differentiator).
- Not a general web-quality platform yet — **one beachhead domain (landing pages), done deeply.** Generality comes later via pluggable packs.
- Not building an MCP server (an AXI CLI + Claude Code hook is cheaper and deterministic — see decision log #4).

## 4. Success metrics

**North Star — Ship-ready rate:** the share of projects that reach a **ship-ready trust score** through Revivify's check→fix loop. It captures the whole point: a non-dev started unsure and ended with something provably good enough to ship.

**Ship-ready is defined as a perfect 10/10** — every applicable check passing (§8.1, decision log #9). A non-developer can't judge which remaining gap is the one that breaks their site, so anything short of perfect leaves doubt; a perfect bar is the only threshold that lets them trust nothing broken was left behind.

| Layer | Metric | Why it matters | Target (directional) |
|---|---|---|---|
| **Activation** | % of `revivify init` users who run ≥1 `revivify check` | Did they reach the core value at all? | ≥ 70% |
| **Value delivered** | Median **trust-score lift**, first check → ship-ready | Proves the tool measurably improves pages | +3 points or more |
| **Efficiency** | Median **check→fix loops** to reach ship-ready | Value should arrive fast, not after a grind | ≤ 3 loops |
| **Trust of the gate** | **Auto-fix regression rate** — "we'll fix it" fixes that break/regress the page | The gate's credibility dies if a "safe" fix makes things worse | ~0% (hard guardrail) |
| **Retention** | Repeat use across ≥ 2 projects | Did it become their default before shipping? | leading indicator |

**Counter-metrics / anti-goals:** false-positive findings on deliberate choices (mitigated by intent capture); flagging brand decisions as errors instead of "your call"; check runtime so slow it discourages running on every "done."

*(These are product targets for the tool's behavior and a hypothetical user base — this is a portfolio flagship, so targets are directional, not committed SLAs.)*

## 5. Product principles

1. **Authority from standards, not vibes.** Every verdict cites a real, published rule checked by a real engine (axe-core, Lighthouse). No "our AI thinks…". This is what earns a non-developer's trust.
2. **Built for someone who can't read the code.** Plain language to the human; structured data to the agent. The human owns judgment; the agent owns implementation.
3. **Proactive before reactive.** Guide the build, then check it — don't just grade it at the end.
4. **The human stays in charge.** Safe fixes are proposed and applied on approval; judgment calls (brand, contrast-by-choice) are surfaced as "your call," never overridden.

## 6. Solution overview — a guardrailed lifecycle in a box

Four pillars implement one tiny lifecycle: **goal → build-with-guardrails → check → fix → ship-ready.**

1. **Plan / method** — a one-page plan + definition-of-done (= "passing the gate"), dropped at init.
2. **Guardrails** — a rules pack (`CLAUDE.md` / `.cursorrules`) that steers the agent to best practices *up front*.
3. **Validate** — deterministic checks (axe-core + Lighthouse) → **trust score + cited findings + triaged fixes**.
4. **Educate** — every finding teaches the *why* and cites the exact standard.

**Delivery:** an [AXI](https://axi.md/)-designed CLI (`revivify init` / `revivify check`) plus a **Claude Code hook** that auto-runs the check and **blocks "done" until the score clears the bar.** Node / TypeScript (axe-core and Lighthouse are JS). Full mechanics in [`spec.md`](spec.md).

## 7. Key user flows

**F1 — Init (once per project).** `revivify init` drops the rules pack + one-page plan/definition-of-done + `.revivify.yaml`, and installs the check-on-"done" hook. *Outcome: the agent is now guided, and "done" is gated.*

**F2 — Build (guided).** Casey builds the page with their agent as usual — now steered by the guardrails toward fewer defects.

**F3 — Check.** `revivify check ./site` captures the page's **intent** first (so it doesn't flag deliberate choices), runs the validators, and returns a **trust score** (`X/10` beside "N of 15 checks passing," failing ones named) with each finding **citing its standard**, triaged three ways:
- **"We'll fix it"** — safe, agent-applied.
- **"Just so you know"** — informational.
- **"Your call"** — judgment (e.g. brand-driven contrast); the human decides.

**F4 — Fix (own-the-fix loop).** Propose fix → user approves → the coding agent applies it → Revivify re-checks → score updates. Repeat until the bar clears.

**F5 — Verdict.** **"Ship-ready ✅ / Not yet ⚠️"** + trust score + one clear next step. Ship-ready means a full **10/10** — the gate holds until every applicable check passes.

## 8. Scope

### 8.1 MVP (must-have)
- `revivify check ./site` → runs the **15 Tier-1 rules** across a11y / performance / SEO / best-practices ([`rule-catalog.md`](rule-catalog.md)).
- **Trust score:** `X/10` headline + "N of 15 passing"; composed from Lighthouse category scores + axe results; **non-applicable checks drop from the denominator** so a simple page is never penalized.
- **Ship-ready bar = 10/10** (default; configurable in `.revivify.yaml`) — every applicable objective check passing. "Your call" judgment items must be explicitly resolved (fixed or knowingly accepted) so a deliberate brand choice doesn't trap the page below the bar.
- **Dual-audience output:** structured TOON to stdout for the agent; plain-language report for the human; progress to stderr.
- **Three-way triage** + **intent capture** + **own-the-fix loop**.
- `revivify init` → rules pack + plan/definition-of-done + `.revivify.yaml` + Claude Code hook that gates "done."
- Every finding **cites its standard** and explains the *why*.

### 8.2 Fast-follow (post-MVP)
- The **5 Tier-2 rules** (heading order, accessible names, focus visibility, image dimensions, Open Graph/Twitter cards).
- Richer human-readable HTML/Markdown report artifact.

### 8.3 Out of scope (for now)
- Tier-3 roadmap rules; additional domain packs beyond landing pages.
- Non-Claude agent adapters; v0/Lovable adapter; MCP server.
- Hosted service / dashboard / auth / billing.

## 9. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | `revivify check <path>` runs all applicable Tier-1 checks against a local build or URL and exits non-zero when the page is not ship-ready | P0 |
| FR-2 | Wrap **axe-core** for a11y checks and **Lighthouse** for performance / SEO / best-practices checks | P0 |
| FR-3 | Compute the trust score (`X/10` + "N of 15 passing"), dropping non-applicable checks from the denominator | P0 |
| FR-4 | Emit **dual-audience output**: structured (agent, stdout) + plain-language (human); progress to stderr | P0 |
| FR-5 | Triage every finding as "we'll fix it" / "just so you know" / "your call," each citing its standard | P0 |
| FR-6 | Capture page **intent** before checking and use it to contextualize findings | P0 |
| FR-7 | `revivify init` drops the rules pack, plan/definition-of-done, and `.revivify.yaml`; installs the Claude Code hook | P0 |
| FR-8 | Claude Code hook auto-runs `check` on "done" and **blocks completion** until the score clears the bar (default **10/10**) | P0 |
| FR-9 | Own-the-fix loop: propose → approve → agent applies → re-check → score updates | P0 |
| FR-10 | `.revivify.yaml` configures rule toggles and the ship-ready threshold (**defaults to 10/10**) | P1 |
| FR-11 | Fast-follow: add the 5 Tier-2 rules and a saved human-readable report artifact | P2 |

## 10. Milestones

| Milestone | Deliverable | Proves |
|---|---|---|
| **M0 — Walking skeleton** | CLI scaffold; `revivify check` runs a handful of static HTML checks end-to-end with dual output + a trust score | The architecture works end-to-end |
| **M1 — Validate pillar** | axe-core + Lighthouse wired; all **15 Tier-1 rules**; full trust-score rollup with applicability | The core value is real and cited |
| **M2 — Init + guardrails + hook** | `revivify init` + rules pack + plan + `.revivify.yaml` + Claude Code hook gating "done" | Proactive steering + deterministic gate |
| **M3 — Check UX** | Intent capture, three-way triage, own-the-fix loop, educational citations, plain-language report | It works *for a non-developer* |
| **M4 — Demo + polish** | Seeded-violation demo site, README walkthrough (GIF), docs | It's credible and demonstrable in an interview |

## 11. Risks & open questions

| Risk / question | Mitigation / current thinking |
|---|---|
| Lighthouse runs are heavy/slow — may discourage running on every "done" | Split fast static checks from full Lighthouse; consider a lighter default and a `--full` mode |
| False positives erode trust fast for a non-dev | Intent capture + conservative "we'll fix it" set; anything debatable → "your call" |
| Auto-fix could regress the page | Re-check after every fix; treat any regression as a hard failure (guardrail metric) |
| How do "your call" judgment items interact with the bar? | **Bar decided: 10/10** = every applicable objective check passing (decision log #9). Remaining nuance: a "your call" item must be explicitly resolved — fixed or knowingly accepted — and an accepted judgment call must not trap the user below 10/10. Finalize the mechanism in M1/M3. |
| Static local build vs. served URL (some CWV need a real server) | Support both; document which checks need a running server |
| "Trust score" must be explainable, not a black box | Every point maps to a named check; always show the breakdown beside the headline |

## 12. Future (beyond this build)

Pluggable **best-practice packs** beyond landing pages (the architecture implies it without building it now); a v0/Lovable adapter and non-Claude agent support via MCP; a richer educational layer. The beachhead stays deliberately narrow until the landing-page pack is genuinely good.
