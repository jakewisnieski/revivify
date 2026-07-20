import { test } from "node:test";
import assert from "node:assert/strict";
import { isUrl } from "./target.js";

test("isUrl recognises http and https targets (case-insensitive, trimmed)", () => {
  assert.equal(isUrl("http://example.com"), true);
  assert.equal(isUrl("https://example.com/landing"), true);
  assert.equal(isUrl("HTTPS://EXAMPLE.COM"), true);
  assert.equal(isUrl("  https://example.com  "), true);
});

test("isUrl treats local paths as not-a-URL", () => {
  assert.equal(isUrl("./demo-site"), false);
  assert.equal(isUrl("index.html"), false);
  assert.equal(isUrl("/abs/path/index.html"), false);
  assert.equal(isUrl("C:\\site\\index.html"), false);
  assert.equal(isUrl("."), false);
  // Not a fetchable scheme — treated as a local path, not a live URL.
  assert.equal(isUrl("ftp://example.com"), false);
  assert.equal(isUrl("file:///tmp/x.html"), false);
});
