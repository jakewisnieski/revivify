---
name: Build ticket (milestone module)
about: A self-contained work order for a milestone build module — carries its own acceptance walkthrough and close-out
title: "type: short outcome [Mn]"
labels: []
assignees: []
---

<!--
A build ticket is a self-contained work order: everything needed to build it,
prove it, and merge it lives here. Stamp every milestone module from this.
Title: Conventional Commit type + short outcome + the module tag, e.g.
"feat(hook): gate 'done' via a Claude Code Stop hook [M13]".
Add a type label + the `mN` label. See docs/github-workflow.md and docs/build-gate.md.
-->

**Module:** M_ · **Depends on:** #_ · **Milestone:** M_

## Outcome
<!-- What this module delivers, as an outcome. One unit of work. -->

## Acceptance criteria
<!-- The technical definition of done — checkable. -->
- [ ]
- [ ]

## Grounded in
<!-- Traceability: the PRD FRs / decision-log entries / decisions this draws on.
     e.g. "FR-8; decision-log #9 (ship-ready = 10/10)". -->

## Intent seed (for `/no-mistakes` — finalized at build time, Jake quick-confirms)
<!-- A charter-level --intent for the automated review: the goal, the DELIBERATE
     choices a reviewer should NOT flag (with the reason), constraints ruled in/out,
     and anything in the diff that would surprise a reviewer. Composed at build time
     from this seed + the as-built decisions. See docs/build-gate.md. -->
>

## Acceptance walkthrough (Jake runs — Gate 1)
<!-- Runnable SOP scenarios: exact command/click + the explicit PASS condition.
     Non-UI modules ship a `try:<thing>` script or example fixtures.
     This is the per-ticket UAT; the milestone roll-up in docs/uat/ sequences these. -->
- **S1 <name>:** `<command>` — **PASS:** <what you should see>.
- **S2 <name>:** `<command>` — **PASS:** <…>.

## Close-out (standard runbook)
<!-- The two gates from docs/build-gate.md; Claude never self-merges. -->
Gate 0 (`/no-mistakes` on a feature branch → PR green + review clean) → Gate 1 (Jake runs the Acceptance walkthrough → all-PASS → approves) → squash-merge + delete branch. The PR carries `Closes #<this>`.
