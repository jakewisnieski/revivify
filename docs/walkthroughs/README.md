# Walkthroughs — verify each milestone yourself

Revivify is built for people who **can't read the code**. So the way we prove each
milestone is built for the same person: every milestone ships a plain-language
walkthrough you can run and check off — no code-reading required.

If *you* (as the end user) can't tell whether a milestone did the right thing, neither
could a real customer. That's a product signal, not just a QA step.

## How to verify any milestone

Each milestone gives you four ways in — use whichever you like:

1. **Watch the guided tour** — `npm run walkthrough` runs the real tool against example
   pages and narrates what's happening, start to finish.
2. **Follow the walkthrough guide** — the `mN.md` file below: "here's what we built, run
   this, here's what you should see."
3. **Poke at the example gallery** — [`examples/`](../../examples/) has pages with known
   results; run `npm run check -- ./examples/<name>` and compare.
4. **Sign off the acceptance checklist** — the plain-language "is this the right thing?"
   list at the bottom of each guide. When you can tick every box, the milestone is done.

## Milestones

| Milestone | Guide | What it proves |
|---|---|---|
| **M0 — walking skeleton** | [`m0.md`](m0.md) | `revivify check` runs end-to-end: score + cited findings + plain-language fixes, on source-only checks |
| M1 — validate pillar | _next_ | Real accessibility & performance engines (axe-core + Lighthouse) and the full 15-rule set |
| M2 — init + hook | _planned_ | Guardrails dropped up front + the check gating "done" automatically |
| M3 — check UX | _planned_ | Intent capture, three-way triage, the own-the-fix loop |
| M4 — demo + polish | _planned_ | A shareable, demonstrable product |
