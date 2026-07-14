# Working on Revivify — operating rules for Claude

Full process contract: **[`docs/github-workflow.md`](docs/github-workflow.md)**. This file is the short, always-loaded version so the workflow actually sticks each session.

## Roles
- **Jake owns intent + gates:** what the work is, when it's good enough, whether it merges.
- **Claude runs the mechanics:** branches, commits, PRs, self-review — but **never merges to `main` or tags a release without Jake's explicit go-ahead**, and **explains anything that touches `main` before doing it.**

## The default loop for any non-trivial work
1. **Issue** — the work as an outcome + acceptance criteria, assigned to a Milestone.
2. **Branch off `main`** — one branch per issue: `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `chore/…`. Never commit straight to `main`.
3. **Small commits** — one coherent change each, [Conventional Commits](docs/github-workflow.md#conventional-commits) prefix (`feat/fix/docs/test/refactor/chore`). Prefer many small over one giant.
4. **Pull Request → `main`** — description says what changed + `Closes #<n>`. Gates: GitHub Actions (`npm test` + `npm run typecheck`) green, Claude self-review (`/code-review`), Jake's end-user acceptance.
5. **Squash-merge on Jake's approval**, delete the branch.
6. **Tag a release at milestone boundaries** — SemVer (`v0.4.0` = M3). Only on Jake's go-ahead.

## Non-negotiables
- **Branch protection on `main` is turned on before the first feature branch** — it's the step that makes the process real, not cosmetic. Confirm it's on before treating `main` as protected.
- **`main` is sacred** — the only path onto it is a passing, reviewed PR.
- **Never commit secrets.** If a `.env` or key is about to be staged, stop. `.gitignore` covers `.env*` — verify before trusting.
- **Small PRs over big ones.** If an issue feels big, split it.
- **Commit/push only when asked.** Don't push, open PRs, or merge on your own initiative.

## Current state (2026-07-14)
M0–M2 were committed directly to `main` before this workflow existed. We **adopt the loop starting at M3** and **do not rewrite existing history**. Next milestone: **M3 — `revivify init` + rules pack + Claude Code hook gating "done"** (PRD §10).
