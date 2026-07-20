/**
 * A minimal Chrome DevTools Protocol client over Node's built-in WebSocket —
 * enough to evaluate a script in the page and capture a screenshot, with **no
 * new dependencies** (chrome-launcher is already a dep; WebSocket is global in
 * Node 21+). Extracted from the design-critique prototype and typed.
 */

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface CdpClient {
  /** Resolves once the socket is open. */
  ready: Promise<void>;
  /** Send a CDP command and resolve with its `result` (or reject on `error`). */
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  /** Close the socket. */
  close: () => void;
}

/** Open a CDP client against a page target's `webSocketDebuggerUrl`. */
export function connectCdp(wsUrl: string): CdpClient {
  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map<number, Pending>();

  ws.addEventListener("message", (event: MessageEvent) => {
    const message = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: unknown };
    if (typeof message.id !== "number") return; // an event, not a command reply
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });

  const ready = new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("CDP WebSocket error")));
  });

  // If the socket drops (e.g. Chrome is killed mid-capture), reject any in-flight
  // commands so a caller awaiting `send` can never hang indefinitely. On a normal
  // close after success `pending` is already empty, so this is a no-op then.
  const failPending = (reason: string) => {
    for (const [, waiter] of pending) waiter.reject(new Error(reason));
    pending.clear();
  };
  ws.addEventListener("close", () => failPending("CDP socket closed before the command completed"));
  ws.addEventListener("error", () => failPending("CDP socket error before the command completed"));

  const send = (method: string, params: Record<string, unknown> = {}): Promise<unknown> =>
    new Promise<unknown>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { ready, send, close: () => ws.close() };
}
