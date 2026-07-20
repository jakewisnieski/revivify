/**
 * A Revivify target is either a local build (a filesystem path to an .html file
 * or a folder with index.html) or a live page addressed by URL. FR-1 promises
 * "a local build **or URL**"; this is the one place that tells them apart.
 *
 * The URL path is deliberately **read-only** — Revivify can't write fixes to a
 * site it doesn't own, and there's no local project dir for intent/accept
 * (decision-log #29). Callers use {@link isUrl} to degrade those actions.
 */

/** True when a target refers to a live page by `http(s)://` URL, not a local path. */
export function isUrl(target: string): boolean {
  return /^https?:\/\//i.test(target.trim());
}
