# Decision log

The product and architecture decisions behind Revivify, and why. Each was made deliberately; this is the reasoning trail.

### 1. Target user: non-developers using AI coding agents
People who build with Claude Code / Cursor but can't read the code to judge it. This is the user with the sharpest, least-served version of the "is my AI output any good?" problem — and one the author lives personally.

### 2. Beachhead domain: landing / marketing pages
The single most common thing non-developers generate with AI, with ironclad, citable standards (WCAG, Lighthouse, Search Essentials) and visible, demonstrable violations. Go deep on one domain first; generality comes later via pluggable best-practice packs (the architecture implies it without having to build it).

### 3. Proactive steering over after-the-fact scanning
The competitive scan showed every non-dev quality tool scans *after* a site is built. Steering the agent *during* generation is the uncrowded, defensible space — and published evidence that up-front rules beat no-rules by ~7–14 points supports it.

### 4. AXI-designed CLI + Claude Code hook — not an MCP server
[AXI](https://axi.md/) (design principles for agent-friendly CLIs) benchmarks ~2.3× fewer input tokens and lower cost than MCP for the same job, with no server to run or configure. A Claude Code hook makes the check fire deterministically and gate "done." MCP is deferred to a later adapter for non-Claude agents.

### 5. Deterministic validators for citable authority
Checks wrap **axe-core** and **Lighthouse** — real, industry-standard engines — so every verdict maps to a published rule, not an LLM's opinion. That is what lets a non-developer *trust* the result.

### 6. Check UX designed for people who can't read code
Borrowed and re-aimed from the `no-mistakes` gate: capture the user's **intent** first; triage every finding as **"we'll fix it" / "just so you know" / "your call"**; drive an **own-the-fix loop** (the agent applies fixes, Revivify re-checks); speak **plain language to the human and structured data to the agent.**

### 7. Trust score: 1–10, composed from real sub-scores
Headline `X / 10` shown beside a concrete **"N of 15 checks passing,"** rolled up from Lighthouse's category scores and axe results. Every point maps to a real, explainable increment; non-applicable checks drop out so a simple page isn't penalized.

### 8. Rule prioritization: 15 MVP / 5 fast-follow / 11 roadmap
Ranked by (user impact) × (frequency in AI output) × (deterministically checkable) × (a non-dev can grasp it + the agent can fix it). The MVP deliberately includes every catastrophic-when-present check (e.g. accidental `noindex`, which makes a page invisible to Google). Full tiers in [`rule-catalog.md`](rule-catalog.md).

### 9. Ship-ready bar = a perfect 10/10
The gate clears only at **10/10** — every applicable check passing. A non-developer can't judge which remaining gap is the one that breaks their site, so any bar short of perfect leaves them wondering whether the leftover is the thing that matters. A perfect bar is the only threshold that lets them trust *nothing broken was left behind* — which is the whole promise. Two safeguards keep it fair rather than punishing: **non-applicable checks drop from the denominator** (a simple page isn't held to rules it can't violate), and **"your call" judgment items must be explicitly resolved** — fixed or knowingly accepted — so a deliberate brand choice doesn't trap the page below the bar. The threshold is configurable in `.revivify.yaml` but ships at 10/10.
