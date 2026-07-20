# Running Qwen3-VL locally with Ollama (Windows) — a detailed walkthrough

A step-by-step guide to standing up the design-layer vision model on **this machine**, so
you can prototype the taste layer at zero marginal cost.

**Target hardware (verified):** NVIDIA RTX 4080 SUPER (16 GB VRAM, Ada, CUDA-capable,
driver 610.47) · Ryzen 7 7800X3D · 64 GB RAM · Windows 11 Pro. This is a strong single-GPU
inference box; 16 GB VRAM is the ceiling that sets the model size.

---

## 0. Mental model — what you're actually running

**Ollama is a local model server.** You install it once; it runs quietly in the background
and exposes an HTTP API at `http://localhost:11434`. You `pull` a model (downloads the
weights once), then either chat with it in the terminal or — the way Revivify will use it —
POST a screenshot + prompt to that local API and get text back. No cloud, no API key, no
per-call cost. Your GPU does the work.

Three ways to talk to it, all local:
1. **CLI** — `ollama run …` for quick manual testing.
2. **Native REST API** — `POST /api/chat` with base64 `images`.
3. **OpenAI-compatible API** — `POST /v1/chat/completions` with `image_url` data URLs. This
   is the cleanest for wiring into Revivify (Node/TS) and lets you reuse OpenAI-shaped SDKs.

---

## 1. Install Ollama

1. Download the Windows installer from **https://ollama.com/download** (`OllamaSetup.exe`).
2. Run it. It installs a background service + a system-tray app (auto-starts on login and
   launches the server on `:11434`) and puts `ollama` on your PATH.
3. Open a **new** PowerShell window (so it picks up the PATH change) and verify:
   ```powershell
   ollama --version
   ```
   You should see a version string. If `ollama` isn't found, log out/in or reboot so PATH
   refreshes.

Ollama bundles its own CUDA runtime — you do **not** need to install the CUDA toolkit. It
only needs a recent NVIDIA driver, which you have (610.47). It auto-detects the 4080 SUPER.

## 2. (Recommended) Move the model store off the C: drive first

Models are multi-GB. By default Ollama stores them in `C:\Users\<you>\.ollama\models`. If C:
is tight, relocate the store **before** pulling anything:

1. Create a target dir, e.g. `D:\ollama-models`.
2. Set a **Windows system environment variable** (not just a shell variable — see the gotcha
   in §11): `OLLAMA_MODELS = D:\ollama-models`.
   - Start menu → "Edit the system environment variables" → Environment Variables → New.
3. **Quit and relaunch Ollama** from the tray (or reboot) so the server re-reads it.

Skip this if C: has ~30+ GB free and you don't mind it living there.

## 3. Pull the daily-driver model

```powershell
ollama pull qwen3-vl:8b
```

This downloads the Q4_K_M build (~6–7 GB on disk). Confirm it landed:

```powershell
ollama list
```

> **Tag check:** exact tags/quant variants live at
> **https://ollama.com/library/qwen3-vl** — if `qwen3-vl:8b` 404s, grab the precise tag from
> that page (there may be `:8b-instruct` or explicit quant tags like `:8b-q4_K_M`). Same for
> `:4b` and `:30b` later.

## 4. First run — text sanity check

```powershell
ollama run qwen3-vl:8b
```

You get an interactive prompt. Type something ("Say hello in one sentence."), confirm it
responds, then `/bye` to exit. First load pulls the model into VRAM (a few seconds); later
prompts are fast.

## 5. Vision test — feed it a screenshot

Grab any PNG/JPG screenshot of a web page. Three ways to test:

**A. CLI (quickest).** Reference the image path in the prompt — Ollama detects it:
```powershell
ollama run qwen3-vl:8b "Describe the visual hierarchy and CTA placement of this landing page: C:\path\to\shot.png"
```

**B. Native REST API (PowerShell).** Base64-encode the image and POST to `/api/chat`:
```powershell
$img = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\shot.png"))
$body = @{
  model    = "qwen3-vl:8b"
  stream   = $false
  messages = @(@{
    role    = "user"
    content = "Critique the type hierarchy, spacing, and CTA prominence. Be specific."
    images  = @($img)
  })
} | ConvertTo-Json -Depth 6
(Invoke-RestMethod -Uri "http://localhost:11434/api/chat" -Method Post -Body $body -ContentType "application/json").message.content
```

**C. OpenAI-compatible API (how Revivify will call it).** See the Node/TS example in §10.

If the model describes what's actually in the screenshot, vision is working end to end.

## 6. Confirm it's really on the GPU (and how fast)

While a generation is running, in another window:

```powershell
ollama ps          # shows loaded models + whether they're on GPU/CPU and the split
nvidia-smi         # shows VRAM used and GPU utilization %
```

For `qwen3-vl:8b` you want `ollama ps` to show ~100% GPU. On the 4080 SUPER expect roughly
**20–50 tokens/sec** at this size — a single-screenshot critique (a few hundred to ~1–2K
output tokens) lands in a few seconds to ~a minute. `nvidia-smi` should show ~11–13 GB VRAM
in use for the 8B once an image is loaded.

## 7. VRAM / performance tuning

The levers that matter on a 16 GB card:

- **Image resolution.** Qwen3-VL scales to very high res, and a tall full-page screenshot
  produces a *lot* of vision tokens — which eat VRAM and slow generation. **Cap the capture
  width (~1280–1536 px, full height)** for the detail you need without exploding token count.
  This is your single biggest lever, especially once you also pass exemplar images.
- **Context length (`num_ctx`).** Larger context = more KV-cache VRAM. Keep it only as large
  as the rubric + images need. Set per-request via the API `options`, e.g.
  `"options": { "num_ctx": 8192 }`.
- **Keep-alive.** By default Ollama unloads the model from VRAM after 5 min idle, so the next
  call pays a reload. To keep it warm during a dev session set `OLLAMA_KEEP_ALIVE` (e.g.
  `30m`, or `-1` to never unload) — Windows env var, restart Ollama (§11).
- **Quant tradeoff.** `q4_K_M` (~12 GB) is the safe default with headroom. `q8_0` (~16 GB) is
  sharper on low-contrast text but nearly fills the card — watch for OOM once you feed a big
  screenshot + several exemplars.

## 8. The 30B reasoning experiment (optional, later)

Once the 8B pipeline works, test whether more parameters improve *aesthetic* judgment:

```powershell
ollama pull qwen3-vl:30b
ollama run qwen3-vl:30b "…same critique prompt + image…"
```

It's a mixture-of-experts model (~3B active), so it's lighter to run than "30B" implies. It
won't fully fit 16 GB — Ollama auto-splits layers between GPU and system RAM. Check the split
with `ollama ps` (you'll see a GPU/CPU %). Expect **slower** tok/s than the 8B, but your 64 GB
RAM + 7800X3D make it genuinely usable. Compare critique quality against the 8B on the same
screenshots; if the bump isn't worth the latency, stay on 8B.

## 9. Verify you can run the whole pipeline at once

Revivify's standards gate spins up headless Chrome + Lighthouse (system RAM/CPU) while the
VLM sits in VRAM. Run a full `revivify check` (Chrome/Lighthouse) with `qwen3-vl:8b` loaded
and watch `nvidia-smi` (VRAM) + Task Manager (RAM). With 64 GB RAM and 16 threads they
co-exist comfortably — VRAM is the only hard ceiling and it's dedicated to the model.

## 10. How Revivify will call it (Node / TypeScript)

Revivify is Node/TS, so the design layer just POSTs to the local OpenAI-compatible endpoint —
no API key, `baseURL` pointed at Ollama:

```ts
// design layer — critique a screenshot against a rubric, locally
const imgB64 = (await readFile(screenshotPath)).toString("base64");

const res = await fetch("http://localhost:11434/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model: "qwen3-vl:8b",
    messages: [
      { role: "system", content: DESIGN_RUBRIC }, // stable rubric = cache-friendly
      {
        role: "user",
        content: [
          { type: "text", text: "Critique this landing page against the rubric. Cite each principle." },
          { type: "image_url", image_url: { url: `data:image/png;base64,${imgB64}` } },
          // later: add exemplar images here for grounding (§6 of the design-layer doc)
        ],
      },
    ],
    // ask for structured JSON so the cockpit can render findings
    // response_format: { type: "json_object" },  // supported by Ollama's OpenAI shim
    stream: false,
  }),
});
const critique = (await res.json()).choices[0].message.content;
```

Swapping `model` between `qwen3-vl:8b` and `:30b` (or, in Phase 2, a hosted model) is a
one-line change — the call shape is identical.

## 11. Gotchas (the ones that actually bite on Windows)

- **Env vars must be Windows-level, then restart Ollama.** Setting `OLLAMA_MODELS` /
  `OLLAMA_KEEP_ALIVE` / `OLLAMA_HOST` in a PowerShell session does **nothing** — the tray
  server already started and won't see them. Set them in System Environment Variables, then
  **quit Ollama from the tray and relaunch** (or reboot).
- **Firewall prompt on first server start** — allow it for local/private networks. The API is
  localhost-only by default; don't expose `:11434` publicly (that's a Phase-2 hosting concern
  with its own security conversation).
- **Disk fills up quietly.** 8B + 4B + 30B is tens of GB. Relocate the store (§2) if C: is
  tight; `ollama rm <model>` to reclaim space.
- **First call after idle is slow** — that's the model reloading into VRAM. Raise
  `OLLAMA_KEEP_ALIVE` during dev so it stays warm.
- **This is native, not npm** — none of your `npx.ps1` / npm execution-policy issues apply;
  `ollama` is a plain Windows executable.

## 12. Cleanup

```powershell
ollama list                 # what's installed
ollama rm qwen3-vl:30b      # remove a model to reclaim disk
```
Uninstall Ollama via Windows "Add or remove programs" if you want it gone entirely.

---

**Next:** prototype the taste-layer prompt/rubric on `qwen3-vl:8b` with a handful of
hand-picked exemplars for grounding, evaluate critique quality, then decide whether the 30B
MoE earns its latency. This whole loop is free and local — see
**[url-scanner-and-design-layer.md](url-scanner-and-design-layer.md)** §5–8 for where it fits.
