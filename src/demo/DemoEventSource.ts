// An EventSource-compatible connection backed by the local simulator.
//
// The dashboard uses the native EventSource API directly and depends on more of
// it than is obvious, so this implements the parts that are actually read:
//
//   - `readyState` and the CONNECTING/OPEN/CLOSED constants, BOTH as statics
//     and as instance properties. The error handler checks
//     `src.readyState === EventSource.CLOSED` across all three connections and
//     only reports OFFLINE when every one is closed — so the constants have to
//     exist on the constructor, not just the instance.
//   - `addEventListener("snapshot", ...)`, the named event the streams use.
//   - `onmessage`, the unnamed fallback the app keeps "so a proxy that strips
//     event names cannot blank the dashboard".
//   - `onopen`, which flips the badge to ONLINE.
//   - `close()`, called in the effect cleanup for all three.
//
// One deliberate fidelity detail: a named `snapshot` event must NOT also fire
// `onmessage`. Native EventSource dispatches a named event only to named
// listeners, and the app wires both paths to the same consumer — so firing both
// would hand every payload to handleData twice.

import { subscribe, type StreamName } from "./eventSimulator";

/** Which stream a URL belongs to. The three paths are fixed by
 *  DASHBOARD_STREAM_URLS; anything else is a programming error. */
const streamOf = (url: string): StreamName | null => {
  if (url.endsWith("/process-performance")) return "processPerformance";
  if (url.endsWith("/product-yield")) return "productYield";
  if (url.endsWith("/other")) return "other";
  return null;
};

type AnyListener = (event: MessageEvent | Event) => void;

export class DemoEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readonly url: string;
  readonly withCredentials = false;

  readyState = 0;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private listeners = new Map<string, Set<AnyListener>>();
  private unsubscribe: (() => void) | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    const stream = streamOf(this.url);

    if (!stream) {
      // Unknown stream path: fail the way a real one does rather than hanging
      // in CONNECTING forever, which would leave the badge stuck.
      this.readyState = this.CLOSED;
      setTimeout(() => this.fireError(), 0);
      return;
    }

    // Asynchronous open, like the real thing: the caller assigns onopen and
    // addEventListener AFTER the constructor returns, so firing synchronously
    // here would be missed entirely.
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      if (this.readyState === this.CLOSED) return;
      this.readyState = this.OPEN;
      const event = new Event("open");
      this.onopen?.(event);
      this.emit("open", event);
    }, 0);

    this.unsubscribe = subscribe(stream, (payload) => {
      if (this.readyState === this.CLOSED) return;
      this.dispatchSnapshot(payload);
    });
  }

  private dispatchSnapshot(payload: unknown) {
    const data = JSON.stringify(payload);
    const named = this.listeners.get("snapshot");

    if (named && named.size > 0) {
      // A named event goes to named listeners only — see the note at the top.
      const event = new MessageEvent("snapshot", { data });
      for (const listener of named) listener(event);
      return;
    }

    const event = new MessageEvent("message", { data });
    this.onmessage?.(event);
    this.emit("message", event);
  }

  private fireError() {
    const event = new Event("error");
    this.onerror?.(event);
    this.emit("error", event);
  }

  private emit(type: string, event: MessageEvent | Event) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) listener(event);
  }

  addEventListener(type: string, listener: AnyListener) {
    const set = this.listeners.get(type) ?? new Set<AnyListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: AnyListener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    this.emit(event.type, event);
    return true;
  }

  /**
   * Close the connection.
   *
   * Idempotent, and it releases the simulator subscription — which is what
   * stops the shared timer once the last connection goes away. Called three
   * times per unmount by the dashboard's effect cleanup, and twice per mount in
   * StrictMode.
   */
  close() {
    this.readyState = this.CLOSED;
    if (this.openTimer != null) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }
}
