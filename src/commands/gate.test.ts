import { test } from "node:test";
import assert from "node:assert/strict";
import { decideGate } from "./gate.js";
import type { Score } from "../score.js";
import type { RevivifyConfig } from "../config.js";

function score(outOfTen: number, shipReady = outOfTen >= 10): Score {
  return { passing: outOfTen, applicable: 10, outOfTen, shipReady };
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
