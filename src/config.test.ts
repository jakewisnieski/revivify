import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  parseConfig,
  loadConfig,
  loadIntent,
  writeAccept,
  upsertAccept,
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

// --- the `rules:` / `categories:` toggle blocks (M5.3 / FR-10) ---

test("parseConfig reads rules and categories toggles", () => {
  const source = [
    "threshold: 10",
    "rules:",
    "  html-lang: true",
    "  meta-description: false",
    "categories:",
    "  performance: true",
    "  seo: false",
    "accept: {}",
    "",
  ].join("\n");
  const config = parseConfig(source);
  assert.equal(config.rules?.["html-lang"], true);
  assert.equal(config.rules?.["meta-description"], false);
  assert.equal(config.categories?.["performance"], true);
  assert.equal(config.categories?.["seo"], false);
});

test("parseConfig treats a garbled toggle as its default (on) by omitting it", () => {
  const config = parseConfig("rules:\n  html-lang: maybe\n  img-alt: false\n");
  assert.equal(config.rules?.["html-lang"], undefined); // non-boolean → left at default
  assert.equal(config.rules?.["img-alt"], false);
});

test("parseConfig yields empty toggle maps for an inline or absent block", () => {
  const inline = parseConfig("rules: {}\ncategories: {}\n");
  assert.deepEqual(inline.rules, {});
  assert.deepEqual(inline.categories, {});

  const absent = parseConfig("threshold: 10\n");
  assert.deepEqual(absent.rules, {});
  assert.deepEqual(absent.categories, {});
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

// --- writing acceptances (the cockpit Accept control, M4.6) ---

test("writeAccept turns the scaffold's `accept: {}` into a block and preserves other keys", () => {
  const out = writeAccept("threshold: 10\nenforcement: warn\naccept: {}\n", "noindex", "staging site");
  const cfg = parseConfig(out);
  assert.equal(cfg.accept?.noindex, "staging site");
  assert.equal(cfg.threshold, 10); // untouched
  assert.equal(cfg.enforcement, "warn"); // untouched
});

test("writeAccept appends an accept block when none exists, keeping existing keys", () => {
  const out = writeAccept("threshold: 8\n", "noindex", "reason");
  assert.deepEqual(parseConfig(out).accept, { noindex: "reason" });
  assert.equal(parseConfig(out).threshold, 8);
});

test("writeAccept adds to an existing block without dropping other acceptances", () => {
  const src = 'accept:\n  color-contrast: "brand"\nthreshold: 10\n';
  const cfg = parseConfig(writeAccept(src, "noindex", "staging"));
  assert.deepEqual(cfg.accept, { "color-contrast": "brand", noindex: "staging" });
  assert.equal(cfg.threshold, 10);
});

test("writeAccept updates an existing acceptance in place (no duplicate)", () => {
  const out = writeAccept('accept:\n  noindex: "old"\n', "noindex", "new reason");
  assert.deepEqual(parseConfig(out).accept, { noindex: "new reason" });
  assert.equal((out.match(/noindex:/g) ?? []).length, 1);
});

test("writeAccept sanitises quotes and newlines so the reason round-trips", () => {
  const out = writeAccept("accept: {}\n", "noindex", 'has "quotes"\nand a newline');
  assert.equal(parseConfig(out).accept?.noindex, "has 'quotes' and a newline");
});

test("upsertAccept writes the acceptance to disk, preserving the rest of the config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-accept-"));
  try {
    await writeFile(join(dir, CONFIG_FILENAME), "threshold: 10\nenforcement: warn\naccept: {}\n", "utf8");
    await upsertAccept(dir, "noindex", "staging site — hidden until launch");
    const cfg = await loadConfig(dir);
    assert.equal(cfg.accept?.noindex, "staging site — hidden until launch");
    assert.equal(cfg.threshold, 10);
    assert.equal(cfg.enforcement, "warn");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
