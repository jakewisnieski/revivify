# The build gate — how each module ships

This is the **build-phase companion** to [`github-workflow.md`](github-workflow.md). That doc says every change reaches `main` only through a passing, reviewed PR; this one says *exactly how* each build module runs that gate — the automated pass, the intent it needs, and the human acceptance step — so "done" always means the same thing. (Adapted from the same contract used on [Lucid](https://github.com/jakewisnieski/Lucid).)

> **One-line version:** every module closes out through **two gates** — an automated `/no-mistakes` pass (Gate 0) and Jake's hands-on acceptance walkthrough (Gate 1) — and Claude never self-merges.

**Adoption:** M0–M3 shipped through CI + `/code-review` + a milestone UAT directly. The two-gate model with intent seeds is adopted **from M4 onward**; it formalises what we were already doing by hand.

---

## The two gates

**Gate 0 — automated (`/no-mistakes`).** After the work is committed on a feature branch off `main`, Claude runs the `no-mistakes` pipeline: **intent → rebase → review → test → document → lint → push → PR → CI**. It validates committed history (not the working tree), opens the PR, and returns `checks-passed` when CI is green — **it never merges**. This subsumes the CI checks + the `/code-review` self-review + the PR open from [`github-workflow.md` §4](github-workflow.md#4-open-a-pull-request-test--review-gate), plus tests, lint, and docs. (Minimum bar if `/no-mistakes` isn't run: CI green **and** a `/code-review` pass.)

**Gate 1 — human acceptance (Jake).** Once Gate 0 is green, Jake runs the module's **acceptance walkthrough** — the runnable scenarios carried in the issue — as the end user. On all-PASS he approves; Claude then **squash-merges and deletes the branch**. This is Jake's end-user acceptance from §4, made concrete per module.

Neither gate is skippable, and the order is fixed: **Gate 0 green → Gate 1 pass → merge.**

---

## Intent is the load-bearing input

`/no-mistakes` **requires** an `--intent`: *what the work set out to accomplish*, in our terms — not a description of the diff. The review step uses it to **tell a deliberate decision apart from a mistake**, so a thin one-line intent makes it flag choices we made on purpose. It must be rich: the goal, the specific decisions and tradeoffs, constraints ruled in/out, and anything in the diff that would surprise a reviewer.

We supply intent with a **"seed now, finalize at gate"** model:

1. **Seed (authored at planning).** Every build ticket carries an **Intent seed** — a charter-level paragraph: the goal, the deliberate choices grounded in our decisions (PRD FRs / `decision-log.md`), the constraints, and what's out of scope. Jake reviews the seeds when the issues are created.
2. **Finalize (at build time).** Right before the gate, Claude composes the actual `--intent` = the **then-current** issue seed **+** the concrete as-built decisions made while coding. Because it's composed at build time, any edit to the issue — or a shift in a grounding decision — flows through automatically; nothing is frozen at planning to go stale.
3. **Quick-confirm.** Claude shows Jake the composed intent for a ~10-second confirm, then runs the gate.

### `ask-user` findings

Some `/no-mistakes` review findings are marked `ask-user` — the pipeline judged that they challenge a deliberate intent or change product behaviour, so **only Jake** can rule on them. Claude relays each one **verbatim** (id, file, description) and never fixes, approves, or skips it alone — unless Jake has given standing consent to drive the whole run. `auto-fix` / `no-op` findings Claude can drive on its own judgment.

---

## What every build ticket contains

Each module is stamped from [`.github/ISSUE_TEMPLATE/build-ticket.md`](../.github/ISSUE_TEMPLATE/build-ticket.md):

- **Outcome** — what the module delivers.
- **Acceptance criteria** — the technical definition of done.
- **Grounded in** — the PRD FRs / decisions it draws on (traceability).
- **Intent seed** — the charter-level `--intent` seed (finalized at the gate).
- **Acceptance walkthrough** — Jake's runnable scenarios: exact command/click + the explicit PASS condition (non-UI modules ship a `try:<thing>` script or example fixtures).
- **Close-out** — the two-gate sequence above.

The per-ticket **acceptance walkthrough** is Gate 1 for that module; the milestone roll-up in [`docs/uat/`](uat/) sequences the accepted modules into one signed sheet before the release tag.

---

## The per-module loop, end to end

1. **Branch** off `main` (`feat/…` / `fix/…` / `chore/…`), one per issue.
2. **Build + commit** in small steps on the branch.
3. **Finalize intent** = issue seed + as-built decisions → **Jake quick-confirms**.
4. **Gate 0:** `/no-mistakes` → drive it (auto-fix findings on Claude's judgment; escalate `ask-user` to Jake) → **`checks-passed`** (PR green, not merged).
5. **Gate 1:** Jake runs the issue's acceptance walkthrough → all-PASS → **approves**.
6. **Merge:** Claude squash-merges + deletes the branch; the issue closes via the PR's `Closes #<n>`.
7. **Repeat.** When a milestone's modules are all merged and its `docs/uat/` roll-up is signed, cut the release.
