// Installs the demo transport: a fetch shim and an EventSource replacement.
//
// WHAT THIS IS, PRECISELY: a module-scoped override of globalThis.fetch and
// globalThis.EventSource, installed before React mounts. It is NOT Mock Service
// Worker and does not intercept at the network layer — nothing appears in the
// browser's network panel, because no request is made. MSW can replace it later
// without touching a single component; see demoApi.ts and README.md.
//
// Why a transport shim rather than a service-layer refactor: every REST call in
// the app resolves its host through apiUrl() in src/core/api/config.ts, and the
// three streams through DASHBOARD_STREAM_URLS in the same file. That is already
// a single choke point, so swapping the transport needs zero changes to the
// ~20 data hooks. Rewriting those call sites to take an injected client would
// touch every one of them and risk regressing the live app, for no gain the
// demo can see.
//
// Guard rails, both deliberate:
//   - An unmatched URL THROWS. A demo that silently fell through to the network
//     would look like it worked right up until it was shown on a machine with
//     no access to the plant.
//   - .env.demo points the API host at a non-resolvable sentinel, so even if
//     this shim were bypassed, nothing can reach a real service.

import { API_BASE_URL } from "../core/api/config";
import { matchRoute } from "./demoApi";
import { DemoEventSource } from "./DemoEventSource";
import { loadManifest, storeInfo } from "./fixtureStore";
import { startSimulator } from "./eventSimulator";

let installed = false;

/** Hosts the demo is allowed to talk to for its own assets. */
const isOwnAsset = (url: URL): boolean =>
  url.origin === window.location.origin &&
  url.pathname.includes("/demo-data/");

export class DemoRouteMissing extends Error {
  constructor(url: string, method: string) {
    super(
      `[demo] no handler for ${method} ${url}\n` +
        `This request would have gone to a real backend. Add a route in ` +
        `src/demo/demoApi.ts, or fix the caller.`,
    );
    this.name = "DemoRouteMissing";
  }
}

const toResponse = (
  status: number,
  body: unknown,
  blob: Blob | undefined,
  headers: Record<string, string> | undefined,
): Response => {
  if (blob) {
    return new Response(blob, { status, headers: headers ?? {} });
  }
  return new Response(JSON.stringify(body ?? null), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
};

/**
 * Honour AbortSignal.
 *
 * The dashboard's scoped fetches abort in their effect cleanup, and a shim that
 * ignored the signal would resolve after the component unmounted — which is how
 * a stale window's numbers end up on screen under a newer filter.
 */
const abortable = <T>(signal: AbortSignal | null | undefined, work: Promise<T>): Promise<T> => {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
};

const abortError = () => {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
};

const installFetch = () => {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const rawUrl = request ? request.url : String(input);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

    let url: URL;
    try {
      url = new URL(rawUrl, window.location.href);
    } catch {
      return nativeFetch(input as RequestInfo, init);
    }

    // The fixtures themselves, and anything else served from our own origin
    // that is not an API path (source maps, assets in dev).
    if (isOwnAsset(url)) return nativeFetch(input as RequestInfo, init);

    const matched = matchRoute(url, method);
    if (!matched) {
      // Same-origin non-API traffic is Vite's own (HMR, modules). Let it pass;
      // anything aimed at the API host is a genuine miss.
      const apiOrigin = (() => {
        try {
          return new URL(API_BASE_URL, window.location.href).origin;
        } catch {
          return window.location.origin;
        }
      })();
      if (url.origin === window.location.origin && url.origin !== apiOrigin) {
        return nativeFetch(input as RequestInfo, init);
      }
      const err = new DemoRouteMissing(url.toString(), method);
      console.error(err);
      throw err;
    }

    const signal = init?.signal ?? request?.signal ?? null;
    const work = (async () => {
      const result = await matched.route.handler(
        url,
        request ??
          (init?.body != null
            ? new Request(url.toString(), { method, body: init.body, headers: init.headers })
            : undefined),
        matched.params,
      );
      return toResponse(result.status, result.body, result.blob, result.headers);
    })();

    return abortable(signal, work);
  };
};

const installEventSource = () => {
  // Cast through unknown: DemoEventSource implements the interface the app uses
  // (readyState, the state constants, onopen/onmessage/onerror,
  // addEventListener, close) but is not a structural match for the full DOM
  // type, which carries internals no consumer touches.
  (globalThis as unknown as { EventSource: unknown }).EventSource =
    DemoEventSource as unknown as typeof EventSource;
};

/**
 * Prepare the demo and install the transport. Call BEFORE rendering React.
 *
 * The manifest is awaited here rather than lazily, because the store's date
 * offset must be known before the first handler runs — a handler that resolved
 * a window against an unloaded manifest would answer for the wrong days.
 */
export const bootstrapDemo = async (): Promise<void> => {
  if (installed) return;
  installed = true;

  await loadManifest();
  installFetch();
  installEventSource();
  await startSimulator();

  if (import.meta.env.DEV) {
    // Dropped from a production demo build by the DEV guard inside.
    const { installCacheSelfTest } = await import("./cacheSelfTest");
    installCacheSelfTest();

    const info = storeInfo();
    console.info(
      `%c[demo] standalone mode`,
      "color:#a3e635;font-weight:bold",
      `\n  seed      ${info.seed}` +
        `\n  window    ${info.window} (${info.days} production days)` +
        `\n  anchored  ${info.anchorDate} -> ${info.today} (${info.offsetDays >= 0 ? "+" : ""}${info.offsetDays}d)` +
        `\n  fixtures  ${info.rows.toLocaleString("en-US")} rows, ${(info.bytes / 1024 / 1024).toFixed(2)} MB` +
        `\n  cache     __demoCacheSelfTest() in the console, or ?demoSelfTest=1` +
        `\n  no request leaves this machine; unmatched URLs throw.`,
    );
  }
};

export const isDemoInstalled = () => installed;
