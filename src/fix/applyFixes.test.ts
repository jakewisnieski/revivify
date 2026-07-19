import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeSafeFixes, assetAltResolver, applySafeFixes, type AltResolver } from "./applyFixes.js";
import { staticHtmlRules } from "../checks/staticHtml.js";
import { parse } from "node-html-parser";

/** A broken page missing lang, title, description, viewport, and a hero img alt. */
const BROKEN = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <h1>Plants that forgive you</h1>
    <p>Low-light, low-water houseplants picked to survive real life, shipped to your door.</p>
    <img src="hero.svg" width="800" height="450" />
  </body>
</html>`;

const passingIds = (html: string): string[] => {
  const page = { path: "", html, root: parse(html) };
  return staticHtmlRules.filter((r) => r.run(page).verdict === "pass").map((r) => r.id);
};

const altFromStub: AltResolver = async (src) => (src === "hero.svg" ? "A leafy pothos plant" : undefined);

test("computeSafeFixes applies every safe fix from values sourced on the page", async () => {
  const { html, changed } = await computeSafeFixes(BROKEN, altFromStub);
  const ids = changed.map((c) => c.id).sort();
  assert.deepEqual(ids, ["doc-title", "html-lang", "img-alt", "meta-description", "meta-viewport"]);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/);
  assert.match(html, /<title>Plants that forgive you<\/title>/);
  assert.match(html, /<meta name="description" content="Low-light, low-water houseplants[^"]*" \/>/);
  assert.match(html, /<img alt="A leafy pothos plant" src="hero.svg"/);
});

test("the fixes make the objective static checks pass (guardrail: score goes up, never down)", async () => {
  const before = passingIds(BROKEN);
  const { html } = await computeSafeFixes(BROKEN, altFromStub);
  const after = passingIds(html);
  // every previously-passing check still passes, plus the five we fixed
  for (const id of before) assert.ok(after.includes(id), `regressed: ${id}`);
  assert.ok(after.length > before.length);
  for (const id of ["html-lang", "doc-title", "meta-description", "meta-viewport", "img-alt"]) {
    assert.ok(after.includes(id), `expected ${id} to pass after fixing`);
  }
});

test("preserves the doctype, comments, and untouched markup (string surgery, not re-serialization)", async () => {
  const withComment = BROKEN.replace("<body>", "<!-- keep me --><body>");
  const { html } = await computeSafeFixes(withComment, altFromStub);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<!-- keep me -->/);
});

test("is idempotent — a second pass changes nothing", async () => {
  const first = await computeSafeFixes(BROKEN, altFromStub);
  const second = await computeSafeFixes(first.html, altFromStub);
  assert.equal(second.changed.length, 0);
  assert.equal(second.html, first.html);
});

test("never fabricates: an image with no sourceable name is skipped, not guessed", async () => {
  const noSource: AltResolver = async () => undefined;
  const { html, changed, skipped } = await computeSafeFixes(BROKEN, noSource);
  assert.ok(!changed.some((c) => c.id === "img-alt"));
  assert.ok(skipped.some((c) => c.id === "img-alt"));
  assert.ok(!/<img alt=/.test(html)); // the hero img is left without an invented alt
});

test("skips title/description when the page has nothing to source them from", async () => {
  const bare = `<!doctype html><html><head><meta charset="utf-8" /></head><body></body></html>`;
  const { changed, skipped } = await computeSafeFixes(bare, altFromStub);
  // lang + viewport are deterministic and still applied; title + description have no source
  assert.ok(changed.some((c) => c.id === "html-lang"));
  assert.ok(changed.some((c) => c.id === "meta-viewport"));
  assert.ok(skipped.some((c) => c.id === "doc-title"));
  assert.ok(skipped.some((c) => c.id === "meta-description"));
});

test("edits the real tags, not identical-looking text inside an HTML comment", async () => {
  // The demo page documents its seeds in a comment that literally contains
  // "<html>" and "<img>". A naive first-match would edit the comment and leave
  // the real tags untouched (the bug this guards).
  const withDocComment = `<!doctype html>
<!-- Seeded: 1. <html> has no lang; 2. the hero <img> has no alt. -->
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <h1>Hi</h1>
    <p>Low-light, low-water houseplants picked to survive real life indoors.</p>
    <img src="hero.svg" />
  </body>
</html>`;
  const { html, changed } = await computeSafeFixes(withDocComment, altFromStub);
  assert.match(html, /<html lang="en">/); // the REAL tag got the lang
  assert.match(html, /<!-- Seeded: 1\. <html> has no lang/); // the comment is untouched
  assert.match(html, /<img alt="A leafy pothos plant" src="hero.svg"/);
  assert.ok(changed.some((c) => c.id === "html-lang"));
  // and it actually passes the check now
  assert.ok(passingIds(html).includes("html-lang"));
});

test("assetAltResolver sources alt from an SVG's own accessible name, and applySafeFixes writes it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "revivify-fix-"));
  try {
    await writeFile(join(dir, "index.html"), BROKEN, "utf8");
    await writeFile(
      join(dir, "hero.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A potted monstera plant"><rect/></svg>',
      "utf8",
    );
    const result = await applySafeFixes(dir);
    assert.equal(result.regressed, false);
    assert.ok(result.changed.some((c) => c.id === "img-alt"));
    const written = await readFile(join(dir, "index.html"), "utf8");
    assert.match(written, /<img alt="A potted monstera plant" src="hero.svg"/);

    // idempotent on disk: a second apply changes nothing.
    const again = await applySafeFixes(dir);
    assert.equal(again.changed.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
