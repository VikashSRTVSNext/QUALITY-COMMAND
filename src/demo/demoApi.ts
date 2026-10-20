// The route table: every REST endpoint the app calls, mapped to a handler.
//
// THIS FILE IS THE MSW MIGRATION SURFACE. Each entry is already shaped like an
// MSW handler — a method, a path pattern with `:param` segments, and a function
// from URL to { status, body }. Converting is mechanical:
//
//   import { http, HttpResponse } from 'msw';
//   import { DEMO_ROUTES, matchRoute } from './demoApi';
//   import { apiUrl } from '../core/api/config';
//
//   export const handlers = DEMO_ROUTES.map((route) =>
//     http[route.method.toLowerCase()](apiUrl(route.path), async ({ request, params }) => {
//       const { status, body, blob, headers } =
//         await route.handler(new URL(request.url), request, params);
//       return blob
//         ? new HttpResponse(blob, { status, headers })
//         : HttpResponse.json(body, { status, headers });
//     }),
//   );
//
// MSW uses the same `:param` syntax, so the patterns transfer unchanged. See
// README.md in this folder for the full step-by-step.

import { API_BASE_URL, LEGACY_REST_BASE_URL } from "../core/api/config";
import {
  eriHandler,
  kpisHandler,
  processFilterOptionsHandler,
  processPerformanceHandler,
  productYieldHandler,
  productsHandler,
  safetyHandler,
  yieldRecommendationHandler,
} from "./handlers/dashboard";
import {
  defectsHandler,
  dpmoiBreakdownHandler,
  dpmoiDetailHandler,
  imageArchiveHandler,
  imageFileHandler,
  imagesHandler,
  screwBreakdownHandler,
  screwPositionsHandler,
  stepProductsHandler,
  testersHandler,
} from "./handlers/process";
import {
  ackDetailHandler,
  ackReplyHandler,
  shiftReportHandler,
} from "./handlers/alerts";
import { legacyDefectDetailHandler, legacyListHandler } from "./handlers/legacy";
import type { DemoHandler, DemoResponse, RouteParams } from "./types";

export interface DemoRouteEntry {
  method: "GET" | "POST";
  /** Path relative to the API base, with `:param` segments. */
  path: string;
  handler: (
    url: URL,
    request: Request | undefined,
    params: RouteParams,
  ) => Promise<DemoResponse> | DemoResponse;
  /** Which base this path hangs off. The legacy axios layer uses a different
   *  one (/api/v1) from the dashboard surface. */
  base?: "api" | "legacy";
}

/**
 * Order matters: the first match wins, and the more specific path must come
 * first. `/process/:step/products` would otherwise swallow
 * `/process/dpmoi/breakdown`, because `:step` happily matches "dpmoi".
 */
export const DEMO_ROUTES: DemoRouteEntry[] = [
  // ── Dashboard ────────────────────────────────────────────────────────────
  { method: "GET", path: "/dashboard/product-yield", handler: (u) => productYieldHandler(u) },
  { method: "GET", path: "/dashboard/kpis", handler: (u) => kpisHandler(u) },
  { method: "GET", path: "/dashboard/process-performance", handler: (u) => processPerformanceHandler(u) },
  { method: "GET", path: "/dashboard/process-filter-options", handler: (u) => processFilterOptionsHandler(u) },
  { method: "GET", path: "/dashboard/products", handler: (u) => productsHandler(u) },
  { method: "GET", path: "/dashboard/safety", handler: () => safetyHandler() },
  { method: "GET", path: "/dashboard/eri", handler: () => eriHandler() },
  { method: "GET", path: "/yield-recommendation/current-day", handler: () => yieldRecommendationHandler() },

  // ── Process: specific paths BEFORE the :step wildcards ───────────────────
  { method: "GET", path: "/process/dpmoi/breakdown", handler: (u) => dpmoiBreakdownHandler(u) },
  { method: "GET", path: "/process/dpmoi/detail", handler: (u) => dpmoiDetailHandler(u) },
  { method: "GET", path: "/process/screw-defects/breakdown", handler: (u) => screwBreakdownHandler(u) },
  { method: "GET", path: "/process/screw-defects/positions", handler: (u) => screwPositionsHandler(u) },
  { method: "GET", path: "/process/images/archive", handler: (u) => imageArchiveHandler(u) },
  { method: "GET", path: "/process/images/file", handler: (u) => imageFileHandler(u) },

  { method: "GET", path: "/process/:step/products/:item/testers", handler: testersHandler },
  { method: "GET", path: "/process/:step/products/:item/defects", handler: defectsHandler },
  { method: "GET", path: "/process/:step/products/:item/images", handler: imagesHandler },
  { method: "GET", path: "/process/:step/products", handler: stepProductsHandler },

  // ── Alerts ───────────────────────────────────────────────────────────────
  { method: "GET", path: "/alerts/ack/detail", handler: (u) => ackDetailHandler(u) },
  { method: "POST", path: "/alerts/ack/reply", handler: (u, r) => ackReplyHandler(u, r) },
  { method: "GET", path: "/alerts/shift-report", handler: (u) => shiftReportHandler(u) },

  // ── Legacy axios layer ───────────────────────────────────────────────────
  // Reachable only if VITE_USE_MOCKS is set to "false"; .env.demo leaves the
  // built-in mocks on. Routed anyway so the demo cannot fall through to the
  // network on a misconfigured env.
  { method: "GET", path: "/quality/defects/:code", handler: legacyDefectDetailHandler, base: "legacy" },
  { method: "GET", path: "/quality/defects", handler: legacyListHandler, base: "legacy" },
  { method: "GET", path: "/production/lines/:id", handler: legacyListHandler, base: "legacy" },
  { method: "GET", path: "/production/lines", handler: legacyListHandler, base: "legacy" },
];

// ── Matching ────────────────────────────────────────────────────────────────

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, "");

/** Path portion of each base, so matching works whether the base is absolute
 *  (http://demo.invalid/api) or relative (/api/v1). */
const basePathOf = (base: string): string => {
  try {
    return stripTrailingSlash(new URL(base).pathname);
  } catch {
    return stripTrailingSlash(base.startsWith("/") ? base : `/${base}`);
  }
};

const API_PATH = basePathOf(API_BASE_URL);
const LEGACY_PATH = basePathOf(LEGACY_REST_BASE_URL);

const patternCache = new Map<string, { re: RegExp; keys: string[] }>();

const compile = (pattern: string) => {
  const cached = patternCache.get(pattern);
  if (cached) return cached;
  const keys: string[] = [];
  const re = new RegExp(
    `^${pattern
      .split("/")
      .map((seg) => {
        if (!seg.startsWith(":")) {
          return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
        keys.push(seg.slice(1));
        // One segment only: a path parameter must not swallow a "/" and turn
        // /products/{item}/testers into an item called "x/testers".
        return "([^/]+)";
      })
      .join("/")}$`,
  );
  const compiled = { re, keys };
  patternCache.set(pattern, compiled);
  return compiled;
};

export interface MatchedRoute {
  route: DemoRouteEntry;
  params: RouteParams;
}

/**
 * Find the handler for a request, or null when the URL is not ours.
 *
 * Null is the signal that something is trying to reach a real service, which
 * the transport turns into a loud failure rather than a silent passthrough.
 */
export const matchRoute = (url: URL, method: string): MatchedRoute | null => {
  const path = stripTrailingSlash(url.pathname) || "/";

  for (const route of DEMO_ROUTES) {
    if (route.method !== method.toUpperCase()) continue;
    const prefix = route.base === "legacy" ? LEGACY_PATH : API_PATH;
    if (prefix && !path.startsWith(prefix)) continue;
    const rest = prefix ? path.slice(prefix.length) || "/" : path;
    const { re, keys } = compile(route.path);
    const m = re.exec(rest);
    if (!m) continue;
    const params: RouteParams = {};
    keys.forEach((k, i) => {
      params[k] = m[i + 1];
    });
    return { route, params };
  }
  return null;
};

/** For the validator: every path in the table, so it can assert each one has a
 *  handler and a reachable fixture. */
export const routePaths = (): string[] => DEMO_ROUTES.map((r) => `${r.method} ${r.path}`);

export type { DemoHandler };
