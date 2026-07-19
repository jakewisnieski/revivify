# Docs assets

## `revivify-cockpit.webp`

The README hero: the cockpit (`revivify ui`) taking a landing page that *looks done* from **failing its checks** to **10/10 · Ship-ready** — click **Apply the safe fixes** (Revivify writes the honestly-sourced "we'll fix it" batch), then **Accept** the leftover `noindex` "your call" with a reason, and the trust dial clears the bar.

An **animated WebP** (autoplays + loops in the README, full colour, ~2.4 MB) — chosen over a GIF for smoothness and colour fidelity (a GIF is capped at 256 colours and was visibly choppy).

**How it was made (to re-record it):**

1. Copy `demo-site/` to a scratch dir and delete its `.revivify.yaml`/`README.md` so it starts at its seeded state:
   ```powershell
   $HERO = "$env:TEMP\revivify-hero"
   Remove-Item -Recurse -Force $HERO -ErrorAction SilentlyContinue
   Copy-Item .\demo-site $HERO -Recurse
   Remove-Item "$HERO\.revivify.yaml","$HERO\README.md" -ErrorAction SilentlyContinue
   npx tsx src/cli.ts ui $HERO
   ```
2. **Screen-record** the cockpit window (OBS Studio, 60fps, MP4). Tick **fast pre-check**, then: **Run check** (lands below the bar) → **Apply the safe fixes** (dial climbs) → **Accept this — it's intentional** → type a reason → **Confirm** → **10/10 · Ship-ready**; hold ~2s.
3. **Convert to animated WebP** with ffmpeg (crop out the browser chrome, downscale, 24fps, loop forever):
   ```bash
   ffmpeg -ss 2.5 -i recording.mp4 -t 15.5 \
     -vf "crop=2560:1312:0:128,scale=960:-1:flags=lanczos,fps=24" \
     -c:v libwebp -lossless 0 -q:v 50 -compression_level 6 -loop 0 -an \
     revivify-cockpit.webp
   ```
   (Crop values are for a 2560×1440 capture — adjust to your recording. `ffmpeg` here was `npx`'d from the `ffmpeg-static` npm package.)
