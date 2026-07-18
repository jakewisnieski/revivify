# M3 — init + guardrails + hook · User Acceptance Test

> **Status: ✅ ACCEPTED — driven live in PowerShell on 2026-07-18, all 9 scenarios PASS.** This stands as the M3 sign-off record. Commands below are shown in bash form; the live run used PowerShell equivalents with a fixed demo folder and `Get-Content … -Encoding utf8` (see the [shell note](README.md)). From M4 on, per-module acceptance walkthroughs live in the build tickets ([build-gate.md](../build-gate.md)); these roll-ups sequence them.

> **Claude drives this.** Say "walk me through the M3 UAT" and Claude presents one scenario at a time, waits for what you saw, and marks each criterion. Go step by step — don't run it all at once.

**What we're accepting:** `revivify init` sets a project up for the guardrailed lifecycle in one command, and the installed hook checks "done" automatically (a nudge for now).
**Time:** ~5 minutes · **You need:** a terminal in the repo, `npm install` done once.

> **Reading the output:** commands run through `npm run dev`, which prints its own `> revivify@0.0.0 dev` banner first. Ignore those wrapper lines — match the Revivify output below them.

---

## One-time setup

> Claude: have Jake paste this, confirm the folder was made, then go to Scenario 1.

```bash
DEMO=$(mktemp -d) && echo "demo project: $DEMO"
```

**You should see:** one line like `demo project: /tmp/tmp.AbC123` (a throwaway folder — nothing real is touched).
**✅ Ready when:** you get a path back and no error.

---

## Scenario 1 — One command sets the whole project up

> Validates: **#11** (init scaffolds config), **#12** (rules pack + plan), **#13** (hook installed) — all in one command.

**Do this:**
```bash
npm run dev -- init "$DEMO"
```

**You should see (below the npm banner):**
```
Revivify is set up in /…/<demo>
  ✓ created     .revivify.yaml           ship-ready bar & check toggles
  ✓ created     .revivify/guardrails.md  rules pack (agent guardrails)
  ✓ created     .revivify/plan.md        plan & definition of done
  ✓ created     CLAUDE.md                points your coding agent at the guardrails
  ✓ installed   .claude/settings.json    Stop hook — nudges "done" toward ship-ready via `npx revivify gate`
  Next: run `revivify check` to see where the page stands.
```

**✅ Pass if:** all **five** items show — four `✓ created` and one `✓ installed`.
**❌ If not:** fewer than five lines, or an error — tell Claude which lines you got.
**Why it matters:** setup is *one step*, not a checklist of manual wiring. That's the whole promise of `init`.

---

## Scenario 2 — The guardrails are real, cited guidance

> Validates: **#12** — the rules pack reads like human advice and every item cites a standard.

**Do this:**
```bash
cat "$DEMO/.revivify/guardrails.md"
```

**You should see:** a "Revivify guardrails" doc with a **Category gates** section (performance, accessibility, seo, best-practices) and a **Specific checks** list, each line ending in a cited standard in parentheses — e.g. `_(WCAG 2.2 — 1.1.1 Non-text Content (Level A))_`, `_(Core Web Vitals — LCP, CLS, INP)_`, `_(Google Search Essentials …)_`.

**✅ Pass if:** you can read it as plain advice **and** every check names a published standard.
**❌ If not:** vague guidance, or checks with no standard cited — tell Claude.
**Why it matters:** the guardrails steer the coding agent *before* mistakes happen, and "cite the standard" is Revivify's whole trust model.

---

## Scenario 3 — The config is readable and sane

> Validates: **#11** (threshold + per-check toggles) and **#13** (enforcement mode).

**Do this:**
```bash
cat "$DEMO/.revivify.yaml"
```

**You should see:** `threshold: 10`, `enforcement: warn`, a `rules:` block with a `true` toggle per check, and a `categories:` block.

**✅ Pass if:** the bar is `10`, enforcement is `warn`, and there's a toggle per check.
**❌ If not:** missing fields or different values — tell Claude.
**Why it matters:** the ship-ready bar and the warn/block switch are the two dials you control; they should be obvious and editable.

---

## Scenario 4 — It refuses to clobber your own work

> Validates: **#12** — an existing `CLAUDE.md` is never overwritten, *even with `--force`*.

**Do this:**
```bash
printf '# My own project rules\nDo not touch this.\n' > "$DEMO/CLAUDE.md"
npm run dev -- init "$DEMO" --force
echo "----- your CLAUDE.md after --force -----"
cat "$DEMO/CLAUDE.md"
```

**You should see:** the init summary now shows `• kept        CLAUDE.md   left your existing file untouched …`, and your file still reads exactly:
```
# My own project rules
Do not touch this.
```

**✅ Pass if:** the CLAUDE.md line says **kept**, and your two lines are intact.
**❌ If not:** your text was overwritten, or the line says "regenerated" — that's a fail; tell Claude immediately.
**Why it matters:** `init` runs in *your* project. Silently overwriting your agent instructions would be unforgivable — this proves it won't.

---

## Scenario 5 — The "done" hook is actually installed

> Validates: **#13** — the Stop hook lands in Claude Code settings, wired to the gate.

**Do this:**
```bash
cat "$DEMO/.claude/settings.json"
```

**You should see:** JSON with a `Stop` hook whose command is `npx revivify gate`:
```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "npx revivify gate" } ] }
    ]
  }
}
```

**✅ Pass if:** there's a `Stop` hook running `npx revivify gate`.
**❌ If not:** no `.claude/settings.json`, or no Stop hook — tell Claude.
**Why it matters:** this is what makes the check *automatic* — it fires when your coding agent says it's done, without anyone remembering to run it.

---

## Scenario 6 — The gate nudges a broken page (and does NOT block)

> Validates: **#13** — warn mode names the failing check + score and lets you through.

**Do this:**
```bash
cp examples/missing-alt/index.html "$DEMO/index.html"
npm run dev -- gate "$DEMO"
echo "exit code: $?"
```

**You should see:**
```
Revivify gate — /…/index.html (fast pre-check)
  Trust: 8/10 — 5 of 6 checks passing
  ✗ Images have alt text
  Heads up: not ship-ready yet (bar is 10/10). This is a nudge — enforcement is "warn", so nothing is blocked.
exit code: 0
```

**✅ Pass if:** it names `✗ Images have alt text`, shows `8/10`, calls itself a **nudge**, and `exit code: 0`.
**❌ If not:** it blocked (non-zero exit), or didn't name the problem — tell Claude.
**Why it matters:** while you're iterating, the gate should *inform*, not obstruct. That's the warn-only behavior you asked for.

---

## Scenario 7 — The gate passes a clean page

> Validates: **#13** — a page that clears the bar sails through.

**Do this:**
```bash
cp examples/perfect/index.html "$DEMO/index.html"
npm run dev -- gate "$DEMO"
echo "exit code: $?"
```

**You should see:**
```
Revivify gate — /…/index.html (fast pre-check)
  Trust: 10/10 — 6 of 6 checks passing
  Ship-ready ✅ — clears the bar (10/10).
exit code: 0
```

**✅ Pass if:** `10/10`, `Ship-ready ✅`, `exit code: 0`.
**❌ If not:** anything less than 10/10 or a non-zero exit — tell Claude.
**Why it matters:** the gate has to get out of the way when the work is genuinely good.

---

## Scenario 8 — The gate never crashes a half-built project

> Validates: **#13** — no page yet (mid-build) is handled gracefully, not with a stack trace.

**Do this:**
```bash
rm "$DEMO/index.html"
npm run dev -- gate "$DEMO"
echo "exit code: $?"
```

**You should see:**
```
Revivify gate: nothing to check yet — Couldn't read "/…/index.html". Expected an HTML page there.
exit code: 0
```

**✅ Pass if:** a friendly "nothing to check yet" line and `exit code: 0` — no crash, no scary error.
**❌ If not:** a stack trace or non-zero exit — tell Claude.
**Why it matters:** the hook fires on *every* turn, including early ones before a page exists. It must never derail your session.

---

## Scenario 9 (optional preview) — Hard-block is one line away

> Validates: **#13** — the path from "nudge" to "wall" is a single config change. *Optional: the block path runs the full Lighthouse audit (~40s, launches Chrome).*

**Do this:**
```bash
sed -i.bak 's/^enforcement: warn/enforcement: block/' "$DEMO/.revivify.yaml"
cp examples/missing-alt/index.html "$DEMO/index.html"
npm run dev -- gate "$DEMO"; echo "exit code: $?"
```

**You should see:** the full audit run, then a **blocking** message and `exit code: 2` (a Stop hook reads 2 as "not done — keep going").

**✅ Pass if:** below-bar now yields `exit code: 2` and a "blocking" message.
**Why it matters:** proves the phased plan is real — flip one line near demo and "done" means *verified done*.

---

## Teardown

```bash
rm -rf "$DEMO" && echo "cleaned up"
```

---

## Sign-off

> Claude fills this in as we go. M3 is accepted only when every row is ✅.

| # | Acceptance criterion (plain words) | Scenario | Result |
|---|---|---|---|
| 1 | One command scaffolds config + guardrails + plan + hook | 1 | ✅ |
| 2 | Guardrails are real, human-readable, standard-cited advice | 2 | ✅ |
| 3 | Config exposes the ship-ready bar + warn/block switch | 3 | ✅ |
| 4 | An existing CLAUDE.md is never overwritten (even `--force`) | 4 | ✅ |
| 5 | The Stop hook is installed and wired to the gate | 5 | ✅ |
| 6 | The gate nudges a broken page without blocking (warn) | 6 | ✅ |
| 7 | The gate passes a clean page cleanly | 7 | ✅ |
| 8 | The gate never crashes a half-built project | 8 | ✅ |
| 9 | Hard-block is one config line away (optional) | 9 | ✅ |

**M3 accepted:** ✅ (all rows ✅) → clears the way for **v0.4.0**.
**Signed:** Jake · **Date:** 2026-07-18
