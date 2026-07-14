/**
 * `npm run walkthrough` — a narrated, plain-language tour of what Revivify does.
 *
 * It runs the REAL check pipeline (no fakes) against the example pages, so what
 * you see here is exactly what the tool produces. Built for a non-developer:
 * watch a raw page get graded and explained, then watch a fixed page reach 10/10.
 *
 * Uses the instant --fast pre-check so the tour stays quick; the full Lighthouse
 * audit is what `revivify check` runs by default.
 */
import { resolve } from "node:path";
import { check } from "../src/commands/check.js";
import { renderHumanReport } from "../src/report/human.js";

const EXAMPLES = import.meta.dirname
  ? resolve(import.meta.dirname, "..", "examples")
  : resolve("examples");

function banner(text: string): void {
  const line = "─".repeat(64);
  process.stdout.write(`\n${line}\n  ${text}\n${line}\n`);
}

function say(text: string): void {
  process.stdout.write(`\n${text}\n`);
}

async function showCheck(exampleDir: string): Promise<void> {
  const output = await check(resolve(EXAMPLES, exampleDir), { mode: "fast" });
  process.stdout.write(renderHumanReport(output));
}

async function main(): Promise<void> {
  banner("Revivify — a 2-minute tour");
  say(
    "Revivify checks a landing page against real, published standards (accessibility,\n" +
      "performance, SEO) and tells you — in plain language — whether it's good enough to\n" +
      "ship. You never have to read the code. Let's watch it work on two pages.",
  );

  banner("STEP 1 of 2 · A page fresh from an AI agent, with no guardrails");
  say("We ask Revivify to check it:");
  await showCheck("starter-slop");
  say(
    "That's the point: Revivify gave it a low score and told you EXACTLY what's wrong —\n" +
      "each item in plain English, each tied to a real standard, each with a fix. 'Your call'\n" +
      "items (like hiding a page from Google) are left for you to decide, never auto-changed.",
  );

  banner("STEP 2 of 2 · The same page, rebuilt following that guidance");
  say("We check the fixed version:");
  await showCheck("perfect");
  say(
    "10 / 10 — Ship-ready. That's the bar (a perfect score), because a non-developer should\n" +
      "be able to trust that nothing broken was left behind.",
  );

  banner("That's the loop: check → understand → fix → re-check");
  say(
    "Try it yourself on the other example pages (each has a known result to compare against):\n\n" +
      "  npm run check -- ./examples/missing-alt\n" +
      "  npm run check -- ./examples/no-meta-description\n" +
      "  npm run check -- ./examples/accidental-noindex\n\n" +
      "See examples/README.md for what each one is testing, and\n" +
      "docs/walkthroughs/m0.md for how to verify this milestone yourself.\n",
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`\nWalkthrough failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
