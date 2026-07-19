# UAT — retired

The prescriptive **CLI User Acceptance Test** (Claude drives Jake through scenarios one at a time, sign a pass/fail sheet) was **retired mid-M4** (2026-07-19, [decision #23](../decision-log.md)).

It added friction without adding signal: Claude already self-verifies each module's acceptance scenarios in **Gate 0** and records the results in the PR, so having Jake re-run the same commands from the CLI only delayed the build.

**What replaced it:**

- **Per module** — Gate 0: CI green + `/code-review` clean + Claude-verified acceptance scenarios in the PR. See [`build-gate.md`](../build-gate.md).
- **Per milestone** — one **visual cockpit walkthrough** (`revivify ui`), guided by the milestone's cockpit-first guide in [`docs/walkthroughs/`](../walkthroughs/), run before the release tag. Plus an optional on-demand look when a module lands a new visible surface.

`m3-init-and-hook.md` is kept here as a **historical record** of the M3 sign-off. New milestones do not add files to this directory.
