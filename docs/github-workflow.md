# How we work — the GitHub / SDLC workflow

This is Revivify's **process contract**: how one unit of work travels from idea to shipped, and which GitHub feature carries it at each step. It exists so that every change is **deliberate, reviewable, and reversible** — and so a reviewer can see the product was shipped *by process, not by luck*.

> **One-line version:** Jake owns the **intent** and the **gates** — what the work is, when it's good enough, whether it merges. Claude runs the **git mechanics** — branches, commits, PRs. Nothing reaches `main` except through a passing, reviewed Pull Request.

There's a fitting symmetry here: Revivify is itself a quality gate that refuses to let unverified work ship. This document holds *our own* repo to the same bar. We eat our own dog food.

---

## The mental model

- **Version control** — every change is a labeled save point you can inspect, undo, or branch from. Nothing is ever truly lost.
- **SDLC** — the repeating loop of **plan → design → build → test → release → maintain.** GitHub has a native feature for each phase, so "following the SDLC" mostly means **using the right GitHub feature at the right moment** instead of committing code in a pile.

## Roles — who does what

| | **Jake — the gatekeeper** | **Claude — the mechanic** |
|---|---|---|
| Owns | Intent, scope, "is it good enough," the merge decision | Branch/commit/PR commands, writing the code, self-review |
| Does | Writes issues as outcomes, defines "done," reviews & approves, cuts releases | Creates the branch, commits in small steps, opens the PR, runs the checks |
| Never | Has to type git commands | Merges to `main` or pushes a release **without Jake's explicit go-ahead** |

**The load-bearing rule:** Claude must **explain what it's about to do to anything on `main`** *before* doing it, and never merge or tag a release on its own initiative.

## How SDLC phases map to GitHub

| SDLC phase | GitHub feature | What happens |
|---|---|---|
| **Plan / requirements** | **Issues** + **Projects** board | One issue per unit of work, written as an outcome |
| **Group into releases** | **Milestones** | Bundle issues into M0, M1, … (we already think in these — PRD §10) |
| **Design** | Issue description / the PRD & docs in-repo | Capture the approach *before* building |
| **Build** | **Branch** + **Commits** | Isolated work; small, labeled save points |
| **Test / review** | **Pull Request** + **Actions (CI)** + review gate | The quality gate before anything reaches `main` |
| **Release** | **Merge** + **Tag** + **Release** | Mark a shippable version |
| **Maintain** | **Issues** (bugs) → repeat the loop | Every bug re-enters as a new issue |

---

## One-time project setup

Status for **this** repo (`github.com/jakewisnieski/revivify`):

| # | Item | Why | Status |
|---|---|---|---|
| 1 | **README** — what it is, how to run, current status | The front door reviewers see | ✅ Done |
| 2 | **`.gitignore`** covers secrets & build junk | How you avoid committing API keys / `node_modules` | ✅ Done — `.env*`, `dist/`, `node_modules/` all ignored |
| 3 | **Branch protection on `main`** (a ruleset): require a PR, block force-push & deletion, no bypass | Forces the SDLC gate — no accidental dumps onto `main` | ✅ Done — active ruleset, `current_user_can_bypass: never` |
| 4 | **Project board** (Todo / In Progress / Review / Done) linked to the repo | Makes the plan visible | ✅ Done — [board](https://github.com/users/jakewisnieski/projects/2) linked to the repo; Todo → In Progress → Review → Done statuses; issues added |
| 5 | **Issue templates** (`.github/ISSUE_TEMPLATE/`) — a Feature and a Bug template | Every issue is structured — great for a portfolio | ✅ Done — Feature + Bug + config |
| 6 | **CI workflow** (`.github/workflows/ci.yml`) — run `npm test` + `npm run typecheck` on every PR | Red = don't merge; the automated half of the gate | ✅ Done — `test` job; required check on `main` |

Items 3–6 are the concrete setup that turns this document from aspiration into an enforced process. See **[Where we are today](#where-we-are-today--the-transition)**.

> ### ⚑ Step 0 — turn on branch protection *first*, before the first feature branch
> Setup item 3 is not just another checkbox — it's the **prerequisite** for everything below. Branch protection is the one switch that makes this workflow *real* rather than cosmetic: with it on, the **only** way onto `main` is a passing, reviewed PR, so the loop can't be skipped by accident. Turn it on **before** the first feature branch exists — it's trivially easy to set on a clean `main`, and increasingly awkward once there's work-in-progress to route around. **Do this before starting M3.**

---

## The core loop — repeat for every piece of work

One trip through the loop = **one feature or fix.** Internalize this.

### 1. Create an Issue (Plan)
Describe the work as an **outcome**: *"As a user I can X so that Y,"* plus **acceptance criteria** (how we'll know it's done). Assign it to a **Milestone** and give it a **[type + `mN` label](#labels--typing-and-grouping-the-work)**. This is the requirement of record. Milestone build modules use the self-contained **[build-ticket template](../.github/ISSUE_TEMPLATE/build-ticket.md)** — it carries the module's *grounded-in* traceability, an *intent seed*, its *acceptance walkthrough*, and *close-out* inline (see **[build-gate.md](build-gate.md)**).

### 2. Branch off `main` (isolate)
**One branch per issue**, named by type and topic:
```
feat/init-command        fix/lighthouse-timeout        docs/github-workflow
```
`main` stays clean and always-shippable; work-in-progress lives on the branch. → *"Claude, create a branch for issue #12."*

### 3. Commit in small, labeled steps (Build)
Each commit = one coherent change with a clear message. **Prefer many small commits over one giant one** — they're the undo points and they tell the story of how the feature was built. Use **[Conventional Commits](#conventional-commits)** prefixes.

### 4. Open a Pull Request (Test + review gate)
When the branch is ready, open a PR back to `main`. The description says **what changed** and **links the issue** — `Closes #12` auto-closes it on merge. Three gates run here:

- **Automated checks (GitHub Actions)** — `npm test` + `npm run typecheck` on every PR. **Red = don't merge.** (This is the seat where the `no-mistakes` pipeline lands.)
- **Code review** — Claude self-reviews the diff (`/code-review`), and runs a Greptile pass (`/cli-review` locally, `/greploop` on the PR) when we want deeper review.
- **Jake's acceptance test** — Jake runs the app and verifies the milestone **as the end user** (our `verify` habit; each milestone already ships a `docs/walkthroughs/` acceptance checklist).

> **Build modules run these three gates as a fixed two-gate close-out** — Gate 0 (automated `/no-mistakes`: review + tests + lint + PR + CI) → Gate 1 (Jake's acceptance walkthrough) → merge. The full contract, including the intent-seed model and `ask-user` escalation, is in **[build-gate.md](build-gate.md)**.

### 5. Merge (Integrate)
Once checks are green and Jake has accepted it: **Squash merge** (keeps `main`'s history to one clean commit per feature), then **delete the branch** (GitHub offers this). The issue closes itself.

### 6. Tag a release at milestone boundaries (Release)
When a Milestone's issues are all merged, cut a **Release** with a version tag → **[Versioning](#versioning--releases)**. The Release page becomes the human-readable history of the product.

### 7. Maintain
Every bug found later becomes a **new Issue**, and we re-enter the loop at step 1. That's the whole SDLC turning.

---

## Conventional commits

Prefix every commit so history is scannable and can auto-generate changelogs:

| Prefix | For |
|---|---|
| `feat:` | a new capability |
| `fix:` | a bug fix |
| `docs:` | documentation |
| `test:` | tests |
| `refactor:` | restructuring, no behavior change |
| `chore:` | tooling / config |

*(We've been doing this since M0 — keep it up. Example from our history: `feat: M1 — real Lighthouse + axe-core engine`.)*

## Labels — typing and grouping the work

Labels make the board filterable and a ticket's *kind* legible at a glance. Revivify's set mirrors [Lucid](https://github.com/jakewisnieski/Lucid) so both projects read the same way.

**Type** — what kind of change (matches the Conventional Commit prefix):

| Label | For |
|---|---|
| `enhancement` | a new capability (`feat:`) |
| `bug` | a bug fix (`fix:`) |
| `documentation` | docs |
| `chore` | tooling / config / process |
| `refactor` | restructuring, no behaviour change |
| `test` | tests |

**Milestone grouping** — an `mN` label (e.g. `m3`) tags every issue in milestone MN. The Milestone field already groups them; the label just makes a board view one click, across states.

**Wayfinder** — the planning-phase ticket types (adopted from M4 onward; the phase itself is documented as we roll it out):

| Label | For |
|---|---|
| `wayfinder:map` | the shared plan — one living epic issue |
| `wayfinder:grilling` | a decision ticket — grill it with docs |
| `wayfinder:research` | AFK doc/API research that cites sources |
| `wayfinder:prototype` | a throwaway prototype to de-risk a call |
| `wayfinder:task` | a manual unblocking task |

**Rule of thumb:** every issue gets at least a **type** label; build issues also carry their **`mN`** label.

## Versioning & releases

**Semantic Versioning — `MAJOR.MINOR.PATCH`:**

- **PATCH** (`0.1.1`) — bug fixes only
- **MINOR** (`0.2.0`) — new features, nothing broken
- **MAJOR** (`1.0.0`) — breaking changes / first real launch

**Our milestone → version plan:**

| Milestone | Version | Note |
|---|---|---|
| M0 walking skeleton | `v0.1.0` | shipped (not yet tagged) |
| M1 real engine | `v0.2.0` | shipped (not yet tagged) |
| M2 visual cockpit | `v0.3.0` | shipped (not yet tagged) |
| M3 init + hook | `v0.4.0` | next |
| … | … | |
| First real launch | `v1.0.0` | when the beachhead pack is genuinely good |

M0–M2 shipped before we adopted this workflow, so they aren't tagged. We can **back-tag** them from their existing commits (`git tag v0.1.0 <sha>`) to make the Release history complete — a clean, low-risk way to backfill the audit trail without rewriting anything.

---

## Where we are today — the transition

Be honest about the starting line: **M0–M2 were committed directly to `main`** in a pile — good Conventional Commit messages, but no branches, PRs, issues, or tags. We adopt this workflow **starting at M3.**

- **We do not rewrite the existing `main` history.** It's already pushed; rewriting shared history is risky, and for a portfolio the honest record ("process adopted at M3") is more credible than a fabricated-clean one. This mirrors the honesty ethos in [decision log #10 and #12](decision-log.md) — we don't fake what wasn't there.
- **From M3 forward, every unit of work runs the full loop:** issue → branch → PR → gate → squash-merge → tag at milestone boundaries.
- **Recommended first move:** turn on branch protection (setup item 3) so `main` is *actually* sacred — that single switch is what makes this genuine SDLC rather than cosmetic.

---

## Non-dev guardrails (the short list)

- **You are the gatekeeper, not the mechanic.** Write clear issues, define "done," approve merges. Let Claude run the git commands — but make it explain anything that touches `main` first.
- **Never commit secrets.** If a `.env` or key is ever about to be committed, stop. Our `.gitignore` covers `.env*` — verify it still does before trusting it.
- **`main` is sacred.** With protection on, the only path onto `main` is a passing, reviewed PR. That one rule is what makes the process real.
- **Small PRs are safer.** Easier to review, easier to revert. If an issue feels big, split it into two — the same way we slice milestones.
- **The audit trail is a deliverable.** Issue → PR → review → merge → tagged release is itself the portfolio artifact: it shows the product was shipped deliberately.
