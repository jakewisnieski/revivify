---
name: Build ticket (milestone module)
about: A self-contained work order for a milestone build module — carries its own acceptance scenarios and close-out
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

## Intent seed (for the review gate — finalized at build time, Jake quick-confirms)
<!-- A charter-level intent for the review: the goal, the DELIBERATE choices a
     reviewer should NOT flag (with the reason), constraints ruled in/out, and
     anything in the diff that would surprise a reviewer. Composed at build time
     from this seed + the as-built decisions. See docs/build-gate.md. -->
>

## Acceptance scenarios (Claude self-verifies in Gate 0)
<!-- Runnable scenarios: exact command/click + the explicit PASS condition.
     Non-UI modules use example fixtures. Claude runs each and records the
     command + observed output in the PR. Jake's human acceptance is the
     milestone visual cockpit walkthrough (docs/walkthroughs/), not this. -->
- **S1 <name>:** `<command>` — **PASS:** <what you should see>.
- **S2 <name>:** `<command>` — **PASS:** <…>.

## Close-out (standard runbook)
<!-- Gate 0 from docs/build-gate.md; Claude never self-merges. -->
Gate 0 (feature branch → CI green + `/code-review` clean + acceptance scenarios self-verified in the PR) → squash-merge + delete branch. The PR carries `Closes #<this>`. Human acceptance is the milestone visual walkthrough before the release tag.
