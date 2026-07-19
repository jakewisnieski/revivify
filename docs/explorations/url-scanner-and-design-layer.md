# Exploration — URL scanner + design-recommendation layer

> **Status: exploration / pre-wayfinder.** These are captured recommendations from a
> design conversation, not committed decisions. Nothing here is built. Before any of it
> becomes work, it goes through a **wayfinder pass** → a scoped milestone (epic + tickets
> + PRD update + decision-log entries) → Jake's scope sign-off → build. This doc exists so
> that pass starts from a faithful record instead of re-deriving the thinking.

---

## 1. The idea, and the decisions already made

**The seed:** make it obvious that a user can **drop in their landing-page URL** and run
Revivify's checks — ideally a web app where you paste a URL and get a concise evaluation.

Decisions Jake made during the conversation:

- **Where it runs: both, phased.** Phase 1 wires URL support into the existing local
  cockpit; Phase 2 stands up a hosted public page. (Not one or the other.)
- **Primary job: a real self-serve product** — people run it on their own live sites
  repeatedly, not just a demo. This raises the bar (reliability, abuse, cost) and is what
  makes it milestone-scale rather than a polish item.

## 2. Current-state grounding (what already exists)

- **The cockpit is already a web app.** `revivify ui` starts an HTTP server, serves a
  frontend from `web/`, streams the audit live over SSE, and exposes `/api/check`,
  `/api/accept`, `/api/fix`. The "drop something in, watch it evaluate" surface exists.
- **But everything is local-path + localhost.** `check`, `gate`, `ui` all take a filesystem
  path (`.html` file or a folder with `index.html`). `loadPage` reads from disk;
  `runLighthouse` serves a local dir over loopback so Lighthouse can load it.
- **FR-1 already promises "a local build _or URL_"** — so URL input is a *stated,
  unwired requirement*, not new scope. Phase 1 partly **finishes FR-1**.

## 3. The strategic frame (the honest caution)

A hosted "paste your URL, get a score" scan is structurally the **after-the-fact scanner**
model the PRD deliberately positions *against* (§1, §3: competitors scan after the fact;
Revivify *steers the agent up front* — steering is the wedge). A hosted URL scan can't use
that wedge (no repo, no agent, no `.revivify.yaml`).

Resolution: **treat the URL scanner as the front door, not the identity.** It's the best
possible top-of-funnel / "understand it in 10 seconds" surface — paste a URL, watch the
trust dial fill, *get it* — that then hands off to the real product (`init` → steer → gate).
The single most important design question is therefore **the scan→steer bridge**: "paste URL
→ score → _and then what_." If that bridge is an afterthought, we've built a commodity
scanner. If it's the point, we've built the best on-ramp to the steering product.

## 4. Phasing

- **Phase 1 — URL support in the engine + local cockpit.** URL branch in the Lighthouse
  wrapper (point Lighthouse straight at the URL — simpler than today's loopback-serve) and
  in `loadPage` (`fetch` + parse). URL input in the cockpit. Fixes / intent / accept go
  **read-only** on the URL path (can't write to someone's live site; no local project dir).
  Pure code, self-verifiable, finishes FR-1, no recurring cost (runs locally).
- **Phase 2 — hosted self-serve.** Deployment on Chrome-capable infra, the security
  guardrails (own conversation — see §9), rate-limit/queue/cost controls, an in-session
  (not YAML) model for fixes/intent, and — the load-bearing part — the **scan→steer bridge
  UX**. This is a real scope change to the §8.3 "not a hosted service" non-goal and must be
  a logged decision.

## 5. The design-recommendation future

Jake's real north star: after a page is *functioning and standards-compliant*, move Revivify
toward **design recommendations**. This fits the arc **functional floor → design ceiling.**

- **The gate (floor):** deterministic, cited, pass/fail — "nothing is broken." Unchanged;
  still certifies ship-ready.
- **The design layer (ceiling):** advisory, **never contaminates the trust score** — "now
  make it good." A separate panel of prioritized suggestions, not a competing grade.

The discipline that keeps this from betraying Principle #1 ("authority from standards, not
vibes"): **tier design recommendations by how citable they are.**

1. **Objective design (deterministic).** Type scale, line length (45–75ch), line-height,
   min font sizes, spacing rhythm, tap targets, breakpoints — measurable, standard-backed.
2. **Heuristic design (cited to research).** NN/g heuristics, Baymard findings, visual
   hierarchy, above-the-fold CTA — cite the named principle, same as citing a WCAG SC.
3. **Taste (subjective).** Lives only in the existing "your call" lane. Never a gate,
   never a number.

**Engine for the design layer:** a vision LLM over a **screenshot** of the rendered page —
and we *already* drive headless Chrome for Lighthouse, so screenshotting is nearly free. The
vision model is to the design layer what axe/Lighthouse is to the standards layer.

**Why it's strategically additive, not a detour:** design recommendations are the richest
possible scan→steer hook ("here are 6 design improvements — want Revivify to steer your
agent through them?"), and a *grounded, cited AI design partner for non-devs, wired into
agent steering* is a combination no competitor has.

## 6. The taste layer — exemplar corpus, mined into measurable patterns

Agreed direction: build a repository of high-performing pages and **mine it into measurable
patterns** (tier-1/2-style checks: "high-performing pages in your category cluster around a
1.25–1.33 type scale; yours is 1.1, which reads flat"). Near-term, also use it for
**grounding** (feed the most relevant exemplars to the vision model as concrete references,
so critique is "compared to these 3 current high-performers, yours does X" rather than
free-floating aesthetic assertion).

- **Avoid the similarity-distance trap:** "how close is this page to the good cluster" is a
  misleading signal — and *backwards* for brand-forward pages, where novelty is the point.
- **Curation (Jake's sketch):** ~20 market/industry domains that common businesses operate
  in × the top ~10–15 sites in each by traffic (or sales). The selection criterion is itself
  a taste judgment to defend, and is the hard part.
- **Refresh cadence: monthly** (design trends move over months, not days — a 2-day refresh
  was over-engineered).
- **Brand-forward taste judgment: deferred** — Jake set this aside; we can revisit curation.
- **Key property:** the corpus *grounds* the model, it doesn't *replace* it — you still need
  a vision model to critique against the exemplars. Good grounding is exactly what lets a
  cheaper/smaller model punch above its weight (see §8).

## 7. Cost model

Only the **design/taste layer** is an LLM piece. The standards gate (axe + Lighthouse) is a
deterministic engine — no model, no cost — and stays that way.

Three buckets for the hosted product:

| Bucket | Recurring? | Anthropic cost? |
|---|---|---|
| Standards scan (axe + Lighthouse) | compute only | no — deterministic |
| Hosting / compute (Chrome + Lighthouse per scan) | yes, baseline + scales | no |
| Design critique (vision LLM per scan) | yes, per-scan | **yes — API key, per-token** |

- **Claude Code Max ≠ a hosted-service backend.** Max entitles *interactive* Claude Code /
  Claude.ai use by the subscribed human. A public service calling Claude on behalf of end
  users is **programmatic API traffic** — needs an Anthropic API key, billed per token,
  separate from Max. So the hosted design layer introduces a new usage-based cost.
- **Per-scan design-critique cost** (screenshot + rubric in, structured critique out):
  Opus 4.8 ≈ $0.05–0.15; Sonnet 4.6 ≈ $0.03–0.08; Haiku 4.5 ≈ $0.01–0.03. Prompt-caching the
  rubric (~0.1× reads) drops most of the fixed input cost. Model choice is a real
  cost/quality decision for Jake to own.

## 8. Model choice for the design/taste engine

**Open-model economics:** local (Phase 1) = effectively free (your hardware). Hosted (Phase
2) "no API bill" ≠ free — it's a standing cloud-GPU cost or a hosted per-token provider,
possibly *higher* than the managed API at low volume. Self-hosting wins only at high steady
volume.

- **Kimi K3** is a ~1T-param MoE — **not** runnable in Ollama on a normal box; you'd reach it
  via its API (per-token), so it doesn't deliver the "local-free" outcome. The real
  local-free path is a small vision-LLM.
- **Recommended engine: Qwen3-VL** over Llama 3.2 Vision 11B:
  - Resolution: **~4096×4096 dynamic** vs Llama's **1120×1120** cap — decisive for reading a
    tall, text-dense landing page.
  - License: **Apache 2.0** vs Llama Community License (700M-MAU cap + **EU restriction** on
    the vision models — a landmine for a public hosted product with EU users).
  - Size ladder (2B/4B/8B/30B/32B) vs Llama's dead end above 11B (next step is 90B/64 GB).
  - Reports **ScreenSpot** (UI-grounding), closest to our task.

**Pinned to Jake's hardware** (RTX 4080 SUPER 16 GB, Ryzen 7 7800X3D, 64 GB RAM, Win 11):

- **Daily driver: `qwen3-vl:8b` @ Q4_K_M (~12 GB)** — leave the ~4 GB headroom for vision
  tokens from a big screenshot + exemplar images.
- **Fast iteration: `qwen3-vl:4b` (~6 GB).**
- **Reasoning experiment: `qwen3-vl:30b`** — it's an MoE (~3B active), and his 64 GB RAM +
  fast CPU make it reachable via partial offload (unusual on a 16 GB card). Build/tune on 8B,
  then benchmark 30B to see if the reasoning bump is worth it *for aesthetic critique*
  specifically (the open question — perception is fine at 8B; nuanced taste is where more
  params might pay off).
- **Phase-2 upgrade lane:** the 4080 SUPER is Ada (FP8-capable) → vLLM + FP8 gives ~FP16
  quality at ~half the memory if we outgrow Ollama.

Local hosting walkthrough: **[running-qwen3-vl-locally.md](running-qwen3-vl-locally.md)**.

## 9. Deferred to their own conversations

- **Security (multiple levels).** SSRF is only the first — a service that fetches arbitrary
  user URLs needs URL validation/allowlisting, private-IP/metadata-endpoint blocking,
  DNS-rebinding defense, rate limiting, per-scan timeouts, plus more layers. Own conversation.
- **Legal / ToS of the exemplar corpus.** Crawling + storing (and especially *displaying*)
  screenshots of others' live sites has copyright/ToS implications. Own conversation.

## 10. Process / next step

This is **milestone-scale** and doesn't fit M0–M5 (all shipped). Next step is a **wayfinder
pass** that turns this into a scoped milestone: epic + build tickets with acceptance
criteria, a PRD update (this changes the §8.3 non-goal — a deliberate, logged decision), and
decision-log entries for (a) the hosted-scanner-as-front-door strategic call and (b) the
design-ceiling-layer direction. Scope sign-off happens there, before any building. Jake's
autonomy preference applies once scope is approved; a release tag always needs his explicit
go-ahead.
