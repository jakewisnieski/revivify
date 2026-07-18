import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runInit,
  renderConfig,
  CONFIG_FILENAME,
  DEFAULT_THRESHOLD,
  LIGHTHOUSE_CATEGORIES,
} from "./init.js";
import { rules as staticRules } from "../checks/registry.js";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "revivify-init-"));
}

test("renderConfig sets the default ship-ready threshold", () => {
  assert.match(renderConfig(), new RegExp(`^threshold: ${DEFAULT_THRESHOLD}$`, "m"));
});

test("renderConfig lists a toggle for every live rule and Lighthouse category", () => {
  const config = renderConfig();
  for (const rule of staticRules) {
    assert.match(config, new RegExp(`^  ${rule.id}: true$`, "m"), `missing toggle for ${rule.id}`);
  }
  for (const category of LIGHTHOUSE_CATEGORIES) {
    assert.match(config, new RegExp(`^  ${category}: true$`, "m"), `missing toggle for ${category}`);
  }
});

test("init writes .revivify.yaml into a fresh project", async () => {
  const dir = await tempDir();
  try {
    const code = await runInit(dir, { force: false });
    assert.equal(code, 0);
    const written = await readFile(join(dir, CONFIG_FILENAME), "utf8");
    assert.equal(written, renderConfig());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init is non-destructive: an existing config is left untouched without --force", async () => {
  const dir = await tempDir();
  try {
    const sentinel = "# hand-edited — do not clobber\nthreshold: 8\n";
    await writeFile(join(dir, CONFIG_FILENAME), sentinel, "utf8");

    const code = await runInit(dir, { force: false });
    assert.equal(code, 0);
    const after = await readFile(join(dir, CONFIG_FILENAME), "utf8");
    assert.equal(after, sentinel, "existing config should be preserved");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init --force regenerates an existing config from the defaults", async () => {
  const dir = await tempDir();
  try {
    await writeFile(join(dir, CONFIG_FILENAME), "threshold: 8\n", "utf8");

    const code = await runInit(dir, { force: true });
    assert.equal(code, 0);
    const after = await readFile(join(dir, CONFIG_FILENAME), "utf8");
    assert.equal(after, renderConfig());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
