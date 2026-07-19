# Walkthroughs — verify each milestone yourself

Revivify is built for people who **can't read the code**. So the way we prove each
milestone is built for the same person: every milestone ships a plain-language
walkthrough you can run and check off — no code-reading required.

If *you* (as the end user) can't tell whether a milestone did the right thing, neither
could a real customer. That's a product signal, not just a QA step.

## The milestone walkthrough is the human acceptance gate

Since mid-M4 ([decision #23](../decision-log.md)), the prescriptive CLI UAT is retired. Per module, Claude self-verifies the acceptance scenarios in Gate 0. **The one hands-on step left for Jake is this walkthrough, run once per milestone before the release tag** — and it's meant to be done by *looking*, in the visual cockpit, not by typing CLI scripts. (Run it earlier, on demand, whenever a module lands a new surface you want to see.)

## How to verify any milestone

Lead with the **visual** path; the rest are there if you want them:

1. **Open the cockpit** — `revivify ui ./examples/<name>` (or point it at a real landing page)
   opens a browser and shows the audit run live: gauges fill, checks tick, the trust dial
   lands. This is the primary, visual way to accept a milestone.
2. **Follow the walkthrough guide** — the `mN.md` file below: "open the cockpit here, you
   should *see* this," ending in a plain-language "is this the right thing?" checklist.
3. **Watch the guided tour** — `npm run walkthrough` runs the real tool against example
   pages and narrates what's happening, start to finish.
4. **Poke at the example gallery** — [`examples/`](../../examples/) has pages with known
   results; run `npm run check -- ./examples/<name>` and compare.

When you can tick every box on the guide's checklist, the milestone is accepted.

## Milestones

| Milestone | Guide | What it proves |
|---|---|---|
| **M0 — walking skeleton** | [`m0.md`](m0.md) | `revivify check` runs end-to-end: score + cited findings + plain-language fixes, on source-only checks |
| **M1 — validate pillar** | [`m1.md`](m1.md) | Real engines (axe-core + Lighthouse), 13 cited rules, and actual category scores |
| **M2 — cockpit (visual UI)** | [`m2-cockpit.md`](m2-cockpit.md) | `revivify ui` — watch the audit happen live: gauges fill, checks tick, trust dial lands |
| **M3 — init + hook** | [`m3-init-and-hook.md`](m3-init-and-hook.md) | `revivify init` drops the guardrails up front + installs a Stop hook that gates "done" automatically |
| **M4 — check UX** | [`m4.md`](m4.md) | Intent read back, three-way triage, accept a "your call" **in the cockpit**, and per-finding cite→teach→verify |
| M5 — demo + polish | _planned_ | A shareable, demonstrable product |
