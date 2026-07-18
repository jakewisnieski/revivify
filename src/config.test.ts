import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  parseConfig,
  loadConfig,
  loadIntent,
  CONFIG_FILENAME,
  INTENT_FILENAME,
  DEFAULT_THRESHOLD,
  DEFAULT_ENFORCEMENT,
} from "./config.js";

async function writeIntent(dir: string, text: string): Promise<void> {
  const file = join(dir, INTENT_FILENAME);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

test("parseConfig reads threshold and enforcement", () => {
  const config = parseConfig("threshold: 8\nenforcement: block\n");
  assert.equal(config.threshold, 8);
  assert.equal(config.enforcement, "block");
});

test("parseConfig ignores comments and trailing notes", () => {
  const source = "# threshold: 3 (a comment, not the value)\nthreshold: 9 # inline note\nenforcement: warn\n";
  const config = parseConfig(source);
  assert.equal(config.threshold, 9);
  assert.equal(config.enforcement, "warn");
});

test("parseConfig falls back to safe defaults for missing or invalid fields", () => {
  const missing = parseConfig("rules:\n  html-lang: true\n");
  assert.equal(missing.threshold, DEFAULT_THRESHOLD);
  assert.equal(missing.enforcement, DEFAULT_ENFORCEMENT);

  const invalid = parseConfig("threshold: nope\nenforcement: sometimes\n");
  assert.equal(invalid.threshold, DEFAULT_THRESHOLD);
  assert.equal(invalid.enforcement, DEFAULT_ENFORCEMENT);
});

test("loadConfig returns defaults when there is no config file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-config-"));
  try {
    const config = await loadConfig(dir);
    assert.equal(config.threshold, DEFAULT_THRESHOLD);
    assert.equal(config.enforcement, DEFAULT_ENFORCEMENT);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig reads a written config file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-config-"));
  try {
    await writeFile(join(dir, CONFIG_FILENAME), "threshold: 7\nenforcement: block\n", "utf8");
    const config = await loadConfig(dir);
    assert.equal(config.threshold, 7);
    assert.equal(config.enforcement, "block");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- the `accept:` map (your-call acceptances) ---

test("parseConfig reads the accept map, unwrapping quoted reasons", () => {
  const source = [
    "threshold: 10",
    "accept:",
    '  color-contrast: "brand palette; hero only"',
    "  some-rule: no quotes here",
    "",
  ].join("\n");
  const config = parseConfig(source);
  assert.deepEqual(config.accept, {
    "color-contrast": "brand palette; hero only",
    "some-rule": "no quotes here",
  });
});

test("parseConfig treats the scaffold's empty `accept: {}` as no acceptances", () => {
  assert.deepEqual(parseConfig("accept: {}\n").accept, {});
});

test("parseConfig returns an empty accept map when the block is absent", () => {
  assert.deepEqual(parseConfig("threshold: 9\n").accept, {});
});

test("parseConfig stops the accept block at the next top-level key", () => {
  const source = ["accept:", '  a-rule: "kept"', "threshold: 8", "enforcement: warn"].join("\n");
  const config = parseConfig(source);
  assert.deepEqual(config.accept, { "a-rule": "kept" });
  assert.equal(config.threshold, 8);
});

// --- page intent (.revivify/intent.md) ---

test("loadIntent returns undefined when there is no intent file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-intent-"));
  try {
    assert.equal(await loadIntent(dir), undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadIntent returns undefined for a whitespace-only file (optional by contract)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-intent-"));
  try {
    await writeIntent(dir, "   \n\n");
    assert.equal(await loadIntent(dir), undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadIntent returns the trimmed intent text when present", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-intent-"));
  try {
    await writeIntent(dir, "\nWaitlist page for a studio.\n");
    assert.equal(await loadIntent(dir), "Waitlist page for a studio.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadIntent treats an untouched scaffold (headings + hints only) as not yet filled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-intent-"));
  try {
    await writeIntent(dir, "# Page intent\n\n## What is this page for?\n<!-- e.g. a waitlist -->\n");
    assert.equal(await loadIntent(dir), undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadIntent keeps the user's own headings once they've written real prose", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-intent-"));
  try {
    const filled = "## What is this page for?\nWaitlist signup for a studio.\n";
    await writeIntent(dir, filled);
    assert.equal(await loadIntent(dir), filled.trim());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
