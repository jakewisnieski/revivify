#!/usr/bin/env node
import { runCheck } from "./commands/check.js";
import { runUi } from "./commands/ui.js";
import { runInit } from "./commands/init.js";
import { runGate } from "./commands/gate.js";

const USAGE = `revivify — a quality gate for AI-built landing pages

Usage:
  revivify init [path] [--force]   Set up a project for the Revivify lifecycle:
                                   scaffold .revivify.yaml (the ship-ready bar and
                                   check toggles), the rules pack + plan under
                                   .revivify/, and a CLAUDE.md pointer (only if none
                                   exists). path defaults to the current directory;
                                   --force regenerates the Revivify-owned files.
  revivify check [target] [--fast] Check a landing page against citable best practices.
                                   target: an .html file, a folder containing index.html,
                                   or an http(s):// URL (defaults to the current directory).
                                   On a URL, fixes/intent/accept are read-only.
  revivify ui [target]             Open the visual cockpit in your browser and watch
                                   the audit happen live. target may be a local path or URL.
  revivify gate [target]           Run the "done" gate: check the page and, per
                                   .revivify.yaml, nudge (warn) or block until the
                                   score clears the bar. This is what the installed
                                   Claude Code Stop hook calls.

Options:
  --fast    Run only the instant static pre-check (no Lighthouse). Good for a quick
            look while iterating; the full audit is what certifies ship-ready.
  --force   (init) Overwrite an existing .revivify.yaml instead of leaving it in place.

Output:
  stdout   structured results for your coding agent
  stderr   a plain-language report and trust score for you

Exit code:
  0  ship-ready (a perfect 10/10)
  1  not yet — some checks are failing
`;

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    process.stderr.write(USAGE);
    return 0;
  }
  if (command === "init") {
    const rest = args.slice(1);
    const force = rest.includes("--force");
    const path = rest.find((a) => !a.startsWith("-")) ?? ".";
    return runInit(path, { force });
  }
  if (command === "check") {
    const rest = args.slice(1);
    const mode = rest.includes("--fast") ? "fast" : "full";
    const path = rest.find((a) => !a.startsWith("-")) ?? ".";
    return runCheck(path, { mode });
  }
  if (command === "gate") {
    const path = args.slice(1).find((a) => !a.startsWith("-")) ?? ".";
    return runGate(path);
  }
  if (command === "ui") {
    const path = args.slice(1).find((a) => !a.startsWith("-")) ?? ".";
    return runUi(path);
  }

  process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

/**
 * Set the exit code and let the event loop drain on its own, forcing the exit
 * only if something is still keeping it alive.
 *
 * Draining first avoids a Windows libuv assertion that fires when `process.exit`
 * races undici's socket teardown on the URL (fetch) path. The unref'd fallback
 * still guarantees we exit even if a lingering handle — e.g. headless Chrome
 * after a full audit — would otherwise hang the process.
 */
function exitWhenDrained(code: number): void {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 250).unref();
}

main()
  .then((code) => exitWhenDrained(code))
  .catch((err: unknown) => {
    process.stderr.write(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
    exitWhenDrained(2);
  });
