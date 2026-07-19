import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** The config file `revivify init` scaffolds and the gate reads. */
export const CONFIG_FILENAME = ".revivify.yaml";

/** The plain-language page-intent file `revivify init` scaffolds and `check` reads. */
export const INTENT_FILENAME = ".revivify/intent.md";

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
  /**
   * "Your call" acceptances: rule id → the reason it was knowingly accepted.
   * Read here; the ship-ready bar consumes it in M4.2 so an accepted judgment
   * call clears the bar without being faked as a pass (decision-log #18).
   */
  accept?: Record<string, string>;
  /**
   * Per-check toggles from the `rules:` block (check id → enabled). Only an
   * explicit `false` turns a check off; a missing or `true` entry leaves it on.
   * Consumed by `check`/`gate` (M5.3, FR-10) — a disabled check drops from the
   * denominator but stays visible as "disabled by config", never faked as a pass.
   */
  rules?: Record<string, boolean>;
  /**
   * Per-category toggles from the `categories:` block (Lighthouse category →
   * enabled). Turns off every full-audit check in that category. Same
   * explicit-`false`-only, honest-drop semantics as {@link rules}.
   */
  categories?: Record<string, boolean>;
}

export const DEFAULT_CONFIG: RevivifyConfig = {
  threshold: DEFAULT_THRESHOLD,
  enforcement: DEFAULT_ENFORCEMENT,
  accept: {},
  rules: {},
  categories: {},
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
    accept: readAccept(source),
    rules: readToggles(source, "rules"),
    categories: readToggles(source, "categories"),
  };
}

/**
 * Read a `key:` block of `id: true|false` toggles — the `rules:` and
 * `categories:` blocks `init` scaffolds. Same tolerant block-scan as
 * {@link readAccept}: an inline value (`rules: {}`) or an absent block yields an
 * empty map, and any line whose value isn't a clean boolean is skipped — so a
 * garbled toggle falls back to the safe default (on) instead of turning a check
 * off by accident. Only entries present here can flip a check off.
 */
function readToggles(source: string, key: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^${key}:`).test(l));
  if (start === -1) return out;

  // `rules: {}` (or any inline value) → no nested entries.
  if (lines[start].slice(`${key}:`.length).trim().startsWith("{")) return out;

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*$/.test(line)) continue; // blank lines don't end the block
    if (!/^\s/.test(line)) break; // a dedent to column 0 ends the block
    const entry = line.match(/^\s+([\w.-]+):\s*(true|false)\s*(?:#.*)?$/i);
    if (!entry) continue; // non-boolean value → leave the check at its default (on)
    out[entry[1]] = entry[2].toLowerCase() === "true";
  }
  return out;
}

/**
 * Load the plain-language page intent from `.revivify/intent.md`, when present.
 *
 * Optional by contract: a missing or empty file returns `undefined` so `check`
 * still runs (and nudges) rather than requiring a form up front (decision-log #19).
 */
export async function loadIntent(dir: string): Promise<string | undefined> {
  try {
    const text = (await readFile(join(dir, INTENT_FILENAME), "utf8")).trim();
    if (text.length === 0) return undefined;
    // A freshly scaffolded intent.md is all headings and comment hints. Treat
    // an untouched scaffold as not-yet-filled so `check` nudges the user to
    // describe the page rather than claiming intent was captured (honesty — #10/#12).
    const meaningful = text
      .replace(/<!--[\s\S]*?-->/g, "") // strip the comment hints
      .replace(/^\s*#.*$/gm, "") // strip markdown headings
      .trim();
    return meaningful.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
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

/**
 * Read the `accept:` block — the "your call" acceptances (`rule-id: "reason"`).
 *
 * Same tolerant-reader spirit as the rest of this module: a plain block scan,
 * not a full YAML parse. `accept: {}` (the scaffold default) or an absent block
 * yields an empty map; indented `key: value` lines under `accept:` are collected
 * until the block dedents. Quoted reasons are unwrapped.
 */
function readAccept(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => /^accept:/.test(l));
  if (start === -1) return out;

  // `accept: {}` (or any inline value) → no nested entries.
  if (lines[start].slice("accept:".length).trim().startsWith("{")) return out;

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*$/.test(line)) continue; // blank lines don't end the block
    if (!/^\s/.test(line)) break; // a dedent to column 0 ends the block
    const entry = line.match(/^\s+([\w.-]+):\s*(.*?)\s*$/);
    if (!entry) continue;
    let value = entry[2];
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
    }
    if (value) out[entry[1]] = value;
  }
  return out;
}

/**
 * Record a "your call" acceptance in `.revivify.yaml` — the mechanism behind the
 * cockpit's Accept control (M4.6), so a user never hand-edits YAML.
 *
 * A text-surgery upsert (same tolerant-reader spirit as {@link readAccept}, not a
 * full YAML rewrite) so it preserves the rest of the file — threshold,
 * enforcement, other accepts, rule toggles, comments. The reason is sanitised to
 * a single quoted line so it round-trips through the naive reader; a blank reason
 * is rejected upstream (decision-log #18 — no acceptance without a reason).
 */
export function writeAccept(source: string, id: string, reason: string): string {
  const clean = String(reason).replace(/[\r\n]+/g, " ").replace(/"/g, "'").trim();
  const entry = `  ${id}: "${clean}"`;
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => /^accept:/.test(l));

  // No accept block yet — append one at the end.
  if (start === -1) {
    const base = source.replace(/\s*$/, "");
    return `${base}${base ? "\n" : ""}accept:\n${entry}\n`;
  }

  // `accept: {}` (or any inline value) — turn it into a block with this entry.
  if (lines[start].slice("accept:".length).trim().startsWith("{")) {
    lines[start] = "accept:";
    lines.splice(start + 1, 0, entry);
    return lines.join("\n");
  }

  // Block form — update this id in place if present, else insert as the first entry.
  let existing = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*$/.test(lines[i])) continue; // blanks don't end the block
    if (!/^\s/.test(lines[i])) break; // a dedent to column 0 ends the block
    const m = lines[i].match(/^\s+([\w.-]+):/);
    if (m && m[1] === id) existing = i;
  }
  if (existing !== -1) lines[existing] = entry;
  else lines.splice(start + 1, 0, entry);
  return lines.join("\n");
}

/** Read `.revivify.yaml`, upsert the acceptance, and write it back (M4.6). */
export async function upsertAccept(dir: string, id: string, reason: string): Promise<void> {
  const file = join(dir, CONFIG_FILENAME);
  let source = "";
  try {
    source = await readFile(file, "utf8");
  } catch {
    source = "";
  }
  await writeFile(file, writeAccept(source, id, reason), "utf8");
}
