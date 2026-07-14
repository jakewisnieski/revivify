# M2 — the cockpit (a visual UI you can watch)

**What this milestone proves:** the audit is no longer a black box. `revivify ui` opens a local web-app **cockpit** where you *watch* the check happen — Chrome launching, the Lighthouse category gauges filling, each rule ticking to ✓/✗, and the trust dial landing on a score — instead of reading a number in a terminal and taking it on faith.

**Why it exists:** Revivify is built for people who can't read code. Dogfooding M1 showed that a headless audit + a terminal number quietly breaks that promise — you couldn't *see* where the 10/10 came from. Seeing it **is** the trust. (See [decision log #11](../decision-log.md).)

**How it's built:** the cockpit reuses the M1 engine unchanged. `revivify ui` starts a tiny local server that runs the real audit and streams progress + results to the browser. Nothing about the checks changed — only that you can now watch them.

---

## Try it yourself (~2 minutes)

```bash
npm install      # first time only
npm run ui       # then open the printed http://127.0.0.1:4123 in your browser
```

1. The path box is pre-filled with `./examples/perfect`. Click **Run check** and watch: a real headless Chrome runs, the four **category gauges** fill to 100, the **checks** tick green ✓, and the **trust dial** lands on a violet **10/10 · Ship-ready**.
2. Type `./examples/starter-slop` and Run again. Now the dial is amber **6/10 · Not yet**, the Accessibility/SEO gauges drop and turn amber, and the failing checks show **red ✗ with a plain-language reason, the fix (→), and a triage chip** ("We'll fix it" / "Your call").
3. Tick **fast pre-check** to run the instant static checks (no browser) while iterating.

Check your own page by typing its folder (with an `index.html`) or an `.html` file.

## What you should see — and why it's right

- **The score is *derived*, not asserted.** You watch the gauges and checks produce the 10/10, so there's nothing to take on faith.
- **Plain language + cited standards** on every finding, exactly like the CLI — just visual.
- **Judgment stays yours:** an accidental `noindex` shows as **Your call**, not an auto-fix.
- **Colour has meaning:** green = pass/go (gauges, ✓, Ship-ready), violet = brand/action (the dial, the Run button) — so a perfect dial reads as *ours*, not as a generic green tool.
- **HTTPS** shows as *not applicable* on a local page (it's a deploy-time check — [decision log #12](../decision-log.md)).

---

## Acceptance checklist — sign this off

- [ ] **`npm run ui` opens a working page** in my browser with a Run button — no code needed.
- [ ] **I can watch it happen.** Running `./examples/perfect` shows the audit working, then the gauges fill and the checks tick off — I can see where the score comes from.
- [ ] **A perfect page reads 10/10** with a violet dial and a green **Ship-ready** badge.
- [ ] **A bad page reads Not yet** — `./examples/starter-slop` shows an amber dial, dropped gauges, and red ✗ checks with fixes I could hand to my agent.
- [ ] **It doesn't look like Greptile.** Green is only on pass/go signals; the brand/action colour is violet.
- [ ] **The fast toggle works** and is labelled as a partial pre-check.
- [ ] **Judgment stays with me** — the noindex example is flagged "Your call," not changed.

**Signed off?** If yes, next is **M3** (`revivify init` + the Claude Code hook that gates "done"). If not, note which box failed and what you expected.

> Backlog: the brand mark (the sprout-on-a-stake) is a placeholder to revisit. A live-URL mode (`revivify ui https://…`) would make the HTTPS check meaningful and is a natural follow-up.
