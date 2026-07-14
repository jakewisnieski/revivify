import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "node-html-parser";
import type { PageContext } from "./checks/types.js";

/**
 * Resolve an input path to a single HTML file and parse it.
 * A directory resolves to its index.html; a file is used as-is.
 */
export async function loadPage(inputPath: string): Promise<PageContext> {
  const abs = resolve(inputPath);

  let filePath = abs;
  try {
    if ((await stat(abs)).isDirectory()) {
      filePath = join(abs, "index.html");
    }
  } catch {
    throw new Error(
      `Can't find "${inputPath}". Point revivify at an .html file or a folder containing index.html.`,
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
