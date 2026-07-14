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

### 10. Rule set reconciled to what the engines can actually check (M1)
Wiring the real engines (M1) refined the aspirational 15-rule MVP: **13 rules map cleanly to reliable Lighthouse/axe audits and are live.** Two do not have a trustworthy automatic check and are **deferred rather than faked** — **non-text/UI contrast (WCAG 1.4.11)** (axe doesn't detect it reliably) and **broken outbound links / 404s** (no solid Lighthouse audit for a page's own links); both need a purpose-built check in a later milestone. The trust score's denominator is therefore the count of *applicable* rules ("N of M passing"), not a hardcoded 15. Honesty about what's actually verified matters more than hitting a round number — a non-developer trusts the gate only if every green check is real.

### 11. Add a visual cockpit UI — revisiting "CLI + hook only" (decision #4)
Decision #4 chose an AXI CLI + Claude Code hook and put a dashboard out of scope. Dogfooding M1 exposed the gap: the audit is **invisible** to the person it's built for. Headless Chrome shows nothing; the CLI prints a *conclusion* (a number) but not the *process*, so a non-developer is asked to take the score on faith — the exact "trust us" posture the product exists to replace. So we added **`revivify ui`**, a local web-app cockpit that reuses the engine unchanged and **streams the audit live** (Chrome launching, category gauges filling, rules ticking off, the trust dial). It is **additive**: the engine, CLI, and (coming) hook remain the machine-facing core; the UI is the human-facing trust-and-visibility layer, and it must stay the *agentic* check→fix cockpit (not a passive scan-after dashboard, which is the Siteimprove space we differentiate from). Brand note: the UI uses **violet** for brand/action elements and reserves **green** strictly for pass/go signals, so it doesn't read as a clone of green-forward incumbents.

### 12. HTTPS isn't verifiable on a local page — report it not-applicable
Revivify serves the page from `http://127.0.0.1` to audit it, and browsers treat localhost as a secure context, so Lighthouse's HTTPS audit *always* passes locally regardless of the real deployment. A green "Served securely over HTTPS" would be false reassurance — the thing we refuse to do. So HTTPS is marked **not-applicable for local checks** (dropped from the denominator, with a plain note that it's verified once deployed). It becomes a real check when Revivify audits a live URL — a natural future enhancement.
