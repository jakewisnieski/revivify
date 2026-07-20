import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAuditTarget } from "./lighthouse.js";

const HTML = `<!doctype html><html lang="en"><body><h1>Served</h1></body></html>`;

test("prepareAuditTarget audits a URL directly — no loopback server", async () => {
  const target = await prepareAuditTarget("https://example.com/landing");
  // Lighthouse points straight at the URL; nothing is served locally.
  assert.equal(target.url, "https://example.com/landing");
  // close() is a no-op that resolves (there's no server to shut down).
  await target.close();
});

test("prepareAuditTarget serves a local build over loopback and cleans up", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-lh-"));
  await writeFile(join(dir, "index.html"), HTML, "utf8");
  const target = await prepareAuditTarget(dir);
  try {
    assert.match(target.url, /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/);
    // The loopback server actually serves the page while it's open.
    const body = await (await fetch(target.url)).text();
    assert.match(body, /Served/);
  } finally {
    await target.close();
    await rm(dir, { recursive: true, force: true });
  }
  // After close(), the server is down — a fetch now fails to connect.
  await assert.rejects(() => fetch(target.url));
});
