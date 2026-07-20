import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPage } from "./loadPage.js";

const HTML = `<!doctype html><html lang="en"><head><title>Hi</title></head><body><h1>Live</h1></body></html>`;

/** Swap in a fake global fetch for the duration of a test, then restore it. */
async function withFetch(fake: typeof fetch, fn: () => Promise<void>): Promise<void> {
  const real = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
}

const htmlResponse = () =>
  new Response(HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

test("loadPage still reads a local file and parses it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-loadpage-"));
  const file = join(dir, "index.html");
  await writeFile(file, HTML, "utf8");
  try {
    const page = await loadPage(dir);
    assert.equal(page.path, file);
    assert.equal(page.root.querySelector("h1")?.text, "Live");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadPage fetches a URL and returns it as the page path", async () => {
  await withFetch(async () => htmlResponse(), async () => {
    const page = await loadPage("https://example.com/landing");
    assert.equal(page.path, "https://example.com/landing");
    assert.equal(page.html, HTML);
    assert.equal(page.root.querySelector("h1")?.text, "Live");
  });
});

test("loadPage fails honestly on a non-2xx response (never a fake page)", async () => {
  await withFetch(
    async () => new Response("nope", { status: 404 }),
    async () => {
      await assert.rejects(() => loadPage("https://example.com/missing"), /HTTP 404/);
    },
  );
});

test("loadPage refuses non-HTML content (a file or API, not a landing page)", async () => {
  await withFetch(
    async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    async () => {
      await assert.rejects(() => loadPage("https://example.com/data.json"), /not an HTML page/);
    },
  );
});

test("loadPage reports an unreachable host clearly", async () => {
  await withFetch(
    async () => {
      throw new TypeError("fetch failed");
    },
    async () => {
      await assert.rejects(() => loadPage("https://nope.invalid"), /Couldn't reach/);
    },
  );
});
