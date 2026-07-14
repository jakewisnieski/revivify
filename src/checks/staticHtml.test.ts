import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { staticHtmlRules } from "./staticHtml.js";
import type { PageContext } from "./types.js";

function run(id: string, html: string) {
  const rule = staticHtmlRules.find((r) => r.id === id);
  assert.ok(rule, `no rule with id ${id}`);
  const page: PageContext = { path: "test.html", html, root: parse(html) };
  return rule.run(page);
}

test("html-lang: fails when absent, passes when present", () => {
  assert.equal(run("html-lang", "<html><head></head><body></body></html>").verdict, "fail");
  assert.equal(run("html-lang", '<html lang="en"><body></body></html>').verdict, "pass");
});

test("doc-title: fails when empty/absent, passes with content", () => {
  assert.equal(run("doc-title", "<head></head>").verdict, "fail");
  assert.equal(run("doc-title", "<head><title>Bloom</title></head>").verdict, "pass");
});

test("meta-description: fails when absent, passes with content", () => {
  assert.equal(run("meta-description", "<head></head>").verdict, "fail");
  assert.equal(
    run("meta-description", '<head><meta name="description" content="Plants."></head>').verdict,
    "pass",
  );
});

test("meta-viewport: fails when absent, passes when responsive", () => {
  assert.equal(run("meta-viewport", "<head></head>").verdict, "fail");
  assert.equal(
    run("meta-viewport", '<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>')
      .verdict,
    "pass",
  );
});

test("img-alt: not-applicable with no images; empty alt is valid; absent alt fails", () => {
  assert.equal(run("img-alt", "<body><p>hi</p></body>").verdict, "not-applicable");
  assert.equal(run("img-alt", '<body><img src="a.jpg"></body>').verdict, "fail");
  assert.equal(run("img-alt", '<body><img src="a.jpg" alt="A plant"></body>').verdict, "pass");
  assert.equal(run("img-alt", '<body><img src="a.jpg" alt=""></body>').verdict, "pass");
});

test("noindex: an accidental noindex is a failing 'your call' finding", () => {
  const result = run("noindex", '<head><meta name="robots" content="noindex, nofollow"></head>');
  assert.equal(result.verdict, "fail");
  assert.equal(result.triage, "your-call");
  assert.equal(run("noindex", "<head></head>").verdict, "pass");
});
