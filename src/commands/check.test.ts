import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { check } from "./check.js";
import { CONFIG_FILENAME, INTENT_FILENAME } from "../config.js";

const HTML = `<!doctype html><html lang="en"><head><title>Hi</title></head><body><h1>Hi</h1></body></html>`;

/** Build a throwaway project dir seeded with the given relative files. */
async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "revivify-check-"));
  for (const [rel, content] of Object.entries(files)) {
    const file = join(dir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, "utf8");
  }
  return dir;
}

test("check surfaces captured intent and your-call acceptances (fast mode)", async () => {
  const dir = await project({
    "index.html": HTML,
    [INTENT_FILENAME]: "Waitlist page for a design studio.",
    [CONFIG_FILENAME]: 'threshold: 10\naccept:\n  color-contrast: "brand palette; hero only"\n',
  });
  try {
    const out = await check(dir, { mode: "fast" });
    assert.equal(out.intent, "Waitlist page for a design studio.");
    assert.deepEqual(out.accept, { "color-contrast": "brand palette; hero only" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("check leaves intent/accept unset when the project has neither (they stay optional)", async () => {
  const dir = await project({ "index.html": HTML });
  try {
    const out = await check(dir, { mode: "fast" });
    assert.equal(out.intent, undefined);
    assert.equal(out.accept, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
