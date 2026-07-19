import type { CheckOutput } from "./types.js";

/** A single fix in the "we'll fix it" plan — safe for the agent to apply. */
export interface FixAction {
  id: string;
  title: string;
  standard: string;
  detail: string;
  fix: string;
}

/** A judgment item routed to the human — accept-or-fix, never auto-applied. */
export interface DecisionItem {
  id: string;
  title: string;
  detail: string;
  fix?: string;
}

/** An informational note — surfaced for awareness, no action. */
export interface InfoItem {
  id: string;
  title: string;
  detail: string;
}

/**
 * The own-the-fix loop expressed as three actions, grouped by triage
 * (decision-log #20). Revivify never edits code — this only *drives* the loop:
 *
 *  - `wellFixIt` — the safe fix plan the coding agent applies, in apply order
 *    (registry order), approved by the human as one batch.
 *  - `yourCall`  — the human decision queue (accept or fix); never auto-applied.
 *  - `jsyk`      — informational; no action.
 */
export interface Actions {
  wellFixIt: FixAction[];
  yourCall: DecisionItem[];
  jsyk: InfoItem[];
}

/**
 * Group a check's findings into the three own-the-fix actions.
 *
 * Findings arrive in registry order, so the `wellFixIt` plan is already ordered
 * the way it should be applied. The `yourCall` queue is the *unresolved* half of
 * the your-call track (an accepted item is a settled decision, not an open one).
 */
export function planActions(output: CheckOutput): Actions {
  const { findings, score } = output;

  const wellFixIt: FixAction[] = findings
    .filter((f) => f.triage === "well-fix-it" && f.verdict === "fail")
    .map((f) => ({ id: f.id, title: f.title, standard: f.standard, detail: f.detail, fix: f.fix ?? "" }));

  const byId = new Map(findings.map((f) => [f.id, f]));
  const yourCall: DecisionItem[] = score.yourCall
    .filter((y) => y.status === "unresolved")
    .map((y) => {
      const f = byId.get(y.id);
      return { id: y.id, title: y.title, detail: f?.detail ?? "", ...(f?.fix ? { fix: f.fix } : {}) };
    });

  const jsyk: InfoItem[] = findings
    .filter((f) => f.triage === "just-so-you-know" && f.verdict === "fail")
    .map((f) => ({ id: f.id, title: f.title, detail: f.detail }));

  return { wellFixIt, yourCall, jsyk };
}
