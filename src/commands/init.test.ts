import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runInit,
  renderConfig,
  renderGuardrails,
  renderPlan,
  CONFIG_FILENAME,
  GUARDRAILS_PATH,
  PLAN_PATH,
  CLAUDE_MD_PATH,
  DEFAULT_THRESHOLD,
  LIGHTHOUSE_CATEGORIES,
  RULE_GUIDANCE,
} from "./init.js";
import { rules as staticRules } from "../checks/registry.js";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "revivify-init-"));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// --- .revivify.yaml (config scaffold) ---

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

// --- rules pack + plan content ---

test("every live rule has non-empty guardrails guidance (pack can't drift from checks)", () => {
  for (const rule of staticRules) {
    const guidance = RULE_GUIDANCE[rule.id];
    assert.ok(guidance && guidance.trim().length > 0, `missing guardrails guidance for ${rule.id}`);
  }
});

test("renderGuardrails cites every live rule's standard and every category", () => {
  const pack = renderGuardrails();
  for (const rule of staticRules) {
    assert.ok(pack.includes(rule.title), `guardrails missing rule "${rule.title}"`);
    assert.ok(pack.includes(rule.standard), `guardrails missing standard "${rule.standard}"`);
  }
  for (const category of LIGHTHOUSE_CATEGORIES) {
    assert.ok(pack.includes(`**${category}**`), `guardrails missing category "${category}"`);
  }
});

test("renderPlan states the definition of done and the ship-ready bar", () => {
  const plan = renderPlan();
  assert.match(plan, /definition of done/i);
  assert.ok(plan.includes(`${DEFAULT_THRESHOLD}/10`), "plan should name the ship-ready bar");
});

// --- init writes the full scaffold ---

test("init scaffolds config, guardrails, plan, and a CLAUDE.md in a fresh project", async () => {
  const dir = await tempDir();
  try {
    const code = await runInit(dir, { force: false });
    assert.equal(code, 0);
    assert.equal(await readFile(join(dir, CONFIG_FILENAME), "utf8"), renderConfig());
    assert.equal(await readFile(join(dir, GUARDRAILS_PATH), "utf8"), renderGuardrails());
    assert.equal(await readFile(join(dir, PLAN_PATH), "utf8"), renderPlan());
    assert.ok(await exists(join(dir, CLAUDE_MD_PATH)), "CLAUDE.md should be created");
    // the generated CLAUDE.md points the agent at the guardrails
    assert.match(await readFile(join(dir, CLAUDE_MD_PATH), "utf8"), new RegExp(GUARDRAILS_PATH));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- non-destructive behavior ---

test("init is non-destructive: an existing config is left untouched without --force", async () => {
  const dir = await tempDir();
  try {
    const sentinel = "# hand-edited — do not clobber\nthreshold: 8\n";
    await writeFile(join(dir, CONFIG_FILENAME), sentinel, "utf8");

    const code = await runInit(dir, { force: false });
    assert.equal(code, 0);
    assert.equal(await readFile(join(dir, CONFIG_FILENAME), "utf8"), sentinel, "config should be preserved");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init never overwrites an existing CLAUDE.md — even with --force", async () => {
  const dir = await tempDir();
  try {
    const mine = "# My own project rules\nDo not touch this.\n";
    await writeFile(join(dir, CLAUDE_MD_PATH), mine, "utf8");

    await runInit(dir, { force: true });
    assert.equal(await readFile(join(dir, CLAUDE_MD_PATH), "utf8"), mine, "user's CLAUDE.md must be preserved");
    // the Revivify-owned guardrails/plan are still dropped alongside it
    assert.ok(await exists(join(dir, GUARDRAILS_PATH)), "guardrails should still be written");
    assert.ok(await exists(join(dir, PLAN_PATH)), "plan should still be written");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init --force regenerates the Revivify-owned files from the defaults", async () => {
  const dir = await tempDir();
  try {
    await writeFile(join(dir, CONFIG_FILENAME), "threshold: 8\n", "utf8");

    const code = await runInit(dir, { force: true });
    assert.equal(code, 0);
    assert.equal(await readFile(join(dir, CONFIG_FILENAME), "utf8"), renderConfig());
    assert.equal(await readFile(join(dir, GUARDRAILS_PATH), "utf8"), renderGuardrails());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
