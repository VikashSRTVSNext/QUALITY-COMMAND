import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { palette } from "../../theme/palette";
import { defectCountTone } from "./metrics";
import {
  DEFAULT_DESC,
  fmtCount,
  fmtPct,
  type ProcessProductRow,
  type ProcessProductsQuery,
} from "./useProcessProducts";

interface ProcessProductsTableProps {
  /** Result of useProcessProducts — the caller owns the query so it can also
   *  read the step's own headline figure for its own header. */
  query: ProcessProductsQuery;
  /** Opens the next level down (the NC log) for a product. Optional: when it is
   *  absent the rows are inert, which is what a step with no rework mapping
   *  needs — offering a click that cannot resolve is worse than none. */
  onRowClick?: (row: { item: string; product_name: string | null }) => void;
  /** Per-ROW gate, on top of `onRowClick`. SPI needs it: a product at 100% has
   *  no failed boards, so its level two answers 404 — those rows must not look
   *  clickable. Omit to let every row open when `onRowClick` is supplied. */
  isRowClickable?: (row: ProcessProductRow) => boolean;
  /** Verb for the row tooltip. Steps open different things — an NC log, a pad
   *  log — and the tooltip should say which. */
  rowActionLabel?: string;
}

// Per-product breakdown for one process step: operations line, the table, and
// totals with server-side pagination.
//
// Presentational only. Rendered inline in the Product Yield panel when a step
// tab is selected. When `onRowClick` is supplied a row opens that step's level
// two -- the NC log for the MES steps, the pad log for SPI -- which is the level
// this table cannot show. The caller owns which modal that is.
export const ProcessProductsTable = ({
  query,
  onRowClick,
  isRowClickable,
  rowActionLabel = "Show the NC log",
}: ProcessProductsTableProps) => {
  const {
    data,
    state,
    page,
    setPage,
    metric,
    valueSort,
    applySort,
    activeSort,
    activeOrder,
    totalPages,
    totalProducts,
    first,
    last,
  } = query;

  // Sticky header. Two things it depends on, both easy to undo by accident:
  //   - bg-panel stays OPAQUE, so rows are hidden as they pass under it
  //   - the scroll container has NO padding-top. Padding above the stick point
  //     leaves a strip that rows scroll into and remain visible in, which reads
  //     as the header clipping them mid-row.
  // Lifted verbatim from the UNITS table so the two are the same object to the
  // eye: same weight, same sticky treatment, same rule under it.
  const th =
    "pb-2 font-black sticky top-0 bg-panel border-b border-line z-10 select-none";
  const sortable = "cursor-pointer hover:text-white transition-colors";
  // Same three glyphs SortableTh draws, for the same three states: the two
  // halves of this panel must not indicate a sort differently. `activeOrder` is
  // null while the server's default ordering is in force, which still counts as
  // sorted -- that is the direction the key opens on.
  const caret = (key: string) => {
    if (activeSort !== key) return " ↕";
    const desc =
      activeOrder === null ? DEFAULT_DESC.has(key) : activeOrder === "desc";
    return desc ? " ▼" : " ▲";
  };

  // UNITS colours its FPY % and draws a small trend mark beside it. Same idea
  // here, off `meets_target` -- which the rows already carry, so this is a
  // restyle rather than a new figure. Null means no target was agreed for the
  // step: neutral and flat, never red, because an unjudged number must not read
  // as a breach.
  const toneFor = (meets: boolean | null) =>
    meets === null
      ? palette.inkMuted
      : meets
        ? palette.healthy
        : palette.critical;
  const sparkFor = (meets: boolean | null) =>
    meets === null
      ? "0,6 5,6 10,6 15,6 20,6"
      : meets
        ? "0,10 5,5 10,8 15,2 20,4"
        : "0,2 5,8 10,4 15,10 20,6";

  // SMT_DEFECTS sends defect_records beside `failed`; no other step does, so the
  // column appears only where it means something rather than being a prop every
  // caller has to pass. Failed counts BOARDS and this counts RECORDS -- the
  // header says so, because confusing the two is the one way this table lies.
  const hasRecords = (data?.rows ?? []).some((r) => r.defect_records != null);

  return (
    <>
      {/* No operations strip and no product count above the table: the UNITS
          table has neither, and this one is meant to read as the same table with
          a different step behind it. Both facts are still available -- the
          operations on the card, the product count in the footer's "of N". */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-6 pb-3">
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
          <table className="w-full min-w-[720px] text-left text-[12px] border-collapse relative">
            <thead>
              <tr className="text-ink-dim font-bold text-[10px] uppercase">
                <th className={`${th} pl-2`}>S.No</th>
                <th
                  className={`${th} ${sortable}`}
                  onClick={() => applySort("product")}
                >
                  Product name{caret("product")}
                </th>
                <th
                  className={`${th} ${sortable} text-center`}
                  onClick={() => applySort("done")}
                >
                  Done{caret("done")}
                </th>
                <th
                  className={`${th} ${sortable} text-center`}
                  onClick={() => applySort("ok")}
                >
                  OK{caret("ok")}
                </th>
                <th
                  className={`${th} ${sortable} text-center`}
                  onClick={() => applySort("failed")}
                >
                  Failed count{caret("failed")}
                </th>
                {hasRecords && (
                  <th
                    className={`${th} text-center`}
                    title="Defect records behind the failed boards. Several bad joints on one board is one failed board and several records."
                  >
                    Records
                  </th>
                )}
                <th
                  className={`${th} ${sortable} text-center`}
                  onClick={() => applySort("value")}
                >
                  {metric === "failure" ? "Failure %" : "Yield %"}
                  {caret(valueSort)}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/45 font-mono text-[11px]">
              {(data?.rows ?? []).map((row, idx) => {
                const value =
                  metric === "failure" ? row.failure_pct : row.yield_pct;
                // Null verdict means no target agreed for the step, or this
                // product produced nothing. Neutral, never red — an unjudged
                // figure must not read as a breach.
                const valueColor = toneFor(row.meets_target);
                // A row is only a control when there is something to open, so
                // the tabIndex, the role and the cursor all come and go with
                // this rather than advertising an interaction that does nothing.
                const clickable = Boolean(
                  onRowClick && (!isRowClickable || isRowClickable(row)),
                );
                const open = () =>
                  onRowClick?.({
                    item: row.item,
                    product_name: row.product_name,
                  });
                return (
                  <tr
                    key={row.item}
                    className={`hover:bg-panel/40 ${
                      clickable
                        ? "cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-info"
                        : ""
                    }`}
                    onClick={clickable ? open : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              open();
                            }
                          }
                        : undefined
                    }
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? "button" : undefined}
                    title={
                      clickable
                        ? `${rowActionLabel} for ${row.product_name ?? row.item}`
                        : undefined
                    }
                  >
                    <td className="py-[2.5px] text-ink-muted pl-2">
                      {first + idx}.
                    </td>
                    {/* The name alone, exactly as the UNITS table does it. The
                        item code only appears when there is no name to show --
                        a row has to be identifiable, but a second line under
                        every product made these rows half again as tall as the
                        UNITS ones and broke the match. The code is still in the
                        row's tooltip for anyone who needs to quote it. */}
                    <td
                      className="py-[2.5px] text-white font-sans font-bold"
                      title={row.product_name ? row.item : undefined}
                    >
                      {row.product_name ?? row.item}
                    </td>
                    <td className="py-[2.5px] text-center text-white">
                      {fmtCount(row.done)}
                    </td>
                    <td className="py-[2.5px] text-center text-white">
                      {fmtCount(row.ok)}
                    </td>
                    {/* Same rule as the UNITS table: one failure is red. */}
                    <td className="py-[2.5px] text-center font-bold">
                      <span style={{ color: defectCountTone(row.failed) }}>
                        {fmtCount(row.failed)}
                      </span>
                    </td>
                    {hasRecords && (
                      <td className="py-[2.5px] text-center text-ink-dim">
                        {fmtCount(row.defect_records)}
                      </td>
                    )}
                    <td className="py-[2.5px] text-center font-bold">
                      <span style={{ color: valueColor }}>{fmtPct(value)}</span>
                      <span className="ml-1 opacity-80 inline-block w-4 h-3 overflow-hidden align-middle mb-0.5">
                        <svg viewBox="0 0 20 10" className="w-full h-full">
                          <polyline
                            fill="none"
                            stroke={valueColor}
                            strokeWidth="1.5"
                            points={sparkFor(row.meets_target)}
                          />
                        </svg>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination only, like the UNITS footer. The totals line that used to
          sit on the left is gone: it is the same figure the process card above
          already carries, and the UNITS table does not repeat it either.

          No progress bar either. Paging and sorting are SERVER-side, so a
          refetch happens with the previous page still on screen and goes
          unmarked -- that is accepted: the centred "Loading…" on first load is
          the only loading state this table shows, which is one more than the
          UNITS table has. */}
      <div className="flex justify-end items-center gap-3 mt-1.5 pt-2 px-6 text-[11px] text-white border-t border-line flex-shrink-0">
        <div className="flex items-center gap-3">
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
    </>
  );
};

export default ProcessProductsTable;
