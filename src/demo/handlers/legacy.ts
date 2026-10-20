// The legacy axios layer: /production/* and /quality/defects*.
//
// These are served by src/core/api/mocks.ts already, gated on VITE_USE_MOCKS,
// and .env.demo leaves that gate open — so in practice no HTTP request is made
// and these handlers never run.
//
// They exist as a backstop. If VITE_USE_MOCKS is ever set to "false" in a demo
// build, the axios client would otherwise fetch /api/v1/... against whatever
// origin the page is served from. Routing them here means the worst case is a
// demo answer, not a request leaving the machine.

import { endpoints } from "../../core/api/endpoints";
import type { DemoResponse, RouteParams } from "../types";

export const legacyDefectDetailHandler = async (
  _url: URL,
  _request: Request | undefined,
  params: RouteParams,
): Promise<DemoResponse> => {
  const code = decodeURIComponent(params.code ?? "");
  try {
    // Reuses the app's own mock factory rather than duplicating it: this is the
    // one surface that already had a mock path before the demo existed.
    const data = await endpoints.defectDetail(code);
    return { status: 200, body: data };
  } catch {
    return { status: 404, body: { detail: `no defect ${code}` } };
  }
};

/**
 * The three list endpoints behind dead hooks.
 *
 * useProductionLines, useLineDetail and useQualityDefects have no consumer on
 * any mounted route, so nothing renders these. An empty array keeps them from
 * becoming an unmatched-URL failure if that ever changes.
 */
export const legacyListHandler = (): DemoResponse => ({
  status: 200,
  body: [],
});
