import type { Finding } from "./types.js";
import { RULE_CATEGORY } from "./lighthouse.js";

/**
 * A static-HTML rule id and its full-audit (Lighthouse) equivalent name the
 * *same* check, so a `rules:` toggle on either form must disable it in BOTH
 * modes. `.revivify.yaml`'s `rules:` block is scaffolded from the static ids
 * (e.g. `img-alt`, `meta-viewport`), but the full audit reports those checks
 * under Lighthouse ids (`image-alt`, `viewport`) — these are the only two that
 * diverge.
 */
const RULE_ALIASES: Record<string, string> = {
  "img-alt": "image-alt",
  "image-alt": "img-alt",
  "meta-viewport": "viewport",
  viewport: "meta-viewport",
};

/**
 * True when a per-rule or per-category toggle in `.revivify.yaml` turns this
 * finding off. Only an explicit `false` disables — a missing or `true` entry
 * leaves the check on (the safe default).
 */
export function isDisabledByConfig(
  finding: Finding,
  rules: Record<string, boolean> = {},
  categories: Record<string, boolean> = {},
): boolean {
  if (rules[finding.id] === false) return true;
  const alias = RULE_ALIASES[finding.id];
  if (alias && rules[alias] === false) return true;
  const category = RULE_CATEGORY[finding.id];
  if (category && categories[category] === false) return true;
  return false;
}

export interface PartitionedFindings {
  /** Findings that count — scored and reported normally. */
  active: Finding[];
  /** Findings turned off in `.revivify.yaml` — dropped from the score, still surfaced. */
  disabled: Finding[];
}

/**
 * Split findings by the project's `.revivify.yaml` toggles. A disabled check is
 * removed from the objective denominator — the same honest drop as a
 * not-applicable check (decision-log #9) — but kept visible as "disabled by
 * config" so it's never silently faked as a pass (#10/#12). Order is preserved.
 */
export function partitionByToggles(
  findings: Finding[],
  rules: Record<string, boolean> = {},
  categories: Record<string, boolean> = {},
): PartitionedFindings {
  const active: Finding[] = [];
  const disabled: Finding[] = [];
  for (const finding of findings) {
    (isDisabledByConfig(finding, rules, categories) ? disabled : active).push(finding);
  }
  return { active, disabled };
}
