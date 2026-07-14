import type { Rule } from "./types.js";
import { staticHtmlRules } from "./staticHtml.js";

/**
 * Every rule Revivify runs, composed from packs. Today: the static-HTML pack.
 * Future milestones add axe-core (a11y) and Lighthouse (performance) packs here.
 */
export const rules: Rule[] = [...staticHtmlRules];
