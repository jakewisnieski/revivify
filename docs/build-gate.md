# The build gate — how each module ships

This is the **build-phase companion** to [`github-workflow.md`](github-workflow.md). That doc says every change reaches `main` only through a passing, reviewed PR; this one says *exactly how* each build module runs that gate — the automated pass, the intent it needs, and where the human acceptance happens — so "done" always means the same thing. (Adapted from the same contract used on [Lucid](https://github.com/jakewisnieski/Lucid).)

> **One-line version:** every **module** ships on **Gate 0** — CI green + `/code-review` clean + Claude self-verifies the module's acceptance scenarios in the PR; **Jake's hands-on acceptance is one visual cockpit walkthrough per _milestone_**, run before the release tag (plus an optional on-demand look when a module lands something newly visible). Claude never self-merges.

**Adoption:** M0–M3 shipped through CI + `/code-review` + a milestone UAT. From M4 each module is a self-contained build ticket with an intent seed. The prescriptive **per-module CLI UAT was retired mid-M4** (decision #23): it added friction without adding signal, since Claude already verifies the scenarios in Gate 0 — so human acceptance moved to a single **visual** cockpit walkthrough per milestone.

---

## The gates

**Gate 0 — automated, per module (before merge).** After the work is committed on a feature branch off `main`, Claude runs the automated bar: **CI green** (`npm test` + `npm run typecheck`) **and a clean `/code-review`** self-review. Claude also **self-verifies the module's acceptance scenarios** — running each one and recording the command + observed output in the PR — so the "is this the right thing" evidence is visible without Jake running anything. (The `/no-mistakes` pipeline — intent → review → test → lint → PR → CI — is an optional superset; the CI + `/code-review` bar is the norm, per decision #17's minimum-bar clause.) Gate 0 **never merges.** On green + clean + scenarios-PASS, Claude squash-merges and deletes the branch.

**Milestone acceptance — human, visual (before the release tag).** When a milestone's modules are all merged, Jake does **one hands-on pass in the cockpit** (`revivify ui`) against the example gallery — and a real landing page if he likes — guided by the milestone's **cockpit-first** walkthrough ([`docs/walkthroughs/mN.md`](walkthroughs/)). This is acceptance by *looking*, not by typing CLI scripts. The release tag is the reward for that pass. An **optional on-demand** look can happen earlier when a module lands a new visible surface Jake wants to eyeball before it stacks (e.g. the module that first surfaces a feature in the cockpit).

Order is fixed: **per module → Gate 0 green → merge; per milestone → visual walkthrough → tag.**

---

## Intent is the load-bearing input

A rich **intent** — *what the work set out to accomplish*, in our terms, not a description of the diff — is what lets a review **tell a deliberate decision apart from a mistake**. It must name the goal, the specific decisions and tradeoffs, constraints ruled in/out, and anything in the diff that would surprise a reviewer.

We supply intent with a **"seed now, finalize at gate"** model:

1. **Seed (authored at planning).** Every build ticket carries an **Intent seed** — a charter-level paragraph: the goal, the deliberate choices grounded in our decisions (PRD FRs / `decision-log.md`), the constraints, and what's out of scope. Jake reviews the seeds when the issues are created.
2. **Finalize (at build time).** Right before the gate, Claude composes the actual intent = the **then-current** issue seed **+** the concrete as-built decisions made while coding. Because it's composed at build time, any edit to the issue — or a shift in a grounding decision — flows through automatically; nothing is frozen at planning to go stale.
3. **Use it in review.** The composed intent frames the `/code-review` (or `/no-mistakes` `--intent`) so choices we made on purpose aren't flagged as defects. Claude surfaces the one or two calls it made unilaterally for a quick confirm.

### `ask-user` findings

When a review finding challenges a deliberate intent or changes product behaviour, **only Jake** can rule on it. Claude relays each one **verbatim** (id, file, description) and never fixes, approves, or skips it alone — unless Jake has given standing consent to drive the whole run. Routine auto-fix / no-op findings Claude drives on its own judgment.

---

## What every build ticket contains

Each module is stamped from [`.github/ISSUE_TEMPLATE/build-ticket.md`](../.github/ISSUE_TEMPLATE/build-ticket.md):

- **Outcome** — what the module delivers.
- **Acceptance criteria** — the technical definition of done.
- **Grounded in** — the PRD FRs / decisions it draws on (traceability).
- **Intent seed** — the charter-level intent seed (finalized at the gate).
- **Acceptance scenarios** — runnable scenarios (exact command/click + the explicit PASS condition) that **Claude self-verifies in Gate 0** and records in the PR; non-UI modules use example fixtures.
- **Close-out** — the sequence above.

The per-ticket **acceptance scenarios** are Claude's Gate 0 verification checklist; **Jake's human acceptance is the milestone visual walkthrough** ([`docs/walkthroughs/`](walkthroughs/), cockpit-first), run once before the release tag. (The old prescriptive CLI roll-up in `docs/uat/` is retired — decision #23; `docs/uat/m3-init-and-hook.md` stays as a historical record.)

---

## The per-module loop, end to end

1. **Branch** off `main` (`feat/…` / `fix/…` / `chore/…`), one per issue.
2. **Build + commit** in small steps on the branch.
3. **Finalize intent** = issue seed + as-built decisions; surface any unilateral calls for a quick confirm.
4. **Gate 0:** CI green + `/code-review` clean + **self-verify the ticket's acceptance scenarios**, recording command + observed output in the PR.
5. **Merge:** on Gate 0 green, Claude squash-merges + deletes the branch; the issue closes via the PR's `Closes #<n>`.
6. **Repeat** for the next module.
7. **At the milestone boundary:** Jake runs the **visual cockpit walkthrough** ([`docs/walkthroughs/mN.md`](walkthroughs/)); on a good pass, cut the release tag.
