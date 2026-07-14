#!/usr/bin/env node
import { runCheck } from "./commands/check.js";
import { runUi } from "./commands/ui.js";

const USAGE = `revivify — a quality gate for AI-built landing pages

Usage:
  revivify check [path] [--fast]   Check a landing page against citable best practices.
                                   path: an .html file or a folder containing index.html
                                   (defaults to the current directory).
  revivify ui [path]               Open the visual cockpit in your browser and watch
                                   the audit happen live.

Options:
  --fast   Run only the instant static pre-check (no Lighthouse). Good for a quick
           look while iterating; the full audit is what certifies ship-ready.

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
  if (command === "check") {
    const rest = args.slice(1);
    const mode = rest.includes("--fast") ? "fast" : "full";
    const path = rest.find((a) => !a.startsWith("-")) ?? ".";
    return runCheck(path, { mode });
  }
  if (command === "ui") {
    const path = args.slice(1).find((a) => !a.startsWith("-")) ?? ".";
    return runUi(path);
  }

  process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    process.stderr.write(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  });
