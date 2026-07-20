/**
 * Design-layer prototype — grounded critique.
 *
 * Proves the taste-layer loop end to end, with NO hand-fed measurements:
 *   1. Launch headless Chrome at the page (chrome-launcher — already a dep).
 *   2. Over the DevTools protocol (Node's built-in WebSocket, no new deps),
 *      read REAL computed styles and compute actual WCAG contrast ratios.
 *   3. Capture a full-page screenshot.
 *   4. Inject those measured facts into the critique prompt and send the
 *      screenshot to a local vision model (Ollama Qwen3-VL 8B).
 *
 * Optional exemplar grounding: pass one or more "good" reference pages with
 * --exemplar <pathOrUrl>; their screenshots are shown to the model as
 * references of strong execution (see docs/explorations/taste-layer-experiments.md).
 *
 *   node --import tsx prototypes/design-critique.ts [pathOrUrl] [--exemplar <ref> ...]
 *
 * Defaults to demo-site/index.html. Model/host via OLLAMA_MODEL / OLLAMA_HOST.
 */
import * as chromeLauncher from "chrome-launcher";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

const OLLAMA = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3-vl:8b";

const argv = process.argv.slice(2);
const exemplars: string[] = [];
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--exemplar") exemplars.push(argv[++i]);
  else positional.push(argv[i]);
}
const toUrl = (a: string) => (/^https?:\/\//i.test(a) ? a : pathToFileURL(resolve(a)).href);
const targetUrl = toUrl(positional[0] ?? "demo-site/index.html");

/** Minimal CDP client over the built-in WebSocket. */
function cdp(wsUrl: string) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map<number, { res: (v: any) => void; rej: (e: any) => void }>();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data as string);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)!;
      pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  });
  const ready = new Promise<void>((r) => ws.addEventListener("open", () => r()));
  const send = (method: string, params: any = {}) =>
    new Promise<any>((res, rej) => {
      const _id = ++id;
      pending.set(_id, { res, rej });
      ws.send(JSON.stringify({ id: _id, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

/**
 * Runs IN the page: read computed styles + compute real WCAG contrast ratios.
 * Kept as a plain JS string (not a transpiled function's .toString()) so esbuild
 * helpers never leak into the injected code.
 */
const EXTRACT_JS = `(() => {
  const css = (el) => getComputedStyle(el);
  const px = (s) => Math.round(parseFloat(s));
  const lum = (rgb) => {
    const m = (rgb.match(/[\\d.]+/g) || []).map(Number);
    const [r,g,b] = m.slice(0,3).map((v) => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const contrast = (fg,bg) => { const a=lum(fg), b=lum(bg); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); };
  const bgOf = (el) => { let e=el; while(e){ const c=css(e).backgroundColor; if(c && !/rgba?\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; e=e.parentElement; } return "rgb(255, 255, 255)"; };
  const q = (s) => document.querySelector(s);
  const r1 = (n) => Math.round(n*10)/10;
  const isCta = (t) => /access|start|join|get|sign|buy|waitlist|try|subscribe|shop/i.test(t);

  const facts = { viewportWidth: window.innerWidth };
  const body = document.body, bs = css(body), bbg = bgOf(body);
  facts.body = { fontSizePx: px(bs.fontSize), lineHeight: bs.lineHeight, contrast: r1(contrast(bs.color, bbg)) };

  const h1 = q("h1");
  if (h1) { const s = css(h1); facts.h1 = { text: (h1.textContent||"").trim().slice(0,60), fontSizePx: px(s.fontSize), weight: s.fontWeight, contrast: r1(contrast(s.color, bgOf(h1))) }; }
  const h2 = q("h2"); if (h2) facts.h2FontSizePx = px(css(h2).fontSize);

  // Primary CTA: prefer the hero's primary button, else the largest CTA-ish primary/button by font-size.
  const primaryEls = [...document.querySelectorAll(".btn-primary, button, a.btn")];
  const heroCta = q(".hero .btn-primary") || q("[class*=hero] .btn-primary")
    || primaryEls.filter((b) => isCta((b.textContent||"").trim())).sort((a,b) => parseFloat(css(b).fontSize) - parseFloat(css(a).fontSize))[0]
    || primaryEls[0] || null;
  if (heroCta) {
    const s = css(heroCta);
    const filled = !/rgba?\\(0, 0, 0, 0\\)|transparent/.test(s.backgroundColor);
    facts.primaryCta = { text: (heroCta.textContent||"").trim().slice(0,40), fontSizePx: px(s.fontSize), styledAsButton: filled && s.borderRadius!=="0px", contrast: filled ? r1(contrast(s.color, s.backgroundColor)) : null };
    const row = heroCta.parentElement;
    if (row) { const cg = css(row).columnGap, g = (cg && cg !== "normal") ? cg : css(row).gap; if (g && g !== "normal") facts.heroCtaGapPx = px(g); }
  }

  // Distinct CTAs across the page (deduped) — surfaces conflicting calls-to-action.
  facts.ctaTexts = [...new Set([...document.querySelectorAll(".btn, button, a")].map((a) => (a.textContent||"").trim()).filter(isCta))].slice(0,10);

  // Section vertical padding rhythm.
  const secs = [...document.querySelectorAll("section, .hero, .features, .pricing, .reviews, .signup")].slice(0,10);
  const pads = secs.map((s) => px(css(s).paddingTop)).filter((n) => n > 0);
  if (pads.length) facts.sectionPaddingTopPx = { min: Math.min(...pads), max: Math.max(...pads) };

  // Minimum text contrast on the page.
  let min = 99;
  for (const el of [...document.querySelectorAll("h1,h2,h3,p,a,li,span")].slice(0,150)) { if(!(el.textContent||"").trim()) continue; const c=contrast(css(el).color, bgOf(el)); if(c<min) min=c; }
  facts.minTextContrast = r1(min);
  return facts;
})()`;

/** Turn the extracted facts into the authoritative MEASURED FACTS block. */
function factsBlock(f: any): string {
  const lines: string[] = [];
  if (f.body) lines.push(`- Body text: ${f.body.fontSizePx}px, line-height ${f.body.lineHeight}, contrast ~${f.body.contrast}:1 on its background.`);
  if (f.h1) lines.push(`- Hero headline "${f.h1.text}": ${f.h1.fontSizePx}px, weight ${f.h1.weight}, contrast ~${f.h1.contrast}:1.`);
  if (f.h2FontSizePx) lines.push(`- Section headings: ~${f.h2FontSizePx}px.`);
  if (f.primaryCta) {
    const c = f.primaryCta;
    lines.push(`- Primary (hero) CTA "${c.text}": ${c.fontSizePx}px, ${c.styledAsButton ? "a FILLED styled button" : "NOT styled as a button (plain text/link)"}${c.contrast ? `, text contrast ~${c.contrast}:1` : ""}.`);
  }
  if (f.heroCtaGapPx != null) lines.push(`- Gap between the hero CTA and the adjacent link: ${f.heroCtaGapPx}px.`);
  if (f.sectionPaddingTopPx) lines.push(`- Section vertical padding ranges ${f.sectionPaddingTopPx.min}–${f.sectionPaddingTopPx.max}px.`);
  lines.push(`- Distinct calls-to-action on the page: ${f.ctaTexts.map((t: string) => `"${t}"`).join(", ") || "none detected"}.`);
  lines.push(`- Lowest text contrast anywhere on the page: ~${f.minTextContrast}:1 (WCAG AA minimum is 4.5:1${f.minTextContrast >= 4.5 ? " — passes" : " — FAILS"}).`);
  return lines.join("\n");
}

const RUBRIC = `You are a senior landing-page design critic shown a screenshot of a rendered landing page. Give a concise, specific, honest critique for the page's OWNER (a non-developer). For each finding, name the design principle behind it.
Evaluate: visual hierarchy; typography; spacing/whitespace; colour & contrast; CTA & conversion; overall impression.
Rules: Be specific to THIS page - refer to elements you actually see. At most 5 prioritised recommendations (what to change / the principle / the expected effect). Note what works. End with a one-line verdict.
{EXEMPLARS}
MEASURED FACTS (authoritative - the page's REAL computed values, measured from the DOM; use ONLY these numbers, do not invent others; if a fact contradicts what you think you see, trust the fact):
{FACTS}

Extra rules: Do NOT invent or estimate any pixel sizes, contrast ratios, or spacing values - the MEASURED FACTS are the only numbers you may cite. Focus on what the facts do NOT settle: layout, hierarchy, messaging/copy consistency, emphasis, conversion logic.`;

/** Launch Chrome at a URL, extract facts + capture a full-page screenshot, clean up. */
async function capture(url: string): Promise<{ facts: any; shot: string }> {
  const chrome = await chromeLauncher.launch({
    startingUrl: url,
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1280,1600"],
  });
  try {
    let wsUrl = "";
    for (let i = 0; i < 25 && !wsUrl; i++) {
      const targets = await (await fetch(`http://127.0.0.1:${chrome.port}/json/list`)).json();
      wsUrl = targets.find((t: any) => t.type === "page")?.webSocketDebuggerUrl ?? "";
      if (!wsUrl) await new Promise((r) => setTimeout(r, 200));
    }
    if (!wsUrl) throw new Error("no Chrome page target found");
    const c = cdp(wsUrl);
    await c.ready;
    await c.send("Page.enable");
    await c.send("Runtime.enable");
    await new Promise((r) => setTimeout(r, 1500)); // let the page settle/render

    const evalRes = await c.send("Runtime.evaluate", { expression: EXTRACT_JS, returnByValue: true });
    if (evalRes.exceptionDetails) throw new Error("page eval failed: " + (evalRes.exceptionDetails.exception?.description ?? evalRes.exceptionDetails.text));
    const facts = evalRes.result.value;

    const metrics = await c.send("Page.getLayoutMetrics");
    const h = Math.min(Math.ceil((metrics.cssContentSize ?? metrics.contentSize).height), 6000);
    const shot = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: facts.viewportWidth || 1280, height: h, scale: 1 } });
    c.close();
    return { facts, shot: shot.data };
  } finally {
    // chrome-launcher's temp-dir cleanup throws EPERM on Windows; the work is done, so ignore it.
    try { chrome.kill(); } catch { /* ignore Chrome cleanup errors */ }
  }
}

async function main() {
  process.stderr.write(`Capturing target: ${targetUrl}\n`);
  const target = await capture(targetUrl);

  // Optional exemplar reference screenshots.
  const exemplarShots: string[] = [];
  for (const ex of exemplars) {
    const u = toUrl(ex);
    process.stderr.write(`Capturing exemplar: ${u}\n`);
    exemplarShots.push((await capture(u)).shot);
  }

  const shotPath = resolve("prototypes/.last-critique-shot.png");
  await writeFile(shotPath, Buffer.from(target.shot, "base64"));

  const measured = factsBlock(target.facts);
  process.stdout.write(`\n===== AUTO-EXTRACTED FACTS (from the live DOM) =====\n${JSON.stringify(target.facts, null, 2)}\n`);
  process.stdout.write(`\n===== MEASURED FACTS injected into the prompt =====\n${measured}\n`);

  const exemplarNote = exemplarShots.length
    ? `\nThe FIRST ${exemplarShots.length} image(s) are REFERENCE exemplars — strong, high-performing landing pages shown only as a bar for comparison. The LAST image is the page under review. Judge the last image; use the exemplars to calibrate what "good" looks like, not to copy them.\n`
    : "\n";
  const images = [...exemplarShots, target.shot]; // exemplars first, target last

  process.stderr.write(`\nAsking ${MODEL} for a grounded critique${exemplarShots.length ? ` (with ${exemplarShots.length} exemplar(s))` : ""}…\n`);
  const t = Date.now();
  const resp = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      keep_alive: "20s", // drop out of VRAM soon after — keeps the machine responsive
      options: { num_ctx: 8192, temperature: 0.3 },
      messages: [
        { role: "system", content: RUBRIC.replace("{EXEMPLARS}", exemplarNote).replace("{FACTS}", measured) },
        { role: "user", content: "Critique the landing page under review for its owner.", images },
      ],
    }),
  });
  const out = await resp.json();
  process.stdout.write(`\n===== GROUNDED CRITIQUE (${MODEL}) =====\n${out.message?.content ?? JSON.stringify(out)}\n`);
  const tps = out.eval_count && out.eval_duration ? (out.eval_count / (out.eval_duration / 1e9)).toFixed(0) : "?";
  process.stdout.write(`\n[ ${((Date.now() - t) / 1000).toFixed(0)}s | ${out.eval_count ?? "?"} out tok @ ${tps} tok/s | screenshot: ${shotPath} ]\n`);
}

main().catch((e) => { process.stderr.write(`\n✖ ${e?.message ?? e}\n`); process.exit(1); });
