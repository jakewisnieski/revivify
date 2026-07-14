import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { check } from "./check.js";
import type { ProgressEvent } from "../engine/lighthouse.js";

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
