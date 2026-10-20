// Handlers for the /process/* drill-down surface.
//
// Three of these answer with a NON-200 that is not an error, and reproducing
// them matters more than it looks — the UI renders a distinct state for each,
// and collapsing them all to 200 would hide behaviour the demo is meant to show:
//
//   501  /testers for a step with no verified rework mapping -> "unsupported"
//   404  /SPI/.../defects with no inspected boards           -> "stale"
//   404  /dpmoi/detail, /screw-defects/positions with no row -> message shown
//   503  /images when the store is unconfigured              -> silent
//
// Ranges are honoured where the hooks send them: these endpoints take
// business_date OR date_from/date_to, and a range always wins over a single
// date because the backend ignores business_date once either is present.

import {
  intParam,
  isStepSortKey,
  paginate,
  single,
  sortStepRows,
} from "../aggregations";
import {
  dpmoiDay,
  latestDay,
  resolveWindow,
  screwDefectsDay,
  stepDefectsDay,
  stepProductsDay,
  stepTestersDay,
} from "../fixtureStore";
import type { DemoResponse, RouteParams } from "../types";

/** Steps whose level-one breakdown exists. Mirrors DRILLDOWN_STEPS. */
const DRILLDOWN_STEPS = new Set([
  "AXI", "SPI", "SMT_DEFECTS", "AUTO_OGI", "BURN_IN",
  "IP", "LBTS", "OTA_TEST", "RTWP", "THERMAL_AVI",
  "UNIT_TEST", "MODULE_TEST",
]);

/** Steps whose NC log (level two) is mapped. Mirrors DEFECT_DRILLDOWN_STEPS. */
const NC_LOG_STEPS = new Set([
  "RTWP", "OTA_TEST", "BURN_IN", "IP", "LBTS",
  "AUTO_OGI", "AXI", "UNIT_TEST", "THERMAL_AVI", "MODULE_TEST",
]);

/** Steps with a camera. Mirrors IMAGE_STEPS. */
const IMAGE_STEPS = new Set(["THERMAL_AVI", "AUTO_OGI", "AXI"]);

/**
 * The window a drill-down is asking about.
 *
 * `business_date` is the single-day form; date_from/date_to is the range form
 * and takes precedence, because the endpoint ignores business_date once either
 * range bound is present.
 */
const windowOf = (url: URL) => {
  const from = single(url, "date_from");
  const to = single(url, "date_to");
  if (from || to) return resolveWindow(from, to);
  const businessDate = single(url, "business_date");
  if (businessDate) return resolveWindow(businessDate, businessDate);
  return resolveWindow(null, null);
};

const notFound = (detail: string): DemoResponse => ({ status: 404, body: { detail } });
const notImplemented = (detail: string): DemoResponse => ({ status: 501, body: { detail } });

// ── GET /process/{step}/products ────────────────────────────────────────────

export const stepProductsHandler = async (
  url: URL,
  _req: Request | undefined,
  params: RouteParams,
): Promise<DemoResponse> => {
  const step = decodeURIComponent(params.step ?? "");
  if (!DRILLDOWN_STEPS.has(step)) {
    return notFound(`no per-product breakdown for step '${step}'`);
  }

  const sort = single(url, "sort");
  // An unknown sort key is a 400 by design: the server owns the ordering and
  // refuses to return an unsorted table rather than guess.
  if (sort && !isStepSortKey(sort)) {
    return {
      status: 400,
      body: { detail: `unknown sort '${sort}'` },
    };
  }

  const window = windowOf(url);
  const shift = single(url, "shift");
  const page = intParam(url, "page", 1);
  const pageSize = intParam(url, "page_size", 12);

  const perDay = await Promise.all(window.days.map((d) => stepProductsDay(step, d)));
  const present = perDay.filter(Boolean) as any[];
  if (present.length === 0) {
    // An empty window is a 200 with no rows, not an error.
    return {
      status: 200,
      body: {
        step, metric: "yield", business_date: window.to, shift,
        operations: {}, target: null, target_unit: null, target_direction: null,
        meets_target: null, sort: sort ?? "yield", page: 1, page_size: pageSize,
        total_products: 0, total_pages: 1,
        totals: { products: 0, boards: 0, done: 0, ok: 0, failed: 0, yield_pct: null, failure_pct: null },
        unattributed: null, card: [], rows: [],
      },
    };
  }

  const base = present[0];
  // Sum per item across the window, then take the percentage once.
  const byItem = new Map<string, any>();
  for (const day of present) {
    for (const row of day.rows) {
      const acc = byItem.get(row.item);
      if (!acc) {
        byItem.set(row.item, { ...row });
        continue;
      }
      for (const k of ["boards", "done", "ok", "failed", "defect_records"]) {
        if (row[k] != null) acc[k] = (acc[k] ?? 0) + row[k];
      }
    }
  }
  const rows = [...byItem.values()].map((r) => ({
    ...r,
    yield_pct: r.done > 0 ? Math.round((r.ok / r.done) * 10000) / 100 : null,
    failure_pct: r.done > 0 ? Math.round((r.failed / r.done) * 10000) / 100 : null,
  }));

  const metric: "yield" | "failure" = base.metric === "failure" ? "failure" : "yield";
  const sorted = sortStepRows(rows, sort, single(url, "order"), metric);
  const paged = paginate(sorted, page, pageSize);

  const sum = (k: string) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const done = sum("done");
  const ok = sum("ok");
  const failed = sum("failed");

  return {
    status: 200,
    body: {
      ...base,
      business_date: window.to,
      shift,
      sort: sort ?? metric,
      ...paged,
      totals: {
        products: rows.length,
        boards: sum("boards"),
        done, ok, failed,
        yield_pct: done > 0 ? Math.round((ok / done) * 10000) / 100 : null,
        failure_pct: done > 0 ? Math.round((failed / done) * 10000) / 100 : null,
      },
    },
  };
};

// ── GET /process/{step}/products/{item}/testers ─────────────────────────────

export const testersHandler = async (
  url: URL,
  _req: Request | undefined,
  params: RouteParams,
): Promise<DemoResponse> => {
  const step = decodeURIComponent(params.step ?? "");
  const item = decodeURIComponent(params.item ?? "");

  // SMT_DEFECTS has no first-pass tester to attribute to: a defect raised at a
  // rework station never had one. The real endpoint answers 501 and the UI
  // shows "unsupported" rather than an error.
  if (!NC_LOG_STEPS.has(step)) {
    return notImplemented(
      `tester attribution is not mapped for step '${step}'`,
    );
  }

  const window = windowOf(url);
  for (const day of [...window.days].reverse()) {
    const fixture = await stepTestersDay(step, day);
    const payload = fixture?.byItem?.[item];
    if (payload) return { status: 200, body: payload };
  }
  return notFound(`no tester rows for ${item} in this window`);
};

// ── GET /process/{step}/products/{item}/defects ─────────────────────────────

/**
 * Three different response shapes behind one route template.
 *
 * SMT_DEFECTS and SPI have their own payloads and their own hooks; everything
 * else is the MES NC log. Dispatched on the step rather than merged, because
 * the three share almost no keys.
 */
export const defectsHandler = async (
  url: URL,
  _req: Request | undefined,
  params: RouteParams,
): Promise<DemoResponse> => {
  const step = decodeURIComponent(params.step ?? "");
  const item = decodeURIComponent(params.item ?? "");
  const window = windowOf(url);

  const load = async () => {
    for (const day of [...window.days].reverse()) {
      const fixture = await stepDefectsDay(step, day);
      const payload = fixture?.byItem?.[item];
      if (payload) return payload;
    }
    return null;
  };

  if (step === "SPI") {
    const payload = await load();
    // 404 here is a fourth state, not a failure: no inspected boards for this
    // item in the window. The UI calls it "stale" and shows the detail.
    if (!payload) {
      return notFound(`No inspected boards for ${item} in this window.`);
    }
    return { status: 200, body: applySpiFilters(payload, url) };
  }

  if (step === "SMT_DEFECTS") {
    const payload = await load();
    if (!payload) return { status: 200, body: emptySmt(item, window.to) };
    return { status: 200, body: applySmtFilters(payload, url) };
  }

  if (!NC_LOG_STEPS.has(step)) {
    return notImplemented(`the NC log is not mapped for step '${step}'`);
  }

  const payload = await load();
  if (!payload) {
    return { status: 200, body: emptyNcLog(item, step, window.to) };
  }
  return { status: 200, body: applyNcFilters(payload, url) };
};

/**
 * Display filters for the NC log.
 *
 * `parent` and `categories` stay product-wide regardless of the filters — the
 * breakdown describes the product, and narrowing it would make the chart move
 * when a row is selected.
 *
 * Field names are NcLogRow's: the code is `nc`, the timestamp `date_time`, and
 * verification is the string `verified_state`, not a boolean.
 */
const applyNcFilters = (payload: any, url: URL) => {
  const resource = single(url, "resource");
  const category = single(url, "category");
  const timesRaw = single(url, "times_processed");
  const times = timesRaw == null ? null : Number(timesRaw);
  const verifiedOnly = single(url, "verified_only") === "true";

  const log = (payload.nc_log ?? []).filter((row: any) => {
    if (resource && row.resource !== resource) return false;
    if (category && row.category !== category) return false;
    if (times != null && row.times_processed !== times) return false;
    if (verifiedOnly && row.verified_state !== "VERIFIED") return false;
    return true;
  });

  return {
    ...payload,
    // Renumbered so the row numbers the operator reads are contiguous under a
    // filter rather than jumping where rows were removed.
    nc_log: log.map((row: any, i: number) => ({ ...row, slno: i + 1 })),
    nc_log_events: log.length,
    selection: {
      units: new Set(log.map((r: any) => r.sfc)).size,
      events: log.length,
    },
    filter: {
      resource,
      category,
      times_processed: times,
      verified_only: verifiedOnly,
    },
  };
};

const applySmtFilters = (payload: any, url: URL) => {
  const resource = single(url, "resource");
  // "category", not "nc" — the route is shared with the MES steps, so the
  // parameter keeps the MES name and carries the NC code.
  const nc = single(url, "category") ?? single(url, "nc");
  const timesRaw = single(url, "times_processed");
  const times = timesRaw == null ? null : Number(timesRaw);

  const log = (payload.log ?? []).filter((row: any) => {
    if (resource && row.resource !== resource) return false;
    if (nc && row.nc !== nc) return false;
    if (times != null && row.times_processed !== times) return false;
    return true;
  });

  return {
    ...payload,
    log: log.map((row: any, i: number) => ({ ...row, slno: i + 1 })),
    log_records: log.length,
    filters: { nc, resource, times_processed: times },
  };
};

/**
 * Display filters for the SPI pad log.
 *
 * The machine column is `tester_id` here, not `resource` — but the QUERY
 * parameter is still `resource`, because the route is shared with the MES
 * steps. `selection` counts boards and pads separately: they are different
 * units and must never be added.
 */
const applySpiFilters = (payload: any, url: URL) => {
  const resource = single(url, "resource");
  const code = single(url, "category");
  const side = single(url, "pcb_side");

  const padLog = (payload.pad_log ?? []).filter((row: any) => {
    if (resource && row.tester_id !== resource) return false;
    if (code && row.defect_result_name !== code) return false;
    if (side && row.pcb_side !== side) return false;
    return true;
  });

  return {
    ...payload,
    pad_log: padLog.map((row: any, i: number) => ({ ...row, slno: i + 1 })),
    selection: {
      boards: new Set(padLog.map((r: any) => r.sfc)).size,
      pads: padLog.length,
    },
  };
};

const emptyNcLog = (item: string, step: string, day: string) => ({
  step,
  item,
  product_name: item,
  business_date: day,
  window: { from: day, to: day },
  operations: { test: [], rework: [] },
  parent: { boards: 0, done: 0, ok: 0, failed: 0, yield_pct: null },
  categories: [],
  uncategorised: [],
  undispositioned: { events: 0, units: 0 },
  carried_over: { events: 0, units: 0 },
  nc_log_events: 0,
  selection: { units: 0, events: 0 },
  nc_log: [],
  filter: { resource: null, category: null, times_processed: null, verified_only: false },
});

const emptySmt = (item: string, day: string) => ({
  step: "SMT_DEFECTS",
  item,
  product_name: item,
  business_date: day,
  site_code: "IN04",
  window: { from: day, to: day },
  filters: { resource: null, nc: null, times_processed: null },
  parent: { boards: 0, done: 0, ok: 0, failed: 0, defect_records: 0, failure_pct: null },
  boards: 0,
  records: 0,
  by_nc: [], by_ref_des: [], by_component: [], resources: [],
  missing: { ref_des: 0, component: 0, resource: 0, nc_description: 0 },
  log_records: 0,
  log: [],
});

// ── DPMOI ───────────────────────────────────────────────────────────────────

export const dpmoiBreakdownHandler = async (url: URL): Promise<DemoResponse> => {
  const window = windowOf(url);
  const shift = single(url, "shift");
  const perDay = await Promise.all(window.days.map((d) => dpmoiDay(d)));
  const present = perDay.filter(Boolean) as any[];

  const byKey = new Map<string, any>();
  for (const day of present) {
    for (const row of day.rows) {
      const key = `${row.item}|${row.operation}`;
      const acc = byKey.get(key);
      if (!acc) byKey.set(key, { ...row });
      else {
        acc.boards += row.boards;
        acc.defects += row.defects;
        acc.opportunities += row.opportunities;
      }
    }
  }
  const rows = [...byKey.values()].map((r) => ({
    ...r,
    index: r.opportunities > 0
      ? Math.round((r.defects / r.opportunities) * 1e6 * 100) / 100
      : null,
  }));

  const sum = (k: string) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const defects = sum("defects");
  const opportunities = sum("opportunities");

  return {
    status: 200,
    body: {
      rows,
      totals: {
        boards: sum("boards"), defects, opportunities,
        index: opportunities > 0
          ? Math.round((defects / opportunities) * 1e6 * 100) / 100
          : null,
      },
      missing_opportunities: [],
      operations: { in: ["AOI_TOP_REWORK_IN04", "AOI_BOT_REWORK_IN04"] },
      range: { from: window.from, to: window.to },
      shift,
    },
  };
};

export const dpmoiDetailHandler = async (url: URL): Promise<DemoResponse> => {
  const item = single(url, "item");
  const operation = single(url, "operation");
  if (!item || !operation) {
    return { status: 422, body: { detail: "item and operation are required" } };
  }

  const window = windowOf(url);
  for (const day of [...window.days].reverse()) {
    const fixture = await dpmoiDay(day);
    const row = fixture?.rows?.find(
      (r: any) => r.item === item && r.operation === operation,
    );
    if (!row) continue;
    const defects = await stepDefectsDay("AXI", day);
    const log = defects?.byItem?.[item]?.nc_log ?? [];
    return {
      status: 200,
      body: {
        parent: {
          item, operation,
          product_name: row.product_name,
          business_date: day,
          boards: row.boards,
          opportunities: row.opportunities,
        },
        by_category: [
          { category: "SMT", records: row.defects, opportunities: row.opportunities, codes: ["SOLDER_BRIDGE", "COLD_JOINT"] },
        ],
        by_nc: tally(log, "nc"),
        by_ref_des: tally(log, "ref_des"),
        by_component: tally(log, "component"),
        resources: tally(log, "resource"),
        log,
        opportunities_incomplete: false,
        boards_affected: row.defects,
        records: row.defects,
        missing: 0,
      },
    };
  }
  // The real endpoint's 404 message, shown verbatim by the modal.
  return notFound("No DPMOI row for this board on this day.");
};

const tally = (rows: any[], key: string) => {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = row[key];
    if (k == null) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([k, records]) => ({ [key]: k, key: k, records, boards: records }));
};

// ── Screw defects ───────────────────────────────────────────────────────────

export const screwBreakdownHandler = async (url: URL): Promise<DemoResponse> => {
  const window = windowOf(url);
  const shift = single(url, "shift");
  const perDay = await Promise.all(window.days.map((d) => screwDefectsDay(d)));
  const present = perDay.filter(Boolean) as any[];

  const byKey = new Map<string, any>();
  for (const day of present) {
    for (const row of day.rows) {
      const key = `${row.line}|${row.operation}|${row.item}`;
      const acc = byKey.get(key);
      if (!acc) byKey.set(key, { ...row });
      else {
        acc.boards += row.boards;
        acc.screws_driven += row.screws_driven;
        acc.screws_failed += row.screws_failed;
      }
    }
  }
  const rows = [...byKey.values()].map((r) => ({
    ...r,
    failure_pct: r.screws_driven > 0
      ? Math.round((r.screws_failed / r.screws_driven) * 10000) / 100
      : null,
  }));

  const sum = (k: string) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const driven = sum("screws_driven");
  const failed = sum("screws_failed");

  return {
    status: 200,
    body: {
      rows,
      totals: {
        boards: sum("boards"),
        screws_driven: driven,
        screws_failed: failed,
        failure_pct: driven > 0 ? Math.round((failed / driven) * 10000) / 100 : null,
      },
      uncovered: [],
      operations: { in: ["SCREW_TOP_IN04", "SCREW_BOT_IN04"] },
      range: { from: window.from, to: window.to },
      shift,
    },
  };
};

export const screwPositionsHandler = async (url: URL): Promise<DemoResponse> => {
  const line = single(url, "line");
  const operation = single(url, "operation");
  const item = single(url, "item");
  if (!line || !operation) {
    return { status: 422, body: { detail: "line and operation are required" } };
  }

  const window = windowOf(url);
  for (const day of [...window.days].reverse()) {
    const fixture = await screwDefectsDay(day);
    const matching = (fixture?.rows ?? []).filter(
      (r: any) =>
        r.line === line &&
        r.operation === operation &&
        (!item || r.item === item),
    );
    if (matching.length === 0) continue;

    const screws = matching[0].no_of_screws ?? 12;
    const failedTotal = matching.reduce((a: number, r: any) => a + r.screws_failed, 0);
    // Worst-first, not board order.
    const positions = Array.from({ length: screws }, (_, i) => ({
      position: i + 1,
      screws_failed: Math.max(0, Math.round(failedTotal / screws) - (i % 3)),
      boards_affected: Math.max(0, Math.round(failedTotal / screws / 2)),
    })).sort((a, b) => b.screws_failed - a.screws_failed);

    return {
      status: 200,
      body: {
        parent: {
          line, operation, item: item ?? null,
          product_name: item ? matching[0].product_name : null,
          business_date: day,
          no_of_screws: screws,
          boards: matching.reduce((a: number, r: any) => a + r.boards, 0),
        },
        positions,
        log: [],
        by_check: [],
        screws_failed: failedTotal,
        boards_affected: positions.reduce((a, p) => a + p.boards_affected, 0),
        records: failedTotal,
        max_position: screws,
        position_exceeds_master: false,
      },
    };
  }
  return notFound("No screws driven at this station on this day.");
};

// ── Inspection images ───────────────────────────────────────────────────────

/**
 * Images are SYNTHESISED, not fixtures.
 *
 * There is no photo corpus in the demo, and shipping real inspection images
 * would be both large and not ours to ship. Steps with a camera answer with a
 * generated manifest whose entries resolve to inline SVG placeholders, so the
 * viewer's layout, paging and zoom all work; steps without one answer 404, and
 * a 503 path is kept because that is what "image store unconfigured" looks like
 * and the UI stays silent for it rather than showing an error.
 */
export const imagesHandler = async (
  url: URL,
  _req: Request | undefined,
  params: RouteParams,
): Promise<DemoResponse> => {
  const step = decodeURIComponent(params.step ?? "");
  const item = decodeURIComponent(params.item ?? "");
  if (!IMAGE_STEPS.has(step)) {
    return notFound(`step '${step}' has no inspection camera`);
  }

  const window = windowOf(url);
  const day = window.days[window.days.length - 1] ?? latestDay();
  const store = step === "AXI" ? "axi" : "avi";
  const defects = await stepDefectsDay(step, day);
  const log = defects?.byItem?.[item]?.nc_log ?? [];
  const sfcs = [...new Set(log.map((r: any) => r.sfc))].slice(0, 12) as string[];

  const bySfc: Record<string, any> = {};
  for (const sfc of sfcs) {
    const key = `${store}/${day}/${item}/${sfc}.zip`;
    bySfc[sfc] = {
      sfc,
      // AXI archives carry no PASS/FAIL verdict at all, so `result` is null and
      // retries is always 0.
      result: store === "axi" ? null : "FAIL",
      retries: store === "axi" ? 0 : 1,
      archives: [{ key, archive_bytes: 48_000, images: 2 }],
    };
  }

  return {
    status: 200,
    body: {
      by_sfc: bySfc,
      store,
      units: sfcs.length,
      archives: sfcs.length,
      retried_units: 0,
      outside_window: 0,
      prefixes: [`${step}_INSPECTION_IN04`],
      item_folder: item,
      ...(store === "axi"
        ? {
            product_name: single(url, "product_name"),
            // Shapes match ImagesResponse in useUnitImages.ts: `matched_folders`
            // is a list of objects (NOT bare strings) and `available_folders`
            // is a machine -> folders record. NcLogTable renders these in its
            // "nothing matched" branch, so getting the shape wrong would show
            // garbage there the first time a product had no archive.
            folder_candidates: [item],
            matched_folders: [
              { machine: `${step}_INSPECTION_IN04`, year: Number(day.slice(0, 4)), folder: item },
            ],
            available_folders: { [`${step}_INSPECTION_IN04`]: [item] },
          }
        : {}),
    },
  };
};

export const imageArchiveHandler = async (url: URL): Promise<DemoResponse> => {
  const store = single(url, "store");
  const key = single(url, "key");
  if (!store || !key) {
    return { status: 403, body: { detail: "store and key are required" } };
  }
  return {
    status: 200,
    body: {
      key,
      store,
      archive_bytes: 48_000,
      images: 2,
      // `content_type` is REQUIRED by ArchiveEntry in useUnitImages.ts, and
      // UnitImageViewer filters on `e.content_type.startsWith("image/")`.
      // Omitting it threw "Cannot read properties of undefined (reading
      // 'startsWith')" the moment the image viewer opened — a crash that only
      // appeared in demo mode, because live always sends the field.
      entries: [
        { entry: "top.svg", bytes: 24_000, content_type: "image/svg+xml" },
        { entry: "bottom.svg", bytes: 24_000, content_type: "image/svg+xml" },
      ],
    },
  };
};

/**
 * A generated SVG standing in for an inspection photo.
 *
 * Served as image/svg+xml so <img src> resolves and the viewer behaves exactly
 * as it does with a real photo. Deterministic: the same key and entry always
 * produce the same placeholder.
 */
export const imageFileHandler = (url: URL): DemoResponse => {
  const key = single(url, "key") ?? "";
  const entry = single(url, "entry") ?? "";
  const sfc = /\/([^/]+)\.zip$/.exec(key)?.[1] ?? "unit";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<rect width="640" height="480" fill="#0f1720"/>
<g fill="none" stroke="#1f2b38" stroke-width="1">
${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="640" y2="${i * 40}"/><line x1="${i * 53}" y1="0" x2="${i * 53}" y2="480"/>`).join("\n")}
</g>
<rect x="210" y="170" width="220" height="140" fill="none" stroke="#f59e0b" stroke-width="3"/>
<text x="320" y="110" fill="#8fa0b5" font-family="monospace" font-size="20" text-anchor="middle">DEMO INSPECTION IMAGE</text>
<text x="320" y="250" fill="#e2e8f0" font-family="monospace" font-size="22" text-anchor="middle">${sfc}</text>
<text x="320" y="360" fill="#5b6b7d" font-family="monospace" font-size="15" text-anchor="middle">${entry}</text>
</svg>`;
  return {
    status: 200,
    blob: new Blob([svg], { type: "image/svg+xml" }),
    headers: { "Content-Type": "image/svg+xml" },
  };
};
