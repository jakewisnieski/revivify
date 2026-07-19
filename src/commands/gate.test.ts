import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideGate, runGate, type CheckFn } from "./gate.js";
import type { Score } from "../score.js";
import type { RevivifyConfig } from "../config.js";
import type { CheckOutput } from "../report/types.js";
import type { Finding } from "../checks/types.js";
import { CONFIG_FILENAME } from "../config.js";

function score(outOfTen: number, shipReady = outOfTen >= 10): Score {
  return { passing: outOfTen, applicable: 10, outOfTen, shipReady, yourCall: [] };
}

const warn: RevivifyConfig = { threshold: 10, enforcement: "warn" };
const block: RevivifyConfig = { threshold: 10, enforcement: "block" };

test("a page that clears the bar is never blocked, in either mode", () => {
  assert.deepEqual(decideGate(score(10), warn), { blocked: false, exitCode: 0 });
  assert.deepEqual(decideGate(score(10), block), { blocked: false, exitCode: 0 });
});

test("warn mode nudges but never blocks a below-bar page", () => {
  const decision = decideGate(score(7), warn);
  assert.equal(decision.blocked, false);
  assert.equal(decision.exitCode, 0);
});

test("block mode stops a below-bar page with exit code 2", () => {
  const decision = decideGate(score(7), block);
  assert.equal(decision.blocked, true);
  assert.equal(decision.exitCode, 2);
});

test("a lowered threshold lets a partial score through", () => {
  const config: RevivifyConfig = { threshold: 8, enforcement: "block" };
  assert.equal(decideGate(score(8), config).blocked, false);
  assert.equal(decideGate(score(7), config).blocked, true);
});

// --- end-to-end runGate: real config read + mode select + decide + exit code ---
//
// runGate in block mode runs the full Lighthouse audit (Chrome, ~30–45s) — too
// heavy and flaky for CI. So these e2e tests keep everything real (config read
// from disk, the block→full mode select, decideGate, the rendered nudge, and the
// returned exit code) and inject a deterministic audit in place of the browser,
// so the block-mode exit-code CONTRACT can't silently regress in fast CI.

/** A finding that fails an objective check, for the block-mode nudge to surface. */
function failing(id: string, title: string): Finding {
  return { id, title, standard: "WCAG 2.2 — x", learnMore: "https://x.test", verdict: "fail", triage: "well-fix-it", detail: "d", fix: "f" };
}

/** An injected audit that always returns the given output, recording the mode it was asked for. */
function fakeCheck(out: CheckOutput): { fn: CheckFn; modes: string[] } {
  const modes: string[] = [];
  const fn: CheckFn = async (_dir, options) => {
    modes.push(options.mode);
    return out;
  };
  return { fn, modes };
}

/** Run runGate while capturing what it writes to stderr (the human nudge). Omit `check` to use the real audit. */
async function runGateCapturingStderr(dir: string, check?: CheckFn): Promise<{ code: number; stderr: string }> {
  const chunks: string[] = [];
  const original = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    const code = await runGate(dir, check);
    return { code, stderr: chunks.join("") };
  } finally {
    process.stderr.write = original;
  }
}

async function withConfigDir(yaml: string, run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "revivify-gate-"));
  try {
    await writeFile(join(dir, CONFIG_FILENAME), yaml, "utf8");
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("e2e: block mode below the bar → exit 2, runs the full audit, and names the failing check", async () => {
  await withConfigDir("threshold: 10\nenforcement: block\n", async (dir) => {
    const belowBar: CheckOutput = {
      path: dir,
      mode: "full",
      findings: [failing("html-lang", "Page declares its language")],
      score: score(7, false),
    };
    const audit = fakeCheck(belowBar);
    const { code, stderr } = await runGateCapturingStderr(dir, audit.fn);
    assert.equal(code, 2); // the Stop-hook "keep going" signal
    assert.deepEqual(audit.modes, ["full"]); // block selects the full audit
    assert.match(stderr, /Page declares its language/); // failing check surfaced
    assert.match(stderr, /blocking "done"/);
  });
});

test("e2e: block mode at the bar → exit 0 (done is allowed)", async () => {
  await withConfigDir("threshold: 10\nenforcement: block\n", async (dir) => {
    const atBar: CheckOutput = {
      path: dir,
      mode: "full",
      findings: [],
      score: score(10, true),
    };
    const code = await runGate(dir, fakeCheck(atBar).fn);
    assert.equal(code, 0);
  });
});

test("e2e: real wiring on the deterministic fast path (warn never blocks a broken page)", async () => {
  // No injection — this exercises the REAL check on the fast static path (no
  // Chrome), proving config read + mode select + check + decide all wire up.
  const dir = await mkdtemp(join(tmpdir(), "revivify-gate-"));
  try {
    await writeFile(join(dir, CONFIG_FILENAME), "threshold: 10\nenforcement: warn\n", "utf8");
    // A deliberately broken page: no lang, no title — the static checks fail it.
    await writeFile(join(dir, "index.html"), "<html><body><h1>hi</h1></body></html>", "utf8");
    const { code, stderr } = await runGateCapturingStderr(dir); // no injection → real check
    assert.equal(code, 0); // warn nudges, never blocks
    assert.match(stderr, /Trust: \d+\/10/); // a real score was computed
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
