import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { apiUrl } from "../../core/api/config";

// Per-product drill-down behind a Process Performance card.
//
// Opened by clicking a tile in the SMT/RFM strip. Answers the question the card
// itself cannot: the card shows one yield for the whole step, this shows which
// PRODUCTS make it up, worst first — so a step under target names the items
// dragging it down instead of just reporting that it is under target.
//
// Reads GET /process/{step}/products, which queries the production log directly
// (no mart) using the same window, dedup and numerator/denominator as the card.
// The step's own figures come back in `card`, and are shown in the header so the
// modal always states the number it was opened from rather than re-deriving it.
//
// PAGINATION IS SERVER-SIDE, unlike the product-yield table below the strip,
// which holds every row and slices client-side. A step can carry a long tail of
// low-volume items, and only one page of them is ever on screen.

// The steps a tile can drill into. The endpoint serves every card built from the
// production log, but only the ones listed here are wired up as clickable —
// adding a step is one entry, and it is deliberately explicit so no tile becomes
// clickable by accident.
//
// Keys are mart step names (`process_step`), which is what the endpoint's path
// takes. SPI, DPMOI and SMT_DEFECTS can never appear here: they are not built
// from the production log and have no per-product breakdown at this grain.
export const DRILLDOWN_STEPS: Record<string, true> = {
  RTWP: true,
};

export type ProcessProductRow = {
  item: string;
  /** Target sheet's short PRODUCT NAME ('AKNB'). Null when the sheet has no row
   *  for this item code — a gap in the sheet, so the item code stands alone. */
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

// Sortable columns, mapped to the `sort` values the endpoint accepts. Anything
// not listed here is not sortable, because the server decides the ordering and
// an unsupported key is a 400 rather than a silently unsorted table.
const SORTABLE: Record<string, string> = {
  // The Product column leads with the sheet's product name, so its header sorts
  // by that name (item code as tiebreaker server-side) rather than by item code.
  product: "product",
  failed: "failed",
  value: "value", // resolved per metric below — yield for yield cards, failure for defect cards
};

type Props = {
  /** Mart step name, e.g. "RTWP". */
  step: string;
  /** Tile label, so the header matches the card that was clicked. */
  title: string;
  /** "A" | "B" | "C", or null for the whole production day. */
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
  // null means "let the server pick" — worst-first for whichever metric the card
  // reports, which is the ordering that makes the modal useful on open.
  const [sort, setSort] = useState<string | null>(null);

  // Escape closes, same as the Attention Center modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // Not an AbortController on unmount only — the guard also covers the shift
    // or page changing mid-flight, where a slow first response would otherwise
    // land after a faster second one and show the wrong page.
    let cancelled = false;

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

  // Shift is a dashboard-wide control and can change while this is open. Page 1
  // is the only safe landing spot: page 4 of the full day may not exist for
  // shift C, and the server would return an empty table for a step that has
  // plenty of products.
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

  // The card's figure for the window on screen. With a shift selected the
  // endpoint already narrowed `card` to it, so this is a sum of one row.
  const cardDone = (data?.card ?? []).reduce((a, r) => a + (r.done ?? 0), 0);
  const cardOk = (data?.card ?? []).reduce((a, r) => a + (r.ok ?? 0), 0);
  const cardValue =
    cardDone > 0
      ? metric === "failure"
        ? (100 * ((data?.card ?? []).reduce((a, r) => a + (r.failed ?? 0), 0))) /
          cardDone
        : (100 * cardOk) / cardDone
      : null;

  // Opaque, because a sticky header has to OCCLUDE the rows scrolling under it —
  // a translucent one lets them ghost through as they pass.
  const th =
    "pb-2 pt-1 font-black sticky top-0 bg-[#101c2b] border-b border-[#2b4463] z-10 select-none";
  const sortable = "cursor-pointer hover:text-white transition-colors";
  const caret = (key: string) => (activeSort === key ? " ▾" : "");

  // Frosted-glass backdrop: the blur sits on the FULL-SCREEN layer, so the whole
  // dashboard behind goes soft while staying visible as context. The tint is kept
  // light (unlike the Attention Center modal's bg-black/85) because the point is
  // glass, not a blackout — at heavy opacity the blur is invisible underneath it
  // and the effect reads as a plain dim.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-[#030810]/30 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* The panel stays near-opaque on top of the frosted layer. Blurring it too
          would stack a second blur over an already-soft background and cost the
          table its legibility — the glass is the backdrop's job, and the panel's
          job is to be readable against it. */}
      <div
        className="relative w-full max-w-[1100px] max-h-[85vh] bg-[#101c2b]/95 border border-[#3a5a7d] rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — the card that was clicked, and its own figure */}
        {/* Bands use a white wash rather than a fill of the panel colour: an
            opaque #101c2b strip on a translucent panel reads as a separate solid
            card sitting on top of the glass. */}
        <div className="flex justify-between items-center bg-white/[0.04] px-6 py-4 border-b border-[#2b4463] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[16px] font-black text-white uppercase tracking-wider">
              {title}
            </span>
            <span className="text-[11px] font-bold text-[#63788f] uppercase tracking-wider">
              By Product
            </span>
            {isNum(cardValue) && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#8fa0b5]">
                <span className="w-1 h-1 rounded-full bg-[#63788f]" />
                Card {fmtPct(cardValue)}
                {isNum(data?.target) && (
                  <span className="text-[#63788f]">
                    {" "}
                    / Tgt {data!.target}
                    {data!.target_unit === "percent" ? "%" : ""}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-[#63788f]">
              {data?.business_date ?? ""}
              {shift ? ` · Shift ${shift}` : " · Full Day"}
            </span>
            <button
              onClick={onClose}
              className="bg-[#16253a] hover:bg-[#ff4c4c] text-[#8fa0b5] hover:text-white border border-[#26405a] rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Sub-header: what "this step" means, so it is visible that the
            breakdown covers the test operation and not its rework counterpart. */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-[#2b4463]/50 flex-shrink-0">
          <span className="text-[10px] font-bold text-[#63788f] uppercase tracking-wider">
            {data?.operations?.like
              ? `Operations like ${data.operations.like}`
              : (data?.operations?.in ?? []).join(", ")}
            <span className="text-[#4a5c72]"> · first attempts only</span>
          </span>
          <span className="text-[11px] font-bold text-[#63788f]">
            {totalProducts} {totalProducts === 1 ? "product" : "products"}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-6 py-3">
          {state === "loading" && !data ? (
            <div className="flex items-center justify-center py-16 text-[12px] font-bold text-[#63788f]">
              Loading…
            </div>
          ) : state === "error" ? (
            <div className="flex items-center justify-center py-16 text-[12px] font-bold text-[#ff4c4c]">
              Could not load the product breakdown
            </div>
          ) : (data?.rows ?? []).length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[12px] font-bold text-[#63788f]">
              No production for this step in the selected window
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] text-[#63788f] uppercase tracking-wider">
                <tr>
                  <th
                    className={`${th} ${sortable}`}
                    onClick={() => applySort("product")}
                  >
                    Product{caret("product")}
                  </th>
                  {/* Boards column hidden on request. The endpoint still returns
                      `boards` (distinct SFCs) and it stays in the row type, so
                      restoring it is uncommenting this and its cell below —
                      nothing to re-derive.
                  <th
                    className={`${th} ${sortable} text-right`}
                    onClick={() => applySort("boards")}
                  >
                    Boards{caret("boards")}
                  </th>
                  */}
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
                  // Null verdict = no target agreed for the step, or nothing
                  // produced for this product. Neutral, never red: an unjudged
                  // figure must not read as a breach.
                  const valueColor =
                    row.meets_target === null
                      ? "#8fa0b5"
                      : row.meets_target
                        ? "#22c55e"
                        : "#ff4c4c";
                  return (
                    <tr key={row.item} className="hover:bg-white/[0.05]">
                      {/* Product name leads, item code beneath it. The code is
                          kept rather than replaced: it is what the MES, the
                          defect records and the operators all quote, so dropping
                          it would make a row impossible to trace back. When the
                          Target sheet has no row for the code, the code becomes
                          the heading instead of leaving a blank line above it. */}
                      <td className="py-2">
                        {row.product_name ? (
                          <>
                            <div className="text-[12px] font-bold text-white leading-tight">
                              {row.product_name}
                            </div>
                            <div className="text-[10px] text-[#63788f] font-mono leading-tight">
                              {row.item}
                            </div>
                          </>
                        ) : (
                          <div className="text-[12px] font-bold text-white font-mono leading-tight">
                            {row.item}
                          </div>
                        )}
                      </td>
                      {/* Boards cell — hidden with its header above.
                      <td className="py-2 text-[12px] text-right text-[#8fa0b5] font-mono">
                        {fmtCount(row.boards)}
                      </td>
                      */}
                      <td className="py-2 text-[12px] text-right text-[#8fa0b5] font-mono">
                        {fmtCount(row.done)}
                      </td>
                      <td className="py-2 text-[12px] text-right text-[#8fa0b5] font-mono">
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

        {/* Footer: totals over EVERY product (not this page), then pagination */}
        <div className="flex justify-between items-center px-6 py-3 border-t border-[#2b4463] flex-shrink-0 gap-4">
          <div className="flex items-center gap-4 text-[11px] font-bold text-[#8fa0b5] min-w-0">
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
            {/* Only rendered when there IS unattributed production. It sits in
                the totals but not in the rows, so without this line the table
                would visibly fail to sum to the footer with no explanation. */}
            {data?.unattributed && (
              <span
                className="text-[#63788f] truncate"
                title="Production the source did not attribute to a product. Counted in the total and in the card, but it has no item code to list."
              >
                + {fmtCount(data.unattributed.done)} unattributed
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-white flex-shrink-0">
            <span className="text-[#8fa0b5] font-bold">
              {first} - {last} of {totalProducts}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className={`p-1 transition-colors ${page === 1 ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={`p-1 transition-colors ${page === 1 ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
              >
                <ChevronLeft size={13} />
              </button>
              <button className="bg-[#1c3149] text-white font-bold w-4.5 h-4.5 rounded flex items-center justify-center text-[10px]">
                {page}
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className={`p-1 transition-colors ${page >= totalPages ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className={`p-1 transition-colors ${page >= totalPages ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
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
