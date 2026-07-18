# User Acceptance Testing (UAT) — the milestone sign-off gate

This is the **hand-held acceptance test** Jake runs at the end of every milestone. It's the human half of the quality gate: automated checks (CI) prove the code *works*; UAT proves the milestone is *the right thing*, validated by the person it's for — no code-reading required.

**Two levels, one habit.** From M4 on, each **build ticket** carries its own **Acceptance walkthrough** — that's **Gate 1** for that one module ([`build-gate.md`](../build-gate.md)). The files here are the **milestone roll-up**: they sequence a milestone's per-ticket walkthroughs into one signed sheet, run end-to-end before we tag the release. (M3's roll-up, [`m3-init-and-hook.md`](m3-init-and-hook.md), was written before the per-ticket model and stands as the M3 record.)

## Walkthrough vs. UAT — what's the difference?

We have two milestone artifacts and they do different jobs:

| | [`docs/walkthroughs/`](../walkthroughs/) | `docs/uat/` (here) |
|---|---|---|
| Voice | "Here's what we built — try it." | "Do exactly this. Did you see exactly that? ✅/❌" |
| Who drives | You, self-serve, whenever | **Claude drives you**, one step at a time |
| Shape | Narrative tour + a checklist | Prescriptive scenarios, each tied to an acceptance criterion, ending in a signed pass/fail table |
| Purpose | Understand & demo the milestone | **Formally accept the milestone** before we tag the release |

The walkthrough is the tour; the UAT is the **inspection with a sign-off sheet**.

## How to run a UAT session

Just tell Claude:

> **"Walk me through the M3 UAT."**

Claude then drives the matching `docs/uat/mN-*.md` script **interactively**:

1. Claude gives you a **one-time setup** block to paste.
2. Claude presents **one scenario at a time** — the exact command to run and the exact output you should see.
3. **You run it and tell Claude what you saw** (paste it, or just say "matches" / "got something different").
4. Claude marks that acceptance criterion ✅ or ❌ and moves to the next.
5. At the end, Claude fills in the **sign-off table** — every acceptance criterion, pass or fail.
6. **All green → the milestone is accepted**, and only then do we cut the release tag.

You never have to read code, guess, or run everything at once. If any step fails, Claude stops, diagnoses, and we fix it before the milestone counts as done.

## Where the UAT sits in the SDLC loop

It's the concrete form of **gate 3** ("Jake's acceptance test") in [`docs/github-workflow.md`](../github-workflow.md#4-open-a-pull-request-test--review-gate):

```
issue → branch → PR → [CI green + Claude review + UAT sign-off] → merge → tag release
```

A milestone isn't "done" until its UAT table is all ✅. The release tag is the reward for a signed sheet.

> **Shell note:** Jake runs on **Windows PowerShell**, so the scripts here are **PowerShell-first**. They use a **fixed demo folder** (not `mktemp`) so each step is self-contained, and `Get-Content … -Encoding utf8` so cited standards render (PowerShell 5.1 defaults to ANSI and mangles em-dashes — cosmetic, the files are valid UTF-8).

## Files

- [`TEMPLATE.md`](TEMPLATE.md) — the reusable format; copy it to start a new milestone's roll-up.
- `mN-*.md` — one roll-up per milestone (e.g. [`m3-init-and-hook.md`](m3-init-and-hook.md)).
