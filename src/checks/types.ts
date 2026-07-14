import type { HTMLElement } from "node-html-parser";

/** The outcome of a single check against a page. */
export type Verdict = "pass" | "fail" | "not-applicable";

/**
 * How a finding is handed to the user, borrowed from the Revivify check UX:
 * - `well-fix-it`      — safe, the agent can just apply it
 * - `just-so-you-know` — informational, no action needed
 * - `your-call`        — a judgment call only the human should make
 */
export type Triage = "well-fix-it" | "just-so-you-know" | "your-call";

/** Everything a check needs to inspect one page. */
export interface PageContext {
  /** Absolute path to the HTML file that was checked. */
  path: string;
  /** Raw HTML source. */
  html: string;
  /** Parsed DOM root. */
  root: HTMLElement;
}

/** What a rule returns after inspecting a page. */
export interface RuleResult {
  verdict: Verdict;
  triage: Triage;
  /** Plain-language explanation of what was found and why it matters. */
  detail: string;
  /** Plain-language suggested fix (present when there is something to do). */
  fix?: string;
}

/** A single, citable best-practice check. */
export interface Rule {
  /** Stable machine id, e.g. "html-lang". */
  id: string;
  /** Short human-readable name of what the check verifies. */
  title: string;
  /** The published standard this check enforces, cited exactly. */
  standard: string;
  run(page: PageContext): RuleResult;
}

/** A rule's result joined with its identity — one line item in a report. */
export interface Finding extends RuleResult {
  id: string;
  title: string;
  standard: string;
}
