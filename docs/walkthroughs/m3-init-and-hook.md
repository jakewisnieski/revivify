# M3 — init + guardrails + the "done" hook

**What this milestone proves:** Revivify now steers the work **before** it's built and gates it **when it's called done** — not just when you remember to run a check. `revivify init` drops a rules pack that guides the coding agent up front, plus a plan and config, and installs a **Claude Code Stop hook** that runs the gate every time the agent finishes a turn.

**What changed from M2:** M0–M2 made `revivify check` real and visible — but you still had to *choose* to run it. M3 closes the loop at both ends: the **guardrails** push quality upstream (fewer defects to catch), and the **hook** makes the check automatic, so "done" is checked, not assumed.

**What's deliberately still out (honest limits):**
- **The hook nudges, it doesn't block — on purpose.** Enforcement defaults to `warn`: while we're iterating, a below-bar page gets a **nudge**, not a wall. We flip it to `block` (hard-stop "done" until the score clears the bar) as we head toward the demo. It's one line in `.revivify.yaml`.
- **Warn runs the fast static pre-check** (instant, no browser) so it's cheap to fire on every turn. `block` runs the full Lighthouse audit — the real certifying gate — which is why it's reserved for the strict phase.
- **The check toggles in `.revivify.yaml` aren't wired in yet** — the gate reads the ship-ready bar and enforcement mode; honoring individual rule on/off toggles is a later step.
- **In a published install you'd type `revivify init` / `revivify gate`.** Revivify isn't on npm yet, so the steps below drive the local dev CLI (`npm run dev -- …`) against a throwaway folder. The installed hook command is `npx revivify gate`.

---

## Try it yourself (~3 minutes)

Setup once: `npm install`. These steps scaffold a **throwaway demo project** (not this repo), so nothing here is touched.

### 1. Set up a fresh project → guardrails + hook, in one command

```bash
DEMO=$(mktemp -d)
npm run dev -- init "$DEMO"
```

You should see it scaffold five things and install the hook:

```
Revivify is set up in /…/revivify-demo
  ✓ created     .revivify.yaml           ship-ready bar & check toggles
  ✓ created     .revivify/guardrails.md  rules pack (agent guardrails)
  ✓ created     .revivify/plan.md        plan & definition of done
  ✓ created     CLAUDE.md                points your coding agent at the guardrails
  ✓ installed   .claude/settings.json    Stop hook — nudges "done" toward ship-ready via `npx revivify gate`
  Next: run `revivify check` to see where the page stands.
```

### 2. Look at what it dropped

```bash
cat "$DEMO/.revivify/guardrails.md"     # the rules pack — best practices, each citing its standard
cat "$DEMO/.revivify/plan.md"           # the plan + definition of done ("done = passing the gate")
cat "$DEMO/.revivify.yaml"              # threshold: 10, enforcement: warn, plus per-check toggles
cat "$DEMO/.claude/settings.json"       # the installed Stop hook
```

The guardrails' per-check list is **generated from the checks Revivify actually runs**, so it can never drift from what gets graded. Every line cites its standard (WCAG 2.2 / Core Web Vitals / Google Search Essentials).

**Non-destructive by design:** if the project already had a `CLAUDE.md`, init leaves it untouched (even with `--force`) and just tells you how to reference the guardrails. The hook is *merged* into `.claude/settings.json` — your other settings and hooks are preserved.

### 3. The gate nudges a below-bar page (warn mode)

Drop in a page with a known problem (missing alt text), then run the gate the way the hook does:

```bash
cp examples/missing-alt/index.html "$DEMO/index.html"
npm run dev -- gate "$DEMO"
```

```
Revivify gate — /…/index.html (fast pre-check)
  Trust: 8/10 — 5 of 6 checks passing
  ✗ Images have alt text
  Heads up: not ship-ready yet (bar is 10/10). This is a nudge — enforcement is "warn", so nothing is blocked.
```

It names what's wrong and exits **0** — a nudge, not a block. (When your coding agent finishes a turn, this is exactly what fires automatically.)

### 4. The gate is happy with a clean page

```bash
cp examples/perfect/index.html "$DEMO/index.html"
npm run dev -- gate "$DEMO"
```

```
Revivify gate — /…/index.html (fast pre-check)
  Trust: 10/10 — 6 of 6 checks passing
  Ship-ready ✅ — clears the bar (10/10).
```

### 5. (Preview) Turn the nudge into a wall

When we're ready to enforce, flip one line in `$DEMO/.revivify.yaml`:

```yaml
enforcement: block
```

Now a below-bar page makes `gate` exit **2** — which a Claude Code Stop hook reads as *"not done, keep going"* — and it switches to the full Lighthouse audit (the real certifying gate). That's the same hook, same command; only the strictness changes.

*(Clean up the demo when you're done: `rm -rf "$DEMO"`.)*

---

## Acceptance checklist — is this the right thing?

- [ ] **One command sets a project up.** `revivify init` drops the config, the rules pack, the plan, and a CLAUDE.md pointer, and installs the hook — no hand-wiring.
- [ ] **The guardrails are real guidance.** `.revivify/guardrails.md` reads like advice a person could follow, and every item cites a standard.
- [ ] **It won't clobber your work.** An existing `CLAUDE.md` is left untouched; other `.claude/settings.json` content survives.
- [ ] **The gate is automatic.** After init, finishing a coding turn triggers the check without anyone remembering to run it.
- [ ] **The nudge is clear and non-blocking (for now).** A below-bar page is named and explained, and nothing is blocked while `enforcement: warn`.
- [ ] **A clean page passes cleanly.** 10/10 → "Ship-ready ✅".
- [ ] **The path to hard-enforcement is one line.** `enforcement: block` is all it takes to make "done" mean *verified done*.

When you can tick every box, **M3 is done.**

---

## Draft release notes — v0.4.0 (M3)

- **`revivify init`** — scaffolds a project for the guardrailed lifecycle in one command: `.revivify.yaml` (ship-ready bar + check toggles), a rules pack and plan under `.revivify/`, and a `CLAUDE.md` pointer (only if none exists). Non-destructive; `--force` regenerates Revivify-owned files.
- **Guardrails up front** — `.revivify/guardrails.md` steers the coding agent toward best practices before any check runs; its checklist is generated from the live checks and cites every standard.
- **`revivify gate` + a Claude Code Stop hook** — `init` installs a hook that runs the gate whenever the agent finishes a turn. `enforcement: warn` (default) nudges; `enforcement: block` hard-stops "done" until the score clears the bar. The hook is merged into `.claude/settings.json` non-destructively.
- **`.revivify.yaml`** — configurable ship-ready `threshold` (default 10) and `enforcement` mode.
