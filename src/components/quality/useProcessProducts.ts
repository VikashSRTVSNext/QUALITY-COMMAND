import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";
import type { DateRange } from "./dashboardFilters";

export type ProcessProductRow = {
  item: string;
  /** Short name from the Target sheet. Null when the sheet has no row for this
   *  item code, in which case the code stands alone. */
  product_name: string | null;
  boards: number | null;
  done: number | null;
  ok: number | null;
  failed: number | null;
  yield_pct: number | null;
  failure_pct: number | null;
  meets_target: boolean | null;
  /** SMT_DEFECTS only: defect RECORDS behind `failed`, which counts distinct
   *  BOARDS. Several bad joints on one board is one failed board and several
   *  records, so the two must never be added or swapped. Absent on every other
   *  step, which is what makes the column conditional. */
  defect_records?: number | null;
};

type CardShiftRow = {
  shift: string;
  done: number | null;
  ok: number | null;
  failed: number | null;
  yield_pct: number | null;
  failure_pct: number | null;
  status: string | null;
};

type ProcessProductsResponse = {
  step: string;
  metric: "yield" | "failure";
  business_date: string;
  shift: string | null;
  /** What the rows actually cover. Always present — a single day is a range of
   *  one — so a caller never has to choose between this and `business_date`. */
  range: { from: string; to: string; days: number };
  operations: { in?: string[]; like?: string };
  target: number | null;
  target_unit: string | null;
  target_direction: string | null;
  meets_target: boolean | null;
  sort: string;
  page: number;
  page_size: number;
  total_products: number;
  total_pages: number;
  totals: {
    products: number;
    boards: number | null;
    done: number | null;
    ok: number | null;
    failed: number | null;
    yield_pct: number | null;
    failure_pct: number | null;
  };
  unattributed: {
    boards: number | null;
    done: number | null;
    ok: number | null;
    failed: number | null;
    yield_pct: number | null;
  } | null;
  card: CardShiftRow[];
  rows: ProcessProductRow[];
};

// Which steps have a per-product breakdown at all. An explicit allowlist, so no
// tile or tab becomes clickable by accident.
//
// Keys are mart step names (the endpoint's path segment), NOT tile labels — the
// two differ for most steps. DPMOI and SMT_DEFECTS cannot appear here: they are
// not built from the production log, so they have no per-product split. SPI now
// can and does — /process/SPI/products answers with the same keys as the rest;
// only its level two differs.
//
// Lives here rather than beside the modal, because it describes the LEVEL ONE
// data this hook loads. The modal it used to sit in now shows the NC log, which
// is a different question with its own, shorter list of supported steps.
export const DRILLDOWN_STEPS: Record<string, true> = {
  AXI: true, // tile "AXI - S"
  SPI: true, // level two is the pad log, not the NC log
  SMT_DEFECTS: true, // level two is the solder-defect log
  AUTO_OGI: true, // tile "AUTO OGI"
  BURN_IN: true, // tile "BURN-IN - S"
  IP: true,
  LBTS: true, // tile "LBTS - S"
  OTA_TEST: true, // tile "OTA"
  RTWP: true,
  THERMAL_AVI: true, // tile "THERMAL AVI"
};

export const PAGE_SIZE = 12;

export const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export const fmtCount = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-US") : "—";

export const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";

// Column -> the `sort` value the endpoint accepts. Columns absent from here are
// not sortable: the server owns the ordering and rejects an unknown key with a
// 400 rather than returning an unsorted table.
export const SORTABLE: Record<string, string> = {
  product: "product",
  failed: "failed",
  value: "value", // resolved per metric, below
};

// Loads one page of the per-product breakdown behind a process step.
//
// Paging and sorting are SERVER-side — the endpoint hits Postgres and a step can
// carry a long tail of low-volume items, so only one page is ever fetched. That
// is the opposite of the Product Yield table, which gets every row at once from
// a Redis snapshot and slices locally.
//
// Returns the raw response too, because the modal shows the step's own headline
// figure (`card`) beside the table.
export const useProcessProducts = (
  step: string,
  shift: string | null,
  /** Dashboard date range. Both ends null = the live current production day,
   *  which is what every caller did before ranges existed. */
  range?: DateRange | null,
) => {
  const [data, setData] = useState<ProcessProductsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [page, setPage] = useState(1);
  // null lets the server choose: worst-first on whichever metric the step
  // reports, which is the ordering that makes this useful on open.
  const [sort, setSort] = useState<string | null>(null);

  // Depend on the two STRINGS, not the object. The dashboard rebuilds the range
  // object on every render, and an object in the dependency list would refetch
  // the table on each one.
  const rangeFrom = range?.from ?? null;
  const rangeTo = range?.to ?? null;

  /**
   * Drop the previous answer the moment the QUESTION changes.
   *
   * Without this, switching tabs left the outgoing step's rows on screen for the
   * whole of the new request — and because the table only shows its centred
   * "Loading…" when it has no data at all, nothing marked that a fetch was in
   * flight. On a fast step it flickered; on a slow one it read as a tab that had
   * switched and then frozen showing the wrong step's products.
   *
   * Done during render rather than in an effect, which is React's documented way
   * to reset state when a prop changes: an effect would commit one frame of the
   * old rows under the new tab's heading first.
   *
   * Page and sort deliberately do NOT clear it. Paging is the one case where
   * keeping the previous page visible is right — it is the same question, one
   * page further on, and blanking the table between pages would be worse.
   */
  const subject = `${step}\u0000${shift ?? ""}\u0000${rangeFrom ?? ""}\u0000${rangeTo ?? ""}`;
  const [lastSubject, setLastSubject] = useState(subject);
  if (subject !== lastSubject) {
    setLastSubject(subject);
    setData(null);
    setState("loading");
    setPage(1);
    setSort(null);
  }

  useEffect(() => {
    let cancelled = false;
    // The guard covers more than unmount: shift, page and sort can all change
    // mid-flight, and without it a slow first response could land after a
    // faster second and show the wrong page.

    const fetchPage = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(PAGE_SIZE),
        });
        if (shift) params.set("shift", shift);
        if (sort) params.set("sort", sort);
        // Sent only when set. Omitting both is what asks for the live current
        // day, so a range of nulls must NOT become empty query parameters.
        if (range?.from) params.set("date_from", range.from);
        if (range?.to) params.set("date_to", range.to);

        const res = await fetch(
          apiUrl(`/process/${encodeURIComponent(step)}/products?${params}`),
        );
        if (!res.ok) throw new Error(`Failed to fetch ${step} products`);
        const json: ProcessProductsResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Error fetching ${step} product breakdown:`, err);
        setState("error");
      }
    };

    setState("loading");
    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [step, shift, rangeFrom, rangeTo, page, sort]);

  // The page/sort reset that used to live here is now part of the subject check
  // above, which runs a frame earlier. It mattered for the same reason the data
  // clear does: the panel switches tabs WITHOUT remounting this hook, so page 4
  // of the old step would otherwise be requested against the new one.

  const metric = data?.metric ?? "yield";
  const valueSort = metric === "failure" ? "failure" : "yield";

  const applySort = useCallback(
    (column: keyof typeof SORTABLE) => {
      const key = column === "value" ? valueSort : SORTABLE[column];
      setSort(key);
      setPage(1);
    },
    [valueSort],
  );

  const activeSort = data?.sort ?? valueSort;
  const totalPages = data?.total_pages ?? 1;
  const totalProducts = data?.total_products ?? 0;
  const first = totalProducts === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, totalProducts);

  const cardDone = (data?.card ?? []).reduce((a, r) => a + (r.done ?? 0), 0);
  const cardOk = (data?.card ?? []).reduce((a, r) => a + (r.ok ?? 0), 0);
  const cardValue =
    cardDone > 0
      ? metric === "failure"
        ? (100 * (data?.card ?? []).reduce((a, r) => a + (r.failed ?? 0), 0)) /
          cardDone
        : (100 * cardOk) / cardDone
      : null;

  return {
    data,
    state,
    page,
    setPage,
    metric,
    valueSort,
    applySort,
    activeSort,
    totalPages,
    totalProducts,
    first,
    last,
    cardValue,
    pageSize: PAGE_SIZE,
  };
};

export type ProcessProductsQuery = ReturnType<typeof useProcessProducts>;
