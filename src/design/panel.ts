/**
 * Design-advisory panel view-model (M6.4).
 *
 * Shapes an M6.3 {@link DesignAdvisory} into what the cockpit renders: findings
 * grouped by **tier**, tier-3 flagged as **model opinion**, plus a fixed
 * no-oversell disclaimer. Two boundaries from decision-log #31 live here:
 *
 *  - **Score-isolated by construction.** This view-model carries **no score,
 *    verdict, or pass/fail field** — it is structurally incapable of feeding the
 *    trust dial. A test asserts the score is byte-identical whether the design
 *    layer runs, is empty, or is unavailable.
 *  - **Never oversells.** The disclaimer states plainly that the layer is
 *    advisory, can miss a visually-broken page (experiment E), and that a short
 *    or empty result is **not** evidence the design is good. No "passed" framing.
 *
 * Pure and unit-tested — no Chrome, no model call.
 */
import type { DesignAdvisory } from "./critique.js";
import type { DesignFinding, DesignTier } from "./findings.js";

export interface DesignPanelItem {
  tier: DesignTier;
  title: string;
  detail: string;
  /** The cited standard/principle for tiers 1–2; null for tier-3 opinion. */
  citation: string | null;
  learnMore?: string;
  /** True for tier 3 — the UI labels it "model opinion", never a citation. */
  opinion: boolean;
}

export interface DesignPanelGroup {
  tier: DesignTier;
  label: string;
  /** A short caption clarifying the tier's authority. */
  caption: string;
  items: DesignPanelItem[];
}

export type DesignPanel =
  | { status: "available"; model: string; groups: DesignPanelGroup[]; disclaimer: string }
  | { status: "unavailable"; reason: string; note: string };

const TIER_META: Record<DesignTier, { label: string; caption: string }> = {
  1: { label: "Objective", caption: "measured against a published standard" },
  2: { label: "Heuristic", caption: "an established best practice, cited to research" },
  3: { label: "Taste", caption: "the model’s opinion — not a cited standard" },
};

/**
 * The no-oversell disclaimer (#31, experiment E). Fixed copy so the panel can
 * never imply its silence means the design is good.
 */
export const DESIGN_DISCLAIMER =
  "Advisory only — these design suggestions are never part of the trust score above. " +
  "The list can be incomplete and may miss a visually-broken page, so a short or empty " +
  "result is not proof the design is good. Tier-3 items are the model’s opinion, not a cited standard.";

/** Shown on the degrade path — the deterministic gate is explicitly unaffected. */
const UNAVAILABLE_NOTE =
  "The deterministic gate and trust score are unaffected — only the advisory design layer is offline.";

/** Tiers rendered in citability order: objective → heuristic → opinion. */
const TIER_ORDER: DesignTier[] = [1, 2, 3];

function toItem(f: DesignFinding): DesignPanelItem {
  return {
    tier: f.tier,
    title: f.title,
    detail: f.detail,
    citation: f.citation,
    learnMore: f.learnMore,
    opinion: f.tier === 3,
  };
}

/** Build the cockpit's design-advisory view-model from an M6.3 advisory. */
export function buildDesignPanel(advisory: DesignAdvisory): DesignPanel {
  if (advisory.status === "unavailable") {
    return { status: "unavailable", reason: advisory.reason, note: UNAVAILABLE_NOTE };
  }

  const groups: DesignPanelGroup[] = [];
  for (const tier of TIER_ORDER) {
    const items = advisory.findings.filter((f) => f.tier === tier).map(toItem);
    if (items.length > 0) {
      groups.push({ tier, label: TIER_META[tier].label, caption: TIER_META[tier].caption, items });
    }
  }
  return { status: "available", model: advisory.model, groups, disclaimer: DESIGN_DISCLAIMER };
}
