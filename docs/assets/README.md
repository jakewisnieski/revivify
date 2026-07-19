# Docs assets

## `revivify-cockpit.gif`

The README hero: the cockpit (`revivify ui`) taking a page from **9/10** to **10/10 · Ship-ready** by accepting a "your call" `noindex` with a reason (the M4.6 Accept flow).

**How it was recorded (to re-make it):**

1. Copy `demo-site/` to a scratch dir and apply the three safe fixes from [`demo-site/README.md`](../../demo-site/README.md) (add `<html lang>`, the hero `alt`, and a `<meta name="description">`) — leave the `noindex` in place. This is the "near-ship" state that scores **9/10** with one unresolved your-call. Delete any `.revivify.yaml` so the your-call starts unaccepted.
2. Launch the cockpit on it: `npm run dev -- ui <scratch-dir>` (or `REVIVIFY_UI_PORT=8123 REVIVIFY_NO_OPEN=1 npx tsx src/cli.ts ui <scratch-dir>` to control the port).
3. Record: tick **fast pre-check** → **Run check** (lands at 9/10) → **Accept this — it's intentional** → type a reason → **Confirm** → the dial clears to **10/10**.

Recorded via the fast pre-check for a snappy loop; the full audit tells the same story with live Lighthouse category gauges (~30–45s).
