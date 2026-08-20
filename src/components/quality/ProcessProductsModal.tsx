import React, { useCallback, useEffect, useState } from "react";

// Per-product breakdown behind a Process Performance tile.
//
// The tile shows one figure for a whole step; this shows which products make it
// up, worst first, so an under-target step names the items dragging it down.
//
// Reads GET /process/{step}/products. Pagination and sorting are SERVER-side —
// unlike the Product Yield table, which holds every row and slices locally. A
// step can carry a long tail of low-volume items, so only one page is ever
// fetched.

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { apiUrl } from "../../core/api/config";
import { palette } from "../../theme/palette";


// Which steps a tile can drill into. An explicit allowlist, so no tile becomes
// clickable by accident.
//
// Keys are mart step names (the endpoint's path segment), NOT tile labels — the
// two differ for most steps, so each entry names its tile. ProcessMetricCard
// does the tile -> step lookup via API_KEY_BY_TILE in metrics.ts.
//
// SPI, DPMOI and SMT_DEFECTS can never appear here: they are not built from the
// production log, so they have no per-product breakdown.
export const DRILLDOWN_STEPS: Record<string, true> = {
  AXI: true, // tile "AXI - S"
  AUTO_OGI: true, // tile "AUTO OGI"
  BURN_IN: true, // tile "BURN-IN - S"
  IP: true,
  LBTS: true, // tile "LBTS - S"
  OTA_TEST: true, // tile "OTA"
  RTWP: true,
  THERMAL_AVI: true, // tile "THERMAL AVI"
};

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

const PAGE_SIZE = 12;

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const fmtCount = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-US") : "—";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";

// Column -> the `sort` value the endpoint accepts. Columns absent from here are
// not sortable: the server owns the ordering and rejects an unknown key with a
// 400 rather than returning an unsorted table.
const SORTABLE: Record<string, string> = {
  product: "product",
  failed: "failed",
  value: "value", // resolved per metric below — yield for yield cards, failure for defect cards
};

type Props = {
  /** Mart step name, e.g. "RTWP" — the endpoint's path segment. */
  step: string;
  /** Tile label, so the header matches the card that was clicked. */
  title: string;
  shift: string | null;
  onClose: () => void;
};

export const ProcessProductsModal: React.FC<Props> = ({
  step,
  title,
  shift,
  onClose,
}) => {
  const [data, setData] = useState<ProcessProductsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | null>(null);
  // null lets the server choose: worst-first on whichever metric the step
  // reports, which is the ordering that makes the modal useful on open.

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
  }, [step, shift, page, sort]);

  // Shift is a dashboard-wide control and can change while this is open. Page 4
  // of the full day may not exist for shift C, so page 1 is the only safe
  // landing spot.
  useEffect(() => {
    setPage(1);
  }, [shift]);

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

  const th =
    "pb-2 pt-1 font-black sticky top-0 bg-panel border-b border-line-modal z-10 select-none";
  const sortable = "cursor-pointer hover:text-white transition-colors";
  const caret = (key: string) => (activeSort === key ? " ▾" : "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-page/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px] max-h-[85vh] bg-panel/95 border border-line-soft rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center bg-white/[0.04] px-6 py-4 border-b border-line-modal flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[16px] font-black text-white uppercase tracking-wider">
              {title}
            </span>
            <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider">
              By Product
            </span>
            {isNum(cardValue) && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
                <span className="w-1 h-1 rounded-full bg-ink-dim" />
                Card {fmtPct(cardValue)}
                {isNum(data?.target) && (
                  <span className="text-ink-dim">
                    {" "}
                    / Tgt {data!.target}
                    {data!.target_unit === "percent" ? "%" : ""}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-ink-dim">
              {data?.business_date ?? ""}
              {shift ? ` · Shift ${shift}` : " · Full Day"}
            </span>
            <button
              onClick={onClose}
              className="bg-raised hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-2 border-b border-line-modal/50 flex-shrink-0">
          <span className="text-[10px] font-bold text-ink-dim uppercase tracking-wider">
            {data?.operations?.like
              ? `Operations like ${data.operations.like}`
              : (data?.operations?.in ?? []).join(", ")}
            <span className="text-[#4a5c72]"> · first attempts only</span>
          </span>
          <span className="text-[11px] font-bold text-ink-dim">
            {totalProducts} {totalProducts === 1 ? "product" : "products"}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-6 py-3">
          {state === "loading" && !data ? (
            <div className="flex items-center justify-center py-16 text-[12px] font-bold text-ink-dim">
              Loading…
            </div>
          ) : state === "error" ? (
            <div className="flex items-center justify-center py-16 text-[12px] font-bold text-critical">
              Could not load the product breakdown
            </div>
          ) : (data?.rows ?? []).length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[12px] font-bold text-ink-dim">
              No production for this step in the selected window
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] text-ink-dim uppercase tracking-wider">
                <tr>
                  <th
                    className={`${th} ${sortable}`}
                    onClick={() => applySort("product")}
                  >
                    Product{caret("product")}
                  </th>
                  <th className={`${th} text-right`}>Done</th>
                  <th className={`${th} text-right`}>OK</th>
                  <th
                    className={`${th} ${sortable} text-right`}
                    onClick={() => applySort("failed")}
                  >
                    Failed{caret("failed")}
                  </th>
                  <th
                    className={`${th} ${sortable} text-right`}
                    onClick={() => applySort("value")}
                  >
                    {metric === "failure" ? "Failure %" : "Yield %"}
                    {caret(valueSort)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {(data?.rows ?? []).map((row) => {
                  const value =
                    metric === "failure" ? row.failure_pct : row.yield_pct;
                  // Null verdict means no target agreed for the step, or this
                  // product produced nothing. Neutral, never red — an unjudged
                  // figure must not read as a breach.
                  const valueColor =
                    row.meets_target === null
                      ? palette.inkMuted
                      : row.meets_target
                        ? palette.healthy
                        : palette.critical;
                  return (
                    <tr key={row.item} className="hover:bg-white/[0.05]">
                      <td className="py-2">
                        {row.product_name ? (
                          <>
                            <div className="text-[12px] font-bold text-white leading-tight">
                              {row.product_name}
                            </div>
                            <div className="text-[10px] text-ink-dim font-mono leading-tight">
                              {row.item}
                            </div>
                          </>
                        ) : (
                          <div className="text-[12px] font-bold text-white font-mono leading-tight">
                            {row.item}
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-[12px] text-right text-ink-muted font-mono">
                        {fmtCount(row.done)}
                      </td>
                      <td className="py-2 text-[12px] text-right text-ink-muted font-mono">
                        {fmtCount(row.ok)}
                      </td>
                      <td className="py-2 text-[12px] text-right font-mono font-bold text-[#e0e7ef]">
                        {fmtCount(row.failed)}
                      </td>
                      <td
                        className="py-2 text-[12.5px] text-right font-mono font-black"
                        style={{ color: valueColor }}
                      >
                        {fmtPct(value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals are over EVERY product, not just this page. */}
        <div className="flex justify-between items-center px-6 py-3 border-t border-line-modal flex-shrink-0 gap-4">
          <div className="flex items-center gap-4 text-[11px] font-bold text-ink-muted min-w-0">
            <span>
              Total{" "}
              <span className="text-white font-mono">
                {fmtCount(data?.totals?.done)}
              </span>{" "}
              done ·{" "}
              <span className="text-white font-mono">
                {fmtCount(data?.totals?.failed)}
              </span>{" "}
              failed ·{" "}
              <span className="text-white font-mono">
                {fmtPct(
                  metric === "failure"
                    ? data?.totals?.failure_pct
                    : data?.totals?.yield_pct,
                )}
              </span>
            </span>
            {/* Only shown when there IS unattributed production. */}
            {data?.unattributed && (
              <span
                className="text-ink-dim truncate"
                title="Production the source did not attribute to a product. Counted in the total and in the card, but it has no item code to list."
              >
                + {fmtCount(data.unattributed.done)} unattributed
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-white flex-shrink-0">
            <span className="text-ink-muted font-bold">
              {first} - {last} of {totalProducts}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className={`p-1 transition-colors ${page === 1 ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={`p-1 transition-colors ${page === 1 ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
              >
                <ChevronLeft size={13} />
              </button>
              <button className="bg-line text-white font-bold w-4.5 h-4.5 rounded flex items-center justify-center text-[10px]">
                {page}
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className={`p-1 transition-colors ${page >= totalPages ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className={`p-1 transition-colors ${page >= totalPages ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessProductsModal;
