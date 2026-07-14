#!/usr/bin/env node
import { runCheck } from "./commands/check.js";

const USAGE = `revivify — a quality gate for AI-built landing pages

Usage:
  revivify check [path]   Check a landing page against citable best practices.
                          path: an .html file or a folder containing index.html
                          (defaults to the current directory).

Output:
  stdout   structured results for your coding agent
  stderr   a plain-language report and trust score for you

Exit code:
  0  ship-ready (a perfect 10/10)
  1  not yet — some checks are failing
`;

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    process.stderr.write(USAGE);
    return 0;
  }
  if (command === "check") {
    return runCheck(rest[0] ?? ".");
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
