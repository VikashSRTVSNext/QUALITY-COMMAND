// Handlers for the /dashboard/* surface.
//
// Each one takes a URL and returns { status, body }, with no knowledge of how
// the request arrived. That is what lets MSW replace the fetch shim later
// without touching this file.
//
// The validation order matters and mirrors the backend: dates reversed, then
// span, then the rolling window. The app checks the same rules client-side and
// refuses to send a bad request, so these 400s are mostly a safety net — but
// they have to carry the same `detail` wording, because that is what the UI
// shows verbatim.

import {
  MAX_RANGE_DAYS,
  rangeDayCount,
} from "../../components/quality/dashboardFilters";
import {
  addCounts,
  auditAverage,
  collapseYieldRows,
  deltaBetween,
  emptyCounts,
  matchesLevel,
  matchesProduct,
  matchesShift,
  repeated,
  shiftParam,
  single,
  totalsFrom,
  type Counts,
  type YieldRowLike,
} from "../aggregations";
import {
  eriFixture,
  kpiDay,
  previousWindow,
  processFilterOptionsFixture,
  processPerformanceDay,
  productsDay,
  resolveWindow,
  safetyFixture,
  yieldDay,
  yieldRecommendationFixture,
} from "../fixtureStore";
import type { DemoResponse } from "../types";

const bad = (detail: string): DemoResponse => ({ status: 400, body: { detail } });

/** The documented 400s, in the backend's own wording. */
const validateRange = (
  from: string | null,
  to: string | null,
  shift: string | null,
): DemoResponse | null => {
  if (from && to && from > to) {
    return bad(`date_from (${from}) is after date_to (${to})`);
  }
  const days = rangeDayCount({ from, to });
  if (days !== null && days > MAX_RANGE_DAYS) {
    return bad(`range of ${days} days exceeds the ${MAX_RANGE_DAYS}-day maximum`);
  }
  if (shift && !["A", "B", "C", "D"].includes(shift.toUpperCase())) {
    return bad(`unknown shift '${shift}'. Valid: A, B, C, D (full day)`);
  }
  return null;
};

const dates = (url: URL) => ({
  from: single(url, "date_from"),
  to: single(url, "date_to"),
});

// ── GET /dashboard/product-yield ────────────────────────────────────────────

export const productYieldHandler = async (url: URL): Promise<DemoResponse> => {
  const { from, to } = dates(url);
  const rawShift = single(url, "shift");
  const invalid = validateRange(from, to, rawShift);
  if (invalid) return invalid;

  const shift = shiftParam(url);
  const level = single(url, "level");
  const products = repeated(url, "product");
  const window = resolveWindow(from, to);

  const perDay = await Promise.all(window.days.map((d) => yieldDay(d)));
  const rows: YieldRowLike[] = [];
  for (const day of perDay) {
    if (!day) continue;
    for (const row of day.rows) {
      if (!matchesShift(row.shift, shift)) continue;
      if (!matchesLevel(row.sub_module, level)) continue;
      if (!matchesProduct(row, products)) continue;
      rows.push(row as YieldRowLike);
    }
  }

  // No dates at all means the snapshot source, which carries no `meta` block.
  // The app keys "did this come from the database" off meta's presence, so it
  // must be absent rather than null here.
  const ranged = Boolean(from || to);
  if (!ranged) {
    return { status: 200, body: { rows } };
  }

  const collapsed = collapseYieldRows(rows, shift);
  return {
    status: 200,
    body: {
      rows: collapsed,
      meta: {
        source: "mart_product_yield",
        from: window.from,
        to: window.to,
        days: rangeDayCount({ from: window.from, to: window.to }) ?? window.days.length,
        shift: shift ?? "D",
        level: level ?? null,
        products,
        // Always true on this source: the per-product table stores no recovery
        // count, so SPY is reconstructed from the stored percentage.
        spy_is_weighted_mean: true,
      },
    },
  };
};

// ── GET /dashboard/kpis ─────────────────────────────────────────────────────

/**
 * Per-day counts for the KPI cards, optionally narrowed to a product set.
 *
 * Under a product filter the counts are recomputed from the yield rows, which
 * is what the real backend does now it reads mart_kpi_product_shift. Without a
 * filter the precomputed day summary is used, so the unfiltered cards cost one
 * small request rather than a scan of every product row.
 */
const kpiCountsFor = async (
  day: string,
  shift: string | null,
  products: string[],
): Promise<{ counts: Counts; audit: number | null; ran: boolean }> => {
  if (products.length === 0) {
    const summary = await kpiDay(day);
    if (!summary) return { counts: emptyCounts(), audit: null, ran: false };
    const source = shift
      ? summary.by_shift.find((r) => r.shift.toUpperCase() === shift)
      : summary.day;
    if (!source) return { counts: emptyCounts(), audit: null, ran: false };
    const counts = addCounts(emptyCounts(), source as Partial<Counts>);
    return {
      counts,
      audit: summary.customer_audit,
      ran: (counts.units_tested ?? 0) + (counts.modules_tested ?? 0) > 0,
    };
  }

  const yieldFixture = await yieldDay(day);
  const summary = await kpiDay(day);
  if (!yieldFixture) return { counts: emptyCounts(), audit: null, ran: false };

  let counts = emptyCounts();
  for (const row of yieldFixture.rows) {
    if (!matchesShift(row.shift, shift)) continue;
    if (!matchesProduct(row, products)) continue;
    const recovered = Math.round((((row.spy ?? 0) - (row.fpy ?? 0)) / 100) * row.tested);
    const passed = row.tested - row.failed;
    counts = addCounts(
      counts,
      row.sub_module === "UNIT"
        ? { units_tested: row.tested, units_passed_fp: passed, units_recovered: recovered }
        : { modules_tested: row.tested, modules_passed_fp: passed, modules_recovered: recovered },
    );
  }
  return {
    counts,
    // The audit is a PLANT score with no product dimension, so under a product
    // filter it comes back null rather than silently unfiltered. The response's
    // filters.customer_audit_filtered says so explicitly.
    audit: products.length > 0 ? null : (summary?.customer_audit ?? null),
    ran: counts.units_tested + counts.modules_tested > 0,
  };
};

export const kpisHandler = async (url: URL): Promise<DemoResponse> => {
  const { from, to } = dates(url);
  const rawShift = single(url, "shift");
  const invalid = validateRange(from, to, rawShift);
  if (invalid) return invalid;

  const shift = shiftParam(url);
  const products = repeated(url, "product");
  const window = resolveWindow(from, to);

  let counts = emptyCounts();
  const audits: (number | null)[] = [];
  const byDate: any[] = [];
  let daysWithData = 0;

  for (const day of window.days) {
    const { counts: c, audit, ran } = await kpiCountsFor(day, shift, products);
    counts = addCounts(counts, c);
    audits.push(audit);
    if (ran) daysWithData += 1;
    byDate.push({ business_date: day, ...totalsFrom(c, audit) });
  }

  // by_shift is the same arithmetic cut a different way, so the shift rows and
  // the date rows always add up to the same totals.
  const byShift: any[] = [];
  for (const s of ["A", "B", "C"]) {
    let sc = emptyCounts();
    for (const day of window.days) {
      const { counts: c } = await kpiCountsFor(day, s, products);
      sc = addCounts(sc, c);
    }
    byShift.push({ shift: s, ...totalsFrom(sc, null) });
  }

  const audit = auditAverage(audits);
  const totals = totalsFrom(counts, audit.score);

  // An equal-length window immediately before this one — a week against the
  // week before it, not against yesterday.
  const prev = previousWindow(window.from, window.to);
  let prevCounts = emptyCounts();
  const prevAudits: (number | null)[] = [];
  for (const day of prev.days) {
    const { counts: c, audit: a } = await kpiCountsFor(day, shift, products);
    prevCounts = addCounts(prevCounts, c);
    prevAudits.push(a);
  }
  const prevTotals = totalsFrom(prevCounts, auditAverage(prevAudits).score);

  return {
    status: 200,
    body: {
      filters: {
        products,
        source: products.length > 0 ? "mart_kpi_product_shift" : "mart_kpi_shift",
        customer_audit_filtered: products.length === 0,
      },
      range: {
        from: window.from,
        to: window.to,
        days: rangeDayCount({ from: window.from, to: window.to }) ?? window.days.length,
        shift,
        // 0 means nothing ran. That is how "no production" is told apart from
        // "the request broke" — the UI renders an empty state, never 0%.
        days_with_data: daysWithData,
      },
      totals,
      by_shift: byShift,
      by_date: byDate,
      previous: { from: prev.from, to: prev.to, spy_exact: true, ...prevTotals },
      delta_vs_previous: deltaBetween(totals, prevTotals),
      customer_audit: {
        area: "Customer Quality Audit",
        score: audit.score,
        days_reported: audit.days_reported,
        days_in_range: window.days.length,
      },
      spy_exact: true,
    },
  };
};

// ── GET /dashboard/process-performance ──────────────────────────────────────

export const processPerformanceHandler = async (url: URL): Promise<DemoResponse> => {
  const { from, to } = dates(url);
  const invalid = validateRange(from, to, null);
  if (invalid) return invalid;

  const products = repeated(url, "product");
  const lines = repeated(url, "line");
  const window = resolveWindow(from, to);
  const options = await processFilterOptionsFixture();
  const lineSteps: string[] = options?.line_steps ?? [];

  /**
   * Does this step answer under the requested line selection?
   *
   * Checked against the step's OWN lines, not just membership of line_steps:
   * selecting an SMT line must not leave the MAC cards showing figures that
   * line never touched. Steps with no line attribution at all (rework,
   * off-line sample tests) drop out of a line-filtered response entirely.
   */
  const reachedByLines = (step: string): boolean => {
    if (lines.length === 0) return true;
    if (!lineSteps.includes(step)) return false;
    const stepLines: string[] = options?.steps?.[step]?.lines ?? [];
    return stepLines.some((l) => lines.includes(l));
  };

  const perDay = await Promise.all(window.days.map((d) => processPerformanceDay(d)));
  const merged: Record<string, any> = {};

  for (const day of perDay) {
    if (!day?.steps) continue;
    for (const [step, payload] of Object.entries<any>(day.steps)) {
      // With any line set, only the cards that line reaches answer. A step
      // missing from `steps` under a filter means "no data for this selection",
      // never "use the unfiltered figure".
      if (!reachedByLines(step)) continue;
      const acc = merged[step] ?? {
        ...payload,
        day: { done: 0, ok: 0, failed: 0, defects: 0, opportunities: 0 },
        by_shift: [],
        // The range source carries no trend: the buckets are per-shift slices
        // of one day and have no meaning across a window.
        trend: null,
      };
      for (const k of ["done", "ok", "failed", "defects", "opportunities"]) {
        acc.day[k] = (acc.day[k] ?? 0) + (payload.day?.[k] ?? 0);
      }
      for (const row of payload.by_shift ?? []) {
        const existing = acc.by_shift.find((r: any) => r.shift === row.shift);
        if (!existing) {
          acc.by_shift.push({ ...row });
        } else {
          for (const k of ["done", "ok", "failed", "defects", "opportunities"]) {
            existing[k] = (existing[k] ?? 0) + (row[k] ?? 0);
          }
        }
      }
      merged[step] = acc;
    }
  }

  // Percentages recomputed once, at the end, from the summed counts.
  //
  // Each step publishes ONE metric. The dashboard checks failure_pct before
  // yield_pct and renders whichever it finds first, so emitting both would make
  // every yield tile take the failure branch and show a blank value.
  const finish = (row: any, kind: "dpmo" | "failure" | "yield") => {
    if (kind === "dpmo") {
      row.index =
        row.opportunities > 0
          ? Math.round((row.defects / row.opportunities) * 1e6 * 100) / 100
          : null;
      return;
    }
    if (kind === "failure") {
      row.failure_pct = row.done > 0 ? Math.round((row.failed / row.done) * 10000) / 100 : null;
      delete row.yield_pct;
      return;
    }
    row.yield_pct = row.done > 0 ? Math.round((row.ok / row.done) * 10000) / 100 : null;
    delete row.failure_pct;
  };

  for (const [step, payload] of Object.entries<any>(merged)) {
    const kind: "dpmo" | "failure" | "yield" =
      step === "DPMOI"
        ? "dpmo"
        // Which metric a step reports is decided by what the fixture published,
        // not by a list here — so a new step needs no change in this file.
        : payload.day?.failure_pct !== undefined ||
          payload.by_shift?.[0]?.failure_pct !== undefined
          ? "failure"
          : "yield";
    finish(payload.day, kind);
    for (const row of payload.by_shift) finish(row, kind);
    if (kind === "dpmo") {
      payload.defects = payload.day.defects;
      payload.opportunities = payload.day.opportunities;
      payload.index = payload.day.index;
    }
    payload.no_data = (payload.day.done ?? 0) === 0;
  }

  return {
    status: 200,
    body: {
      steps: merged,
      filters: { products, lines, line_steps: lineSteps, source: "mart_process_step" },
    },
  };
};

// ── GET /dashboard/products ─────────────────────────────────────────────────

export const productsHandler = async (url: URL): Promise<DemoResponse> => {
  const { from, to } = dates(url);
  const invalid = validateRange(from, to, null);
  if (invalid) return invalid;

  const window = resolveWindow(from, to);
  const perDay = await Promise.all(window.days.map((d) => productsDay(d)));

  // Union across the window, summing volume. A product that ran on any day in
  // the range must be offerable, or the dropdown would hide rows the table
  // shows.
  const byItem = new Map<string, any>();
  for (const day of perDay) {
    for (const option of day?.products ?? []) {
      const existing = byItem.get(option.item);
      if (!existing) byItem.set(option.item, { ...option });
      else existing.tested = (existing.tested ?? 0) + (option.tested ?? 0);
    }
  }

  return {
    status: 200,
    body: {
      range: {
        from: window.from,
        to: window.to,
        days: rangeDayCount({ from: window.from, to: window.to }) ?? window.days.length,
      },
      // Sorted by display name, as documented.
      products: [...byItem.values()].sort((a, b) => a.product.localeCompare(b.product)),
    },
  };
};

// ── GET /dashboard/process-filter-options ───────────────────────────────────

export const processFilterOptionsHandler = async (url: URL): Promise<DemoResponse> => {
  const { from, to } = dates(url);
  const invalid = validateRange(from, to, null);
  if (invalid) return invalid;

  const window = resolveWindow(from, to);
  const fixture = await processFilterOptionsFixture();
  if (!fixture) return { status: 200, body: { range: { from: window.from, to: window.to }, site_code: "IN04", line_steps: [], steps: {} } };

  return {
    status: 200,
    body: { ...fixture, range: { from: window.from, to: window.to } },
  };
};

// ── GET /dashboard/safety, /dashboard/eri, /yield-recommendation ────────────

export const safetyHandler = async (): Promise<DemoResponse> => ({
  status: 200,
  body: (await safetyFixture()) ?? { current: null, periods: [] },
});

export const eriHandler = async (): Promise<DemoResponse> => ({
  status: 200,
  body: (await eriFixture()) ?? {},
});

export const yieldRecommendationHandler = async (): Promise<DemoResponse> => ({
  status: 200,
  body: (await yieldRecommendationFixture()) ?? {
    products: [],
    plan_month: null,
    plan_available: false,
  },
});
