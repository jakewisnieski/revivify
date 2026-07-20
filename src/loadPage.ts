import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "node-html-parser";
import { isUrl } from "./target.js";
import type { PageContext } from "./checks/types.js";

/** How long to wait for a live URL to respond before giving up. */
const URL_TIMEOUT_MS = 15_000;

/**
 * Resolve a target to a single HTML page and parse it.
 *
 * - A **local** path: a directory resolves to its index.html; a file is used as-is.
 * - A **URL**: fetched over the network (FR-1's live-URL path). Failures — an
 *   unreachable host, a non-2xx status, or non-HTML content — throw a plain
 *   error rather than returning a page, so a bad URL never becomes a fake pass.
 */
export async function loadPage(input: string): Promise<PageContext> {
  if (isUrl(input)) return loadUrl(input.trim());

  const abs = resolve(input);

  let filePath = abs;
  try {
    if ((await stat(abs)).isDirectory()) {
      filePath = join(abs, "index.html");
    }
  } catch {
    throw new Error(
      `Can't find "${input}". Point revivify at an .html file, a folder containing index.html, or an http(s):// URL.`,
    );
  }

  let html: string;
  try {
    html = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Couldn't read "${filePath}". Expected an HTML page there.`);
  }

  return { path: filePath, html, root: parse(html) };
}

/** Fetch and parse a live URL, failing honestly rather than faking a page. */
async function loadUrl(url: string): Promise<PageContext> {
  // A manual controller + cleared timer (rather than AbortSignal.timeout) so the
  // timeout handle is torn down as soon as the fetch settles — a lingering timer
  // otherwise trips a libuv assertion when the CLI calls process.exit on Windows.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);
  timer.unref?.();

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "text/html,application/xhtml+xml" },
    });
  } catch {
    const reason = controller.signal.aborted ? "timed out" : "couldn't connect";
    throw new Error(`Couldn't reach "${url}" (${reason}). Check the URL is public and reachable.`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`"${url}" returned HTTP ${res.status}. Revivify needs a reachable page (a 2xx response).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error(
      `"${url}" served ${contentType || "an unknown content type"}, not an HTML page. Point revivify at a landing page, not a file or API.`,
    );
  }

  const html = await res.text();
  return { path: url, html, root: parse(html) };
}
