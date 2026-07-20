# Taste-layer experiments log

Running record of local Qwen3-VL tests for the design/taste layer (tier 3 of the
design-recommendation layer — see
[url-scanner-and-design-layer.md](url-scanner-and-design-layer.md) §5–8).

**Setup:** `qwen3-vl:8b` (Q4_K_M) via Ollama on the local RTX 4080 SUPER (16 GB). Pages
rendered to PNG with headless Chrome (`--headless=new --screenshot --window-size=1280,2400`),
then POSTed to `http://localhost:11434/api/chat` with a design-critique rubric as the system
prompt. Zero API cost — all local. Throughput: ~90–94 tok/s, ~30–43 s per critique (first
call includes model load into VRAM).

Samples: `demo-site/index.html` (the polished "Bloom" page) and
`examples/starter-slop/index.html` (deliberately unstyled: default serif, a placeholder
"Bloom" circle instead of a hero image, a raw blue text link instead of a button).

---

## Experiment 0 — 8B, demo-site, ungrounded (baseline)

**Result:** works end to end; page-specific critique. **Two genuine catches:** the pricing
card's "Start with one plant" CTA contradicts the page's early-access/waitlist framing; the
nav "Get early access" duplicates the hero CTA. Accurate positives (cohesive palette, strong
headline).

**Failure mode — confabulation.** It invented exact pixel values it cannot measure from a
screenshot ("body 14px vs 16px," "add 20px padding") and got a fact **backwards**: it claimed
the hero CTA was "smaller/invisible" vs the secondary link, when the CTA is a filled 18 px
green pill and the secondary is a plain text link. For a non-dev who can't verify, confidently
wrong "make it 16px" advice is worse than none.

## Experiment A — 8B, starter-slop, ungrounded (does the signal discriminate?)

**Result: yes.** On the deliberately bad page it flagged the real, glaring defects —
placeholder circle instead of a product image, unstyled text-link CTA ("style it as a
button"), flat typographic hierarchy, no polish — and returned an appropriately negative
verdict ("Feels like a generic template — lacks visual storytelling"). It did **not**
hallucinate structure that wasn't there; it critiqued what's actually on screen.

**Caveat:** still confabulates numbers ungrounded (e.g. "make headline 24px" — which would
actually be *smaller* than a good hero). Direction right, specifics invented.

**Takeaway:** the taste signal tracks quality — bad page → negative + real defects; good page
→ "professional but slightly generic" + subtle refinements.

## Experiment B — 8B, demo-site, GROUNDED with real measurements (the key test)

Fed the model the page's **real computed values** (pulled from `demo-site/styles.css`): body
17 px / 1.6 / #17281f (~12:1), hero headline ~58 px, primary CTA a filled green 18 px pill at
~7.5:1 (more prominent than the secondary text link), section padding 64 px, all text ≥ AA —
with the instruction: *use only these numbers, do not invent others, trust the facts over
your visual impression.*

**Result — grounding decisively fixed the confabulation:**

- **Invented pixel values: gone.** It cited only the supplied facts and stopped guessing.
- **The false CTA claim reversed.** Where the ungrounded run called the CTA "invisible," the
  grounded run states the primary CTA is "appropriately prominent" and typography/contrast
  are fine — because the facts contradicted its earlier guess.
- **Findings sharpened to the layer that matters** — conversion logic and copy: the multiple
  conflicting CTAs ("Get early access" / "Start with one plant" / "Join the waitlist"), the
  hero line-break, and a sharp copy catch — the hero's "for**give**" vs the section's
  "for**get**" wordplay (flagged as an inconsistency; arguably intentional — see caveat).

**Caveat:** even grounded, it still makes *debatable prescriptions* (e.g. "change forget →
forgive" when the wordplay is intentional; consolidating CTAs may or may not be right). So the
design layer must stay **advisory ("your call"), never a gate.**

## Experiment C — 30B MoE, local (does more scale help?)

**Result: not practical on this hardware — could not complete a single critique.** The
`qwen3-vl:30b` MoE (18.7 GB) loads **70% on GPU / 30% on system RAM** on the 16 GB RTX 4080
SUPER, and the mixture-of-experts routing across the PCIe boundary is brutally slow. It timed
out at **~9.5 min cold**, and again at **~9.7 min warm** even with a downscaled image and
capped output — no critique produced.

**Takeaway:** the **8B (fully on GPU, ~90 tok/s) is the viable local engine** on a 16 GB card.
The "does more scale reduce fabrication / improve aesthetic judgment?" question is real but
belongs on the **Phase-2 hosted/API path** (a bigger model on a proper GPU, or a hosted
inference provider) — not local. Grounding, not raw model size, is the lever we have local
evidence for.

## Experiment D — auto-grounded prototype (no hand-feeding)

Built `prototypes/design-critique.ts`: launches headless Chrome (chrome-launcher), reads
**real computed styles and computes actual WCAG contrast ratios over the DevTools protocol**
(Node's built-in WebSocket — zero new deps), captures a full-page screenshot, injects the
measured facts into the prompt, and calls the 8B.
Run: `node --import tsx prototypes/design-critique.ts demo-site/index.html`.

**Result: the loop works end to end, fully local, ~46 s, $0.** The engine auto-extracted the
real values — body 17 px / 27.2 px line-height / 15.4:1 contrast, hero H1 58 px (clamp
resolved), H2 36 px, primary CTA a filled button at 9.4:1, the full list of 5 CTAs, min page
contrast 9:1 (passes AA) — and the 8B critiqued using only those, with **no fabricated
numbers**. It correctly led with the deterministic finding (five conflicting CTAs, straight
from the extracted list) and the early-access-vs-subscription messaging conflict.

**Key validation — confabulation is now bounded by what we measure.** The one imprecise finding
("CTA is 16 px, smaller than body") traces to the extractor grabbing the *nav* button (the
first `.btn-primary`) instead of the hero CTA — a **deterministic extraction bug we fix in the
engine, not a model hallucination**. The burden moves from the unreliable model to the reliable
engine. Residual invented spacing ("add 10 px") persists only because we don't yet extract
spacing facts — extract them and it tightens too.

## Experiment E — tightened extractor + image-based exemplar grounding

Improved the prototype: hero-CTA selection (`.hero .btn-primary`), spacing extraction (hero-CTA
gap, section-padding range), deduped CTA list, and optional image exemplars (`--exemplar`).

**Extractor tightening works.** On the demo-site the model now reasons over *real* spacing
(14 px hero-CTA gap, 48–64 px section padding) instead of inventing "add 10 px", and the CTA
list is deduped. (The hero CTA genuinely is 16 px — the earlier "18 px" assumption was wrong —
so "16 px vs 17 px body" is now a correctly-grounded observation, not a hallucination.)

**Two honest, cautionary findings:**

1. **Grounding is only as good as the facts you extract — and can *mask* visual defects.**
   Grounded on `starter-slop` (unstyled: a placeholder circle for a hero, a raw text-link CTA,
   default serif, no layout), the critique got *weaker* than the earlier ungrounded run
   (Experiment A): the extracted facts (contrast 21:1, sizes fine — all technically healthy on a
   visually-broken page) plus a strong "trust the facts, don't invent numbers" instruction
   nudged the model toward copy nits and away from the glaring visual mess. Lesson: to judge
   *visual* quality, either extract facts that capture visual failures (placeholder imagery, no
   real layout, default fonts) **or** explicitly license the model to judge the aesthetic
   dimensions facts can't cover. Grounding must fix confabulation without suppressing visual
   judgment.
2. **The 8B confuses exemplar vs. target with raw image grounding.** Given the slop page as
   target and the demo-site as a "good" exemplar, the 8B critiqued the *exemplar* (it discussed
   the demo-site's two CTAs, $29 card, feature columns) — the more visually salient image —
   despite explicit "the LAST image is the page under review" instructions. **This validates the
   agreed direction: mine exemplars into measurable text patterns, don't show raw exemplar images
   to a small vision model.**

---

## Conclusions (for the wayfinder)

1. **Grounding with deterministic measurements is the fix, and it's buildable.** The 8B
   hallucinates because we made it guess. Feed it the real numbers and the fabrication
   disappears and the critique gets *better*. **Revivify already computes exactly these facts**
   (font sizes, contrast ratios, spacing from the DOM/CSS) — so the production design layer is
   "deterministic engine measures → vision model reasons over the facts." This is the concrete
   synthesis of the exemplar/measurable-patterns idea and the vision layer.
2. **The design layer stays advisory, never a gate.** Confabulation ungrounded + debatable
   prescriptions grounded both confirm the floor→ceiling safety boundary: design suggestions
   live in "your call," never touch the deterministic trust score.
3. **The signal tracks quality** — it discriminates a polished page from an unstyled one.
4. **Cost/perf: free and fast locally** — ~30 s, ~90 tok/s, $0 on the 8B. Good enough to
   prototype the whole grounded-critique flow before any hosted-cost decision.
5. **Local model ceiling on 16 GB VRAM = the 8B.** The 30B MoE spills ~30% to system RAM and
   is too slow to use (Experiment C); larger-model quality comparisons belong on the Phase-2
   hosted/API path, not the local box.
6. **Facts must cover the failure mode; exemplars should be text, not images (Experiment E).**
   Grounding can *mask* visual defects when the extracted facts all look healthy — so extract
   visual-failure facts and explicitly license aesthetic judgment. And raw image exemplars
   confuse the 8B (it critiques the exemplar, not the target) — mine exemplars into measurable
   text patterns, consistent with the §6 design direction.

## Open / next

- ✅ **Grounded prototype (done — Experiment D):** `prototypes/design-critique.ts` auto-extracts
  measurements and injects them; no hand-feeding.
- **Tighten the extractor (all deterministic):** pick the hero CTA (largest `.btn-primary` /
  the one inside `.hero`) not the first; extract spacing/padding; dedupe the CTA list.
- **Contrast run:** point the prototype at `examples/starter-slop/index.html` — does the
  grounded loop still cleanly separate a bad page from a good one?
- **Exemplar grounding:** add a few retrieved high-performer references alongside the
  screenshot and see if critique quality/specificity rises further.
