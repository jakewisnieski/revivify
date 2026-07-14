import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

/** A single Lighthouse audit, normalized to what Revivify needs. */
export interface LighthouseAudit {
  id: string;
  /** 0–1, or null when the audit didn't apply / couldn't run. */
  score: number | null;
  /** e.g. "binary", "numeric", "notApplicable", "informative", "error". */
  scoreDisplayMode: string;
  /** e.g. "2.1 s" for LCP — handy in plain-language detail. */
  displayValue?: string;
}

/** The slice of a Lighthouse run Revivify consumes. */
export interface LighthouseReport {
  /** Category id ("performance", "accessibility", "seo", "best-practices") → 0–1 score. */
  categories: Record<string, number | null>;
  /** Audit id → result. */
  audits: Record<string, LighthouseAudit>;
  finalUrl: string;
}

const CATEGORIES = ["performance", "accessibility", "seo", "best-practices"];

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Serve a directory over loopback HTTP so Lighthouse (which rejects file://) can load it. */
async function serveDirectory(dir: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    // Browsers auto-request /favicon.ico; a 404 here would show up as a console
    // error and unfairly fail the console-errors check, so answer it cleanly.
    if (pathname === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    try {
      const body = await readFile(join(dir, pathname));
      res.writeHead(200, { "content-type": CONTENT_TYPES[extname(pathname)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

/** Resolve an input path to the directory to serve and the entry URL path within it. */
async function resolveSite(inputPath: string): Promise<{ dir: string; entry: string }> {
  const abs = resolve(inputPath);
  const info = await stat(abs).catch(() => {
    throw new Error(`Can't find "${inputPath}". Point revivify at an .html file or a folder containing index.html.`);
  });
  return info.isDirectory() ? { dir: abs, entry: "index.html" } : { dir: dirname(abs), entry: basename(abs) };
}

/**
 * Run Lighthouse against a local landing page and return the normalized report.
 * Serves the page over loopback HTTP, drives headless Chrome, then cleans up.
 */
export async function runLighthouse(inputPath: string): Promise<LighthouseReport> {
  const { dir, entry } = await resolveSite(inputPath);
  const server = await serveDirectory(dir);
  const url = `${server.origin}/${entry}`;

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: CATEGORIES,
    });
    if (!result) throw new Error("Lighthouse returned no result.");
    const lhr = result.lhr;

    const categories: Record<string, number | null> = {};
    for (const [id, category] of Object.entries(lhr.categories)) {
      categories[id] = category.score;
    }

    const audits: Record<string, LighthouseAudit> = {};
    for (const [id, audit] of Object.entries(lhr.audits)) {
      audits[id] = {
        id,
        score: audit.score ?? null,
        scoreDisplayMode: audit.scoreDisplayMode,
        displayValue: audit.displayValue,
      };
    }

    return { categories, audits, finalUrl: lhr.finalDisplayedUrl ?? url };
  } finally {
    // chrome-launcher's temp-dir cleanup throws EPERM on Windows; the audit already ran, so ignore it.
    try {
      chrome.kill();
    } catch {
      /* ignore Chrome cleanup errors */
    }
    await server.close();
  }
}
