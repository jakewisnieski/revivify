import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, mkdir, access } from "node:fs/promises";
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
  CLAUDE_SETTINGS_PATH,
  HOOK_COMMAND,
  DEFAULT_THRESHOLD,
  LIGHTHOUSE_CATEGORIES,
  RULE_GUIDANCE,
} from "./init.js";
import { DEFAULT_ENFORCEMENT } from "../config.js";
import { rules as staticRules } from "../checks/registry.js";

function stopHookCommands(settings: string): string[] {
  const parsed = JSON.parse(settings) as {
    hooks?: { Stop?: Array<{ hooks?: Array<{ command?: string }> }> };
  };
  return (parsed.hooks?.Stop ?? []).flatMap((g) => (g.hooks ?? []).map((h) => h.command ?? ""));
}

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

test("renderConfig sets the default enforcement mode", () => {
  assert.match(renderConfig(), new RegExp(`^enforcement: ${DEFAULT_ENFORCEMENT}$`, "m"));
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

// --- the "done" gate hook install ---

test("init installs the Stop gate hook into .claude/settings.json", async () => {
  const dir = await tempDir();
  try {
    await runInit(dir, { force: false });
    const settings = await readFile(join(dir, CLAUDE_SETTINGS_PATH), "utf8");
    assert.ok(stopHookCommands(settings).includes(HOOK_COMMAND), "gate hook should be installed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init is idempotent: re-running never duplicates the gate hook", async () => {
  const dir = await tempDir();
  try {
    await runInit(dir, { force: false });
    await runInit(dir, { force: false });
    const settings = await readFile(join(dir, CLAUDE_SETTINGS_PATH), "utf8");
    const ours = stopHookCommands(settings).filter((c) => c === HOOK_COMMAND);
    assert.equal(ours.length, 1, "the gate hook should appear exactly once");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init merges the hook into existing settings without disturbing them", async () => {
  const dir = await tempDir();
  try {
    const claudeDir = join(dir, ".claude");
    await mkdir(claudeDir, { recursive: true });
    const existing = {
      permissions: { allow: ["Bash(ls:*)"] },
      hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
    };
    await writeFile(join(claudeDir, "settings.json"), JSON.stringify(existing, null, 2), "utf8");

    await runInit(dir, { force: false });

    const parsed = JSON.parse(await readFile(join(dir, CLAUDE_SETTINGS_PATH), "utf8"));
    assert.deepEqual(parsed.permissions.allow, ["Bash(ls:*)"], "unrelated settings preserved");
    const commands = stopHookCommands(JSON.stringify(parsed));
    assert.ok(commands.includes("echo mine"), "existing hook preserved");
    assert.ok(commands.includes(HOOK_COMMAND), "gate hook added alongside");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
