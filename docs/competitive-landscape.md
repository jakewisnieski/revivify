# Competitive landscape

*Research snapshot, July 2026. Primary sources: vendor product/pricing pages and the W3C / Google specs cited below.*

## The gap Revivify fills

**AI-code review tools are all built for developers.** Greptile, CodeRabbit, Qodo, SonarQube, Codacy, DeepSource, and the built-in reviewers in Cursor, GitHub Copilot, and Claude Code all output verdicts that assume an engineer who can read a diff, and price per developer seat. None serve a non-developer who can't evaluate the output. (SonarQube markets a "verify AI code / trust" framing and Codacy uses the word "guardrails" — but both mean *for developers, in-IDE.*) The four closest incumbents — Greptile, CodeRabbit, Qodo, Graphite (Diamond) — are dissected in [AI code-review incumbents — deep dive](#ai-code-review-incumbents--deep-dive) below.

**Landing-page quality tools that *do* target non-developers all scan after the fact.** Siteimprove (unified accessibility + SEO + performance, marketer-facing, moving toward agentic features) is the closest neighbor; accessiBe's accessScan and various "AI website checkers" are URL-in / report-out. None of them *steer the AI coding agent while it builds.* The developer-side validators (axe, Lighthouse, pa11y, eslint-plugin-jsx-a11y, Unlighthouse) are engineering/QA tools.

## Revivify's position

Differentiated on the **intersection**, not any single axis:

1. **For non-developers** — the audience every AI-code checker ignores.
2. **Cited standards** — authority from published rules, not model opinion.
3. **Proactive, up-front agent-steering** — the genuinely uncrowded space; everyone else reviews or scans after code exists.

The sharpest, most defensible wedge is **#3: steering a non-developer's AI coding agent up front.** The competitor to respect is Siteimprove (owns non-dev + a11y/SEO/perf scope), which is exactly why Revivify does *not* position as another scan-after checker.

## Standards Revivify enforces

- **Accessibility:** WCAG 2.2, Level AA (W3C Recommendation; ISO/IEC 40500).
- **Performance:** Core Web Vitals — LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 (at the 75th percentile).
- **SEO:** Google Search Essentials.

## AI code-review incumbents — deep dive

*The "for developers" foil. All four review a developer's diff inside the PR, after code exists — the four assumptions Revivify rejects (see [what this means](#what-this-means-for-revivify)). Detail current as of 2026-07-14; usage/benchmark figures come from vendor pages and third-party 2026 reviews, so treat catch-rate numbers as directional.*

### Greptile — the depth-of-context leader

**One-liner:** an autonomous reviewer that reads *every* PR with full-repository context — "merge 4× faster, catch 3× more bugs."

- **Semantic graph of the whole repo (the moat).** On connect it scans every file and builds function call graphs + cross-file dependency chains into a continuously updated semantic graph. Each PR is judged against that graph, not just the diff — so it catches the diff-only blind spot: change a signature in file A, forget callers in B/C/D.
- **"Swarm Agents" (v4, early 2026):** parallel specialized agents — security, performance, logic correctness, style — merged into one review.
- **A review contains:** PR summary, line-level inline comments with suggested fixes, auto-generated **sequence diagrams / flowcharts**, a **confidence score (0–5)** for merge safety, a **"Fix All"** batch option, and **TREX** auto-generated unit tests. ~3-minute reviews.
- **Learns your standards:** reads the team's existing PR comments to infer conventions and tunes from 👍/👎; after ~2–3 weeks it stops commenting on things you don't care about. Rules codified in **`.greptile.yaml`** (custom rules, ignore dirs, strictness, file-pattern targeting).
- **Integration:** GitHub (Cloud/Enterprise) + GitLab (Cloud/Self-Managed); **no Bitbucket/Azure DevOps.** One-click **"Fix with your Agent"** → Claude Code, Codex, Cursor, Devin, Conductor. Deploys cloud (SOC 2 Type II), Docker Compose, K8s/Helm, air-gapped.
- **Sets it apart:** highest raw catch rate in the category — independent 50-PR benchmark ~**82% catch vs CodeRabbit ~44%** — at the cost of noise (~11 false positives/run vs ~2). Best on large interconnected monorepos.
- **Watch:** in March 2026 it shifted from flat **$30/dev/mo** to **usage-based ($1/review after 50)**, drawing backlash — a live example of the fragility of per-seat/per-review dev-tool monetization Revivify isn't bound to.

### CodeRabbit — the low-noise, broad-platform default

- Reviews every PR line-by-line across the **widest platform set** (GitHub, GitLab, Bitbucket, Azure DevOps). Change summaries with **architecture diagrams**, 1-click-commit fix suggestions, and a conversational interface (reply to ask for reasoning).
- **Bundles real static analyzers** — ESLint, Biome, Ruff, Pylint, golangci-lint, Clippy, RuboCop, Brakeman, **TruffleHog** (secrets), **Trivy** (IaC). Structurally the closest parallel to Revivify wrapping axe-core/Lighthouse — *except every engine targets source code an engineer reads, not user-facing quality.*
- Reputation is **low false-positive rate (~2/run)** over max catch (~44%). Learns from dismissals + YAML custom guidelines. 2026 **Issue Planner** turns a Jira/Linear/GitHub issue into a coding plan (still developer-facing).
- **Pricing:** genuine free tier (rate-limited) / Pro **$24**/dev/mo / Pro Plus **$48** (test gen, custom pre-merge checks); only PR-authoring devs count as seats.

### Qodo (Qodo Merge + Qodo Gen) — whole-SDLC, open-source core

- Built on the open-source **PR-Agent** engine. **Qodo 2.0 (Feb 2026)** multi-agent review (bug / security / quality / **test-coverage** agents) posted the **highest F1 (60.1%)** of eight tools tested — between CodeRabbit's low-noise and Greptile's high-catch profiles.
- **Differentiator = testing:** finds an untested path and **generates the tests** (**Qodo Cover**, autonomous regression-testing), where CodeRabbit only describes what to test.
- Spans **IDE → PR → CI** (Qodo Gen extension + Qodo Merge bot + terminal + CI triggers). GitHub, GitLab, Bitbucket.
- **Pricing:** free Developer tier / Teams **$30**/user / Enterprise from **$45** (SSO, on-prem/VPC); or self-host PR-Agent free with your own LLM keys.

### Graphite (Diamond) — review welded to a stacked-PR workflow

- **Diamond** is one feature of a stacked-PR + merge-queue productivity platform (Sequoia + Anthropic-backed, ~$80M+ raised). Reviews are **calibrated for fewer false positives** ("smarter, targeted feedback").
- Real context comes from the **stacked-PR workflow:** small dependent PRs, auto-rebased as earlier ones merge, reviewed in coherent increments; a **stack-aware merge queue** batches and tests PRs in parallel. Consolidating Diamond + Chat into "**Graphite Agent**."
- **Pricing:** Diamond free ≤100 PRs/mo (buyable standalone); Team **$40**/dev/mo. GitHub-centric.

### Side-by-side

| | Greptile | CodeRabbit | Qodo | Graphite Diamond |
|---|---|---|---|---|
| **Core bet** | Full-repo semantic graph | Low-noise, broad-platform | Whole-SDLC + test generation | Review inside a velocity platform |
| **Benchmark signal** | ~82% catch / ~11 FP | ~44% catch / ~2 FP | 60.1% F1 (highest) | Tuned for low FP |
| **Standout** | Codebase graph, sequence diagrams, TREX | Lowest noise; Issue Planner; free tier | Qodo Cover test gen; open-source/self-host | Stacked PRs + merge queue |
| **Platforms** | GitHub, GitLab | GitHub, GitLab, Bitbucket, ADO | GitHub, GitLab, Bitbucket | GitHub-centric |
| **Price** | ~$30 → usage-based | Free / $24 / $48 | Free / $30 / $45+ | Diamond free ≤100 PRs / $40 |
| **Audience** | Developers, in-PR | Developers, in-PR | Developers, IDE→PR→CI | Developers, in-PR |

### What this means for Revivify

All four converge on the same four assumptions Revivify rejects — which validates the wedge:

1. **The reader is an engineer.** Every output (inline diff comments, sequence diagrams, F1 scores, confidence 0–5) assumes someone who reads code. Revivify's plain-language-to-human / structured-to-agent split has no equivalent here.
2. **They act on a diff, after code exists.** Even CodeRabbit's Issue Planner and Qodo's IDE gen stay developer-facing. None **steer a non-dev's agent before generation** — position #3 is still empty.
3. **Authority is model opinion, feedback-tuned.** Their "learning" reduces noise but the verdict is still the model's judgment. Revivify's authority-from-cited-standards is a different trust basis — and **not one of these four checks accessibility, Core Web Vitals, or SEO.** They review source code, not whether the page *lands*.
4. **Per-seat / per-review dev monetization** (Greptile's pricing backlash shows how fragile that is).

The one incumbent that crosses into Revivify's territory is **not** in this set — it's **Siteimprove** (non-dev, a11y/SEO/perf), named above as the competitor to respect. The Greptile-class tools are the "for developers" foil; Siteimprove is the "after the fact" foil; Revivify sits in the gap between them.

### Sources (2026-07-14)

Greptile: [greptile.com](https://www.greptile.com/), [docs](https://www.greptile.com/docs/introduction), [agent](https://www.greptile.com/agent), [WeavAI review](https://weavai.app/blog/en/2026/05/12/greptile-2026-review-ai-code-review-pricing-debate/) · CodeRabbit: [coderabbit.ai](https://www.coderabbit.ai/), [pricing](https://www.coderabbit.ai/pricing) · Qodo: [Qodo Merge review (DEV)](https://dev.to/rahulxsingh/qodo-merge-review-is-ai-pr-review-worth-it-46j1), [docs](https://docs.qodo.ai/code-review) · Graphite: [graphite.com](https://graphite.com/), [Series B + Diamond launch](https://graphite.com/blog/series-b-diamond-launch) · Comparisons: [wetheflywheel](https://wetheflywheel.com/en/guides/best-ai-code-review-tools-2026/), [baeseokjae](https://baeseokjae.github.io/posts/ai-code-review-tools-2026/)
