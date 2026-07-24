/**
 * Grounded critique service (M6.3).
 *
 * Takes an M6.2 {@link PageCapture} (measured facts + full-page screenshot),
 * calls a **local vision model** (Qwen3-VL 8B via an Ollama-compatible endpoint),
 * and returns typed, tier-labeled advisory findings. The model is served from
 * Jake's box and reached through a **token-gated tunnel** — a bearer-auth reverse
 * proxy in front of Ollama (Ollama has no auth of its own), so the token is the
 * only thing standing between the open internet and the GPU (decision-log #30).
 *
 * Two safety properties are load-bearing:
 *  - **Advisory & score-isolated.** This service is never consulted by the
 *    deterministic score/gate. Nothing here can change a trust score (#31); the
 *    design layer is a separate track.
 *  - **Safe to be absent.** When the endpoint is unconfigured / down / slow /
 *    unauthorized, the service degrades to a clean "unavailable" state — never an
 *    error, never a blocked verdict. "Unavailable" is an expected state, not a
 *    failure (#29/#30).
 *
 * The model call is isolated behind an injectable `fetchImpl`, so every path here
 * is unit-tested in CI without a live model.
 */
import type { PageCapture } from "./measure.js";
import { composePrompt } from "./prompt.js";
import { deriveDeterministicFindings, parseOpinionFindings, type DesignFinding } from "./findings.js";

/** Where the token-gated vision model lives, and how to authenticate to it. */
export interface DesignEndpoint {
  /** Base URL of the tunnel fronting the model (Ollama-compatible `/api/chat`). */
  url: string;
  /** Bearer token the tunnel gates on. Sent as `Authorization: Bearer …`. */
  token?: string;
  /** Model name, e.g. "qwen3-vl:8b". */
  model: string;
}

/**
 * The service result. A clean binary the cockpit (M6.4) renders as either the
 * advisory panel or a plain "unavailable" note — the design analysis either
 * spoke or it didn't.
 */
export type DesignAdvisory =
  | { status: "available"; model: string; findings: DesignFinding[] }
  | { status: "unavailable"; reason: string };

/** A `fetch`-shaped function, injectable so the model call is mocked in CI. */
export type FetchLike = typeof fetch;

export interface CritiqueOptions {
  /** Override the resolved endpoint (tests / programmatic use). `null` ⇒ unconfigured. */
  endpoint?: DesignEndpoint | null;
  /** Per-call timeout; a cold 8B critique runs ~30–50s, so this allows headroom. */
  timeoutMs?: number;
  /** Injected `fetch` for tests; defaults to the global. */
  fetchImpl?: FetchLike;
  /** Injected serial runner for tests; defaults to the shared single-flight. */
  singleFlight?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const DEFAULT_MODEL = "qwen3-vl:8b";
/** A cold 8B critique runs ~30–50s; allow generous headroom before giving up. */
export const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Resolve the endpoint from the environment. Returns `null` when nothing is
 * configured — the safe default (the design layer is simply unavailable, and in
 * CI with no env it never reaches out). **No secrets in the repo**: the token
 * comes only from `REVIVIFY_DESIGN_TOKEN`, never a committed file.
 */
export function resolveDesignEndpoint(env: NodeJS.ProcessEnv = process.env): DesignEndpoint | null {
  const url = (env.REVIVIFY_DESIGN_ENDPOINT ?? env.OLLAMA_HOST ?? "").trim();
  if (!url) return null;
  const token = (env.REVIVIFY_DESIGN_TOKEN ?? "").trim();
  return {
    url: url.replace(/\/+$/, ""),
    token: token || undefined,
    model: (env.REVIVIFY_DESIGN_MODEL ?? env.OLLAMA_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  };
}

/**
 * A single-flight serial runner. One 8B on one GPU serves ~1–2 critiques at a
 * time (~30–50s each), so overlapping requests **queue and wait** rather than
 * thrash the card. Each task chains onto the previous one's settlement; a
 * rejection never poisons the chain for the next caller.
 */
export function createSingleFlight(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn, fn);
    // Keep the chain alive regardless of this task's outcome.
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

/** The process-wide single-flight guarding the shared model endpoint. */
const sharedSingleFlight = createSingleFlight();

/** A degrade we expect and report cleanly, rather than throwing to the caller. */
class UnavailableError extends Error {}

/** Map any thrown error to a clean, user-facing "unavailable" reason. */
function reasonFor(err: unknown): string {
  if (err instanceof UnavailableError) return err.message;
  // Read `.name` defensively: a real fetch abort throws a DOMException, which
  // isn't an `Error` subclass on every Node version — so key off the name, not
  // instanceof, to classify the timeout reliably.
  const name = typeof err === "object" && err !== null ? (err as { name?: unknown }).name : undefined;
  if (name === "AbortError" || name === "TimeoutError") return "design analysis timed out";
  if (err instanceof Error) return `design analysis unavailable (${err.message})`;
  return "design analysis unavailable";
}

interface ChatResponse {
  message?: { content?: string };
}

/** POST the grounded prompt + screenshot to the vision model and return its text. */
async function callVisionModel(
  endpoint: DesignEndpoint,
  system: string,
  user: string,
  screenshotBase64: string,
  opts: CritiqueOptions,
): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${endpoint.url}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: endpoint.model,
        stream: false,
        keep_alive: "20s", // drop out of VRAM soon after — keeps Jake's machine responsive
        options: { num_ctx: 8192, temperature: 0.3 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user, images: [screenshotBase64] },
        ],
      }),
    });
    if (res.status === 401 || res.status === 403) {
      throw new UnavailableError("design endpoint unauthorized — check the token");
    }
    if (!res.ok) {
      throw new UnavailableError(`design endpoint returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as ChatResponse;
    const content = data.message?.content?.trim();
    if (!content) throw new UnavailableError("design endpoint returned an empty critique");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Produce the grounded design advisory for a captured page.
 *
 * On success, findings are the deterministic tier-1/2 spine (from the measured
 * facts, so no fabricated numbers) **followed by** the model's tier-3 opinion —
 * "leading with the deterministic findings" (experiments B/D). On any failure —
 * unconfigured, unreachable, timeout, unauthorized, empty — it returns a clean
 * `unavailable` state and leaves the deterministic score/gate completely
 * untouched (this function has no path that mutates anything outside itself).
 */
export async function critique(capture: PageCapture, options: CritiqueOptions = {}): Promise<DesignAdvisory> {
  const endpoint = options.endpoint === undefined ? resolveDesignEndpoint() : options.endpoint;
  if (!endpoint) {
    return { status: "unavailable", reason: "design analysis not configured (set REVIVIFY_DESIGN_ENDPOINT)" };
  }

  const { system, user } = composePrompt(capture.facts);
  const run = options.singleFlight ?? sharedSingleFlight;
  try {
    const modelText = await run(() => callVisionModel(endpoint, system, user, capture.screenshot, options));
    const deterministic = deriveDeterministicFindings(capture.facts);
    const opinion = parseOpinionFindings(modelText);
    return { status: "available", model: endpoint.model, findings: [...deterministic, ...opinion] };
  } catch (err) {
    return { status: "unavailable", reason: reasonFor(err) };
  }
}
