/**
 * `npx tsx scripts/design-critique.ts [pathOrUrl]` — run the **productionized**
 * grounded-critique service (M6.3) end to end against a real page.
 *
 * Unlike `prototypes/design-critique.ts` (the exploration), this drives the
 * shipped code path: M6.2 `capturePage` for the measured facts + screenshot, then
 * the M6.3 `critique` service through the token-gated endpoint. It's the entry
 * point for the live acceptance scenarios that need Jake's local Qwen box up:
 *
 *   S1 grounded critique — point at demo-site with the endpoint configured:
 *     REVIVIFY_DESIGN_ENDPOINT=https://<tunnel> REVIVIFY_DESIGN_TOKEN=<token> \
 *       npx tsx scripts/design-critique.ts demo-site/index.html
 *   S3 auth — run it once WITHOUT the token (expect "unauthorized"), then WITH it.
 *
 * With no endpoint configured it prints the clean "unavailable" degrade (S2).
 */
import { resolve } from "node:path";
import { capturePage } from "../src/design/measure.js";
import { critique, resolveDesignEndpoint } from "../src/design/critique.js";
import { isUrl } from "../src/target.js";
import type { DesignFinding } from "../src/design/findings.js";

const target = process.argv[2] ?? "demo-site/index.html";
const display = isUrl(target) ? target : resolve(target);

function renderFinding(f: DesignFinding): string {
  const tag = f.tier === 3 ? "t3 · opinion (not cited)" : `t${f.tier} · ${f.citation}`;
  const cite = f.tier === 3 || !f.learnMore ? "" : `\n     ↳ ${f.learnMore}`;
  return `  [${tag}] ${f.title}\n     ${f.detail}${cite}`;
}

async function main() {
  const endpoint = resolveDesignEndpoint();
  process.stderr.write(`Endpoint: ${endpoint ? `${endpoint.url} (model ${endpoint.model}, ${endpoint.token ? "token set" : "NO token"})` : "not configured"}\n`);
  process.stderr.write(`Capturing ${display} …\n`);

  const capture = await capturePage(target);
  process.stderr.write(`Facts extracted; screenshot ${Math.round(capture.screenshot.length / 1024)}KB. Asking the model …\n`);

  const started = process.hrtime.bigint();
  const advisory = await critique(capture);
  const secs = Number(process.hrtime.bigint() - started) / 1e9;

  if (advisory.status === "unavailable") {
    process.stdout.write(`\nDESIGN ANALYSIS UNAVAILABLE — ${advisory.reason}\n(The deterministic score/gate is unaffected.)\n`);
    return;
  }
  process.stdout.write(`\n===== DESIGN ADVISORY (${advisory.model}, ${secs.toFixed(0)}s) =====\n`);
  process.stdout.write(advisory.findings.map(renderFinding).join("\n\n") + "\n");
}

main().catch((e) => {
  process.stderr.write(`\n✖ ${e?.message ?? e}\n`);
  process.exit(1);
});
