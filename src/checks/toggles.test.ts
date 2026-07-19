import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionByToggles, isDisabledByConfig } from "./toggles.js";
import type { Finding, Verdict } from "./types.js";

/** A minimal finding with a given id (the field the toggles key off). */
function finding(id: string, verdict: Verdict = "fail"): Finding {
  return { id, title: id, standard: "s", learnMore: "https://x.test", verdict, triage: "well-fix-it", detail: "" };
}

test("no toggles → every finding stays active (default is on)", () => {
  const all = [finding("html-lang"), finding("meta-description"), finding("noindex")];
  const { active, disabled } = partitionByToggles(all);
  assert.equal(active.length, 3);
  assert.equal(disabled.length, 0);
});

test("only an explicit false disables — true (or missing) leaves the check on", () => {
  const all = [finding("html-lang"), finding("doc-title")];
  const { active, disabled } = partitionByToggles(all, { "html-lang": true });
  assert.equal(active.length, 2);
  assert.equal(disabled.length, 0);
});

test("a disabled static rule is pulled out and preserved", () => {
  const all = [finding("html-lang"), finding("doc-title")];
  const { active, disabled } = partitionByToggles(all, { "html-lang": false });
  assert.deepEqual(active.map((f) => f.id), ["doc-title"]);
  assert.deepEqual(disabled.map((f) => f.id), ["html-lang"]);
});

test("a rules toggle disables the check in full mode too, across the id alias", () => {
  // `.revivify.yaml` scaffolds `img-alt`/`meta-viewport` (static ids); the full
  // audit reports the same checks as `image-alt`/`viewport`. Toggling the static
  // id must still disable the full-audit finding.
  const full = [finding("image-alt"), finding("viewport"), finding("text-contrast")];
  const { active, disabled } = partitionByToggles(full, { "img-alt": false, "meta-viewport": false });
  assert.deepEqual(disabled.map((f) => f.id).sort(), ["image-alt", "viewport"]);
  assert.deepEqual(active.map((f) => f.id), ["text-contrast"]);
});

test("a disabled category turns off every full-audit check under it", () => {
  const full = [
    finding("doc-title"), // seo
    finding("meta-description"), // seo
    finding("noindex"), // seo
    finding("image-alt"), // accessibility
    finding("lcp"), // performance
  ];
  const { active, disabled } = partitionByToggles(full, {}, { seo: false });
  assert.deepEqual(disabled.map((f) => f.id).sort(), ["doc-title", "meta-description", "noindex"]);
  assert.deepEqual(active.map((f) => f.id).sort(), ["image-alt", "lcp"]);
});

test("an unknown toggle id has no effect", () => {
  const all = [finding("html-lang")];
  const { active, disabled } = partitionByToggles(all, { "not-a-real-rule": false });
  assert.equal(active.length, 1);
  assert.equal(disabled.length, 0);
});

test("isDisabledByConfig covers rule, alias, and category paths", () => {
  assert.equal(isDisabledByConfig(finding("html-lang"), { "html-lang": false }), true);
  assert.equal(isDisabledByConfig(finding("image-alt"), { "img-alt": false }), true); // alias
  assert.equal(isDisabledByConfig(finding("noindex"), {}, { seo: false }), true); // category
  assert.equal(isDisabledByConfig(finding("html-lang"), {}, { seo: false }), false); // wrong category
  assert.equal(isDisabledByConfig(finding("html-lang")), false); // nothing set
});
