import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The config file `revivify init` scaffolds and the gate reads. */
export const CONFIG_FILENAME = ".revivify.yaml";

/** The default ship-ready bar: a perfect 10/10 (decision log #9). */
export const DEFAULT_THRESHOLD = 10;

/**
 * How the "done" gate behaves when a page is below the bar:
 * - `warn`  — nudge only (non-blocking); good while iterating.
 * - `block` — stop "done" until the score clears the bar.
 */
export type Enforcement = "warn" | "block";

/** Default enforcement: a non-blocking nudge while the project iterates. */
export const DEFAULT_ENFORCEMENT: Enforcement = "warn";

export interface RevivifyConfig {
  threshold: number;
  enforcement: Enforcement;
}

export const DEFAULT_CONFIG: RevivifyConfig = {
  threshold: DEFAULT_THRESHOLD,
  enforcement: DEFAULT_ENFORCEMENT,
};

/**
 * Read the fields the gate needs from `.revivify.yaml`.
 *
 * Deliberately a tiny, tolerant scalar reader — not a full YAML parser — so a
 * malformed or partial config falls back to safe defaults (bar 10, warn-only)
 * instead of crashing the hook that calls it. Full-fidelity parsing (the rule
 * toggles) is future work; the gate only cares about the bar and enforcement.
 */
export function parseConfig(source: string): RevivifyConfig {
  return {
    threshold: readNumber(source, "threshold") ?? DEFAULT_THRESHOLD,
    enforcement: readEnforcement(source) ?? DEFAULT_ENFORCEMENT,
  };
}

/** Load and parse the project's config, falling back to defaults when absent. */
export async function loadConfig(dir: string): Promise<RevivifyConfig> {
  try {
    const source = await readFile(join(dir, CONFIG_FILENAME), "utf8");
    return parseConfig(source);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Match a top-level `key: <number>` line (ignores comments and indented keys). */
function readNumber(source: string, key: string): number | undefined {
  const match = source.match(new RegExp(`^${key}:\\s*(-?\\d+(?:\\.\\d+)?)\\s*(?:#.*)?$`, "m"));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/** Match a top-level `enforcement: warn|block` line. */
function readEnforcement(source: string): Enforcement | undefined {
  const match = source.match(/^enforcement:\s*(\w+)\s*(?:#.*)?$/m);
  if (!match) return undefined;
  const value = match[1].toLowerCase();
  return value === "warn" || value === "block" ? value : undefined;
}
