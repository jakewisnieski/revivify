import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseConfig,
  loadConfig,
  CONFIG_FILENAME,
  DEFAULT_THRESHOLD,
  DEFAULT_ENFORCEMENT,
} from "./config.js";

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
