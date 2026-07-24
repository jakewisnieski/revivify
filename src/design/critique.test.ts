import { test } from "node:test";
import assert from "node:assert/strict";
import {
  critique,
  resolveDesignEndpoint,
  createSingleFlight,
  type DesignEndpoint,
  type FetchLike,
  type CritiqueOptions,
} from "./critique.js";
import type { PageCapture } from "./measure.js";
import { scoreFindings } from "../score.js";
import type { Finding } from "../checks/types.js";

// --- fixtures --------------------------------------------------------------

const ENDPOINT: DesignEndpoint = { url: "https://tunnel.example", token: "secret-token", model: "qwen3-vl:8b" };

function capture(): PageCapture {
  return {
    facts: {
      target: "demo-site/index.html",
      viewportWidthPx: 1280,
      body: { fontSizePx: 17, lineHeight: "27.2px", contrast: 15.4 },
      h1: { text: "Plants that forgive you", fontSizePx: 58, weight: "700", contrast: 15.4 },
      primaryCta: { text: "Join the waitlist", fontSizePx: 16, styledAsButton: true, contrast: 9.4 },
      ctaTexts: ["Get early access", "Join the waitlist", "Start with one plant"],
      minTextContrast: 9,
      visual: {
        authorStyleSheets: 1,
        bodyFontFamily: "Inter, system-ui, sans-serif",
        defaultSerifBody: false,
        usesLayoutContainers: true,
        contentImageCount: 3,
        heroHasImage: true,
        looksUnstyled: false,
      },
    },
    screenshot: "BASE64SCREENSHOTDATA",
  };
}

/** A fetch that returns a canned Ollama chat reply and records the request. */
function fakeModel(content: string): { fetchImpl: FetchLike; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ message: { content } }), { status: 200 });
  };
  return { fetchImpl, calls };
}

const opts = (extra: CritiqueOptions): CritiqueOptions => ({ endpoint: ENDPOINT, ...extra });

// --- endpoint resolution (config/env; no secrets in repo) ------------------

test("resolveDesignEndpoint reads url/token/model from env, trimming a trailing slash", () => {
  const ep = resolveDesignEndpoint({
    REVIVIFY_DESIGN_ENDPOINT: "https://tunnel.example/",
    REVIVIFY_DESIGN_TOKEN: "tok",
    REVIVIFY_DESIGN_MODEL: "qwen3-vl:8b",
  } as NodeJS.ProcessEnv);
  assert.deepEqual(ep, { url: "https://tunnel.example", token: "tok", model: "qwen3-vl:8b" });
});

test("resolveDesignEndpoint returns null when nothing is configured (safe default)", () => {
  assert.equal(resolveDesignEndpoint({} as NodeJS.ProcessEnv), null);
});

test("resolveDesignEndpoint falls back to OLLAMA_* and the default model", () => {
  const ep = resolveDesignEndpoint({ OLLAMA_HOST: "http://localhost:11434" } as NodeJS.ProcessEnv);
  assert.equal(ep?.url, "http://localhost:11434");
  assert.equal(ep?.token, undefined); // no token env → unauthenticated (local dev)
  assert.equal(ep?.model, "qwen3-vl:8b");
});

// --- happy path: grounded, tiered, deterministic-first ---------------------

test("critique returns deterministic findings first, then model opinion", async () => {
  const { fetchImpl } = fakeModel("- The hero could use a stronger focal point.\n- Nice cohesive palette.");
  const advisory = await critique(capture(), opts({ fetchImpl }));

  assert.equal(advisory.status, "available");
  if (advisory.status !== "available") return;
  assert.equal(advisory.model, "qwen3-vl:8b");

  // deterministic tier-1/2 spine leads; tier-3 opinion trails
  const tiers = advisory.findings.map((f) => f.tier);
  const firstOpinion = tiers.indexOf(3);
  assert.ok(firstOpinion > 0, "opinion should not lead");
  assert.ok(tiers.slice(0, firstOpinion).every((t) => t !== 3), "deterministic findings lead");
  assert.ok(tiers.slice(firstOpinion).every((t) => t === 3), "opinion trails");

  // the competing-CTA catch is present and grounded in the real CTA list
  assert.match(advisory.findings[0].title, /competing calls-to-action/);

  // #31 invariant across the whole advisory: opinion is never cited
  for (const f of advisory.findings) {
    if (f.tier === 3) assert.equal(f.citation, null);
    else assert.ok(f.citation);
  }
});

test("critique sends the screenshot and grounded prompt to the model", async () => {
  const { fetchImpl, calls } = fakeModel("- ok");
  await critique(capture(), opts({ fetchImpl }));
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/chat$/);
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.model, "qwen3-vl:8b");
  assert.deepEqual(body.messages[1].images, ["BASE64SCREENSHOTDATA"]); // vision input attached
  assert.match(body.messages[0].content, /MEASURED FACTS/); // grounded system prompt
});

// --- S3 auth: token gating -------------------------------------------------

test("critique sends the bearer token as an Authorization header", async () => {
  const { fetchImpl, calls } = fakeModel("- ok");
  await critique(capture(), opts({ fetchImpl }));
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer secret-token");
});

test("critique omits the Authorization header when no token is configured", async () => {
  const { fetchImpl, calls } = fakeModel("- ok");
  await critique(capture(), opts({ endpoint: { url: "https://x", model: "m" }, fetchImpl }));
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.authorization, undefined);
});

test("critique degrades to unavailable on 401 unauthorized (S3 without the token)", async () => {
  const fetchImpl: FetchLike = async () => new Response("no", { status: 401 });
  const advisory = await critique(capture(), opts({ fetchImpl }));
  assert.equal(advisory.status, "unavailable");
  if (advisory.status !== "unavailable") return;
  assert.match(advisory.reason, /unauthorized/);
});

// --- S2 degrade: unconfigured / down / timeout / empty ---------------------

test("critique is unavailable when the endpoint is unconfigured", async () => {
  const advisory = await critique(capture(), { endpoint: null });
  assert.equal(advisory.status, "unavailable");
  if (advisory.status !== "unavailable") return;
  assert.match(advisory.reason, /not configured/);
});

test("critique degrades to unavailable when the endpoint is unreachable", async () => {
  const fetchImpl: FetchLike = async () => {
    throw new Error("ECONNREFUSED");
  };
  const advisory = await critique(capture(), opts({ fetchImpl }));
  assert.equal(advisory.status, "unavailable");
  if (advisory.status !== "unavailable") return;
  assert.match(advisory.reason, /unavailable/);
});

test("critique degrades to unavailable on timeout (aborts the request)", async () => {
  const hangingFetch: FetchLike = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  const advisory = await critique(capture(), opts({ fetchImpl: hangingFetch, timeoutMs: 10 }));
  assert.equal(advisory.status, "unavailable");
  if (advisory.status !== "unavailable") return;
  assert.match(advisory.reason, /timed out/);
});

test("critique degrades to unavailable on an empty critique", async () => {
  const { fetchImpl } = fakeModel("   ");
  const advisory = await critique(capture(), opts({ fetchImpl }));
  assert.equal(advisory.status, "unavailable");
});

// --- single-flight: one 8B on one GPU serializes ---------------------------

test("createSingleFlight runs tasks one at a time", async () => {
  const run = createSingleFlight();
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let active = 0;
  let maxActive = 0;
  const task = async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await delay(5);
    active--;
    return "ok";
  };
  const results = await Promise.all([run(task), run(task), run(task)]);
  assert.deepEqual(results, ["ok", "ok", "ok"]);
  assert.equal(maxActive, 1); // never two critiques hitting the GPU at once
});

test("createSingleFlight survives a rejection without poisoning the chain", async () => {
  const run = createSingleFlight();
  await assert.rejects(run(() => Promise.reject(new Error("boom"))));
  assert.equal(await run(() => Promise.resolve("after")), "after");
});

test("overlapping critiques serialize through the shared single-flight", async () => {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let active = 0;
  let maxActive = 0;
  const fetchImpl: FetchLike = async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await delay(5);
    active--;
    return new Response(JSON.stringify({ message: { content: "- ok" } }), { status: 200 });
  };
  const run = createSingleFlight();
  await Promise.all([
    critique(capture(), opts({ fetchImpl, singleFlight: run })),
    critique(capture(), opts({ fetchImpl, singleFlight: run })),
  ]);
  assert.equal(maxActive, 1);
});

// --- score isolation (#31): the design layer never touches the score -------

function objectiveFindings(): Finding[] {
  return [
    { id: "html-lang", title: "Lang", standard: "WCAG", learnMore: "http://x", verdict: "pass", triage: "well-fix-it", detail: "" },
    { id: "title", title: "Title", standard: "SEO", learnMore: "http://x", verdict: "fail", triage: "well-fix-it", detail: "" },
  ];
}

test("a critique (even a failing one) leaves the deterministic score untouched", async () => {
  const findings = objectiveFindings();
  const before = scoreFindings(findings);

  const cap = capture();
  const snapshot = JSON.stringify(cap);
  const fetchImpl: FetchLike = async () => {
    throw new Error("model exploded");
  };
  const advisory = await critique(cap, opts({ fetchImpl }));

  assert.equal(advisory.status, "unavailable"); // design layer failed…
  assert.deepEqual(scoreFindings(findings), before); // …score is byte-for-byte identical
  assert.equal(JSON.stringify(cap), snapshot); // critique didn't mutate its input
});
