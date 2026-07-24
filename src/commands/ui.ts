import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { check, projectDirOf } from "./check.js";
import { upsertAccept } from "../config.js";
import { applySafeFixes } from "../fix/applyFixes.js";
import { isUrl } from "../target.js";
import { capturePage } from "../design/measure.js";
import { critique } from "../design/critique.js";
import { buildDesignPanel } from "../design/panel.js";
import { loadPage } from "../loadPage.js";
import type { ProgressEvent } from "../engine/lighthouse.js";

/** The read-only reason shown when a write action is attempted on a live URL. */
const READ_ONLY_MESSAGE =
  "This is a live URL — Revivify can't write to a site it doesn't own. Point it at a local build to apply fixes or record acceptances.";

const WEB_DIR = resolve(import.meta.dirname, "..", "..", "web");
const DEFAULT_PORT = Number(process.env.REVIVIFY_UI_PORT ?? 4123);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** Send one Server-Sent Event. */
function sse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Read a request body up to a small cap (the accept payload is tiny JSON). */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) reject(new Error("payload too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/** Best-effort: open the given URL in the user's default browser. */
function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(cmd as string, args as string[], { detached: true, stdio: "ignore" });
    child.on("error", () => undefined); // browser couldn't be opened — the printed URL still works
    child.unref();
  } catch {
    /* best-effort only */
  }
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
  const rel = pathname === "/" ? "/index.html" : pathname;
  try {
    const body = await readFile(join(WEB_DIR, rel));
    res.writeHead(200, { "content-type": CONTENT_TYPES[extname(rel)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

/** Start the cockpit server and run until the process is stopped (Ctrl+C). */
export async function runUi(initialPath: string): Promise<number> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/api/default-path") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ path: initialPath }));
      return;
    }

    if (url.pathname === "/api/check") {
      const path = url.searchParams.get("path")?.trim() || initialPath;
      const mode = url.searchParams.get("mode") === "fast" ? "fast" : "full";
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      try {
        const output = await check(path, {
          mode,
          onProgress: (event: ProgressEvent) => sse(res, "phase", event),
        });
        sse(res, "result", output);
      } catch (err) {
        sse(res, "failed", { message: err instanceof Error ? err.message : String(err) });
      }
      res.end();
      return;
    }

    // Record a "your call" acceptance from the cockpit — writes to the project's
    // .revivify.yaml so the user never hand-edits YAML (M4.6). A reason is required
    // (decision-log #18); we write only Revivify's own config, never page code (#20).
    if (url.pathname === "/api/accept" && req.method === "POST") {
      try {
        const { path, id, reason } = JSON.parse(await readBody(req)) as {
          path?: string;
          id?: string;
          reason?: string;
        };
        const target = path?.trim() || initialPath;
        if (isUrl(target)) {
          res.writeHead(409, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: READ_ONLY_MESSAGE, readOnly: true }));
          return;
        }
        if (!id || !reason || !reason.trim()) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "An acceptance needs a reason." }));
          return;
        }
        const dir = await projectDirOf(target);
        await upsertAccept(dir, id, reason);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // The advisory design layer (M6.4): capture the page, ask the grounded critique
    // service, and return the tier-labeled panel view-model. It's a SEPARATE data
    // path from the score (#31) — nothing here can move the trust dial. It's slow
    // (~30–60s, availability-gated) and opt-in, so it never blocks the fast check.
    // A Chrome or model failure returns a clean "unavailable" panel (HTTP 200, never
    // an error) so the deterministic gate is provably unaffected. Writes nothing, so
    // it works the same on a local build or a live URL.
    if (url.pathname === "/api/design") {
      const path = url.searchParams.get("path")?.trim() || initialPath;
      res.writeHead(200, { "content-type": "application/json" });
      try {
        // Resolve the target the same way the checks do (a dir → its index.html, a
        // URL validated as reachable HTML) so the vision capture sees a real page.
        const { path: pagePath } = await loadPage(path);
        const capture = await capturePage(pagePath);
        const advisory = await critique(capture);
        res.end(JSON.stringify(buildDesignPanel(advisory)));
      } catch (err) {
        // Capturing the page failed (e.g. headless Chrome couldn't launch) — degrade
        // exactly like a down model: an unavailable panel, the gate untouched.
        res.end(
          JSON.stringify(
            buildDesignPanel({ status: "unavailable", reason: err instanceof Error ? err.message : String(err) }),
          ),
        );
      }
      return;
    }

    // Apply the safe, honestly-sourced "we'll fix it" fixes to the page and write
    // them back, then the cockpit re-checks so the dial climbs (M5.6, refines #20).
    // Values come only from the page/assets — never fabricated; anything it can't
    // source is left for the coding agent.
    if (url.pathname === "/api/fix" && req.method === "POST") {
      try {
        const { path } = JSON.parse(await readBody(req)) as { path?: string };
        const target = path?.trim() || initialPath;
        if (isUrl(target)) {
          res.writeHead(409, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: READ_ONLY_MESSAGE, readOnly: true }));
          return;
        }
        const result = await applySafeFixes(target);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    await serveStatic(url.pathname, res);
  });

  const port = await new Promise<number>((ready) => {
    server.once("error", () => {
      // Requested port busy — fall back to an ephemeral one.
      server.listen(0, "127.0.0.1", () => ready((server.address() as { port: number }).port));
    });
    server.listen(DEFAULT_PORT, "127.0.0.1", () => ready(DEFAULT_PORT));
  });

  const uiUrl = `http://127.0.0.1:${port}`;
  process.stderr.write(
    `\n  🌱 Revivify cockpit is running.\n\n     Opening ${uiUrl} in your browser…\n     (If it doesn't open, paste that URL in yourself. Press Ctrl+C to stop.)\n\n`,
  );
  if (!process.env.REVIVIFY_NO_OPEN) openBrowser(uiUrl);

  // Keep the process alive until the user stops it.
  return new Promise<number>(() => undefined);
}
