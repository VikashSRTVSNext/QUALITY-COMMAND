import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { palette } from "../../theme/palette";
import {
  fmtCount,
  fmtPct,
  type ProcessProductsQuery,
} from "./useProcessProducts";

interface ProcessProductsTableProps {
  /** Result of useProcessProducts — the caller owns the query so it can also
   *  read the step's own headline figure for its own header. */
  query: ProcessProductsQuery;
}

// Per-product breakdown for one process step: operations line, the table, and
// totals with server-side pagination.
//
// Presentational only. Rendered inside ProcessProductsModal when a tile is
// clicked, and inline in the Product Yield panel when a step tab is selected.
export const ProcessProductsTable = ({ query }: ProcessProductsTableProps) => {
  const {
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
  } = query;

  // Sticky header. Two things it depends on, both easy to undo by accident:
  //   - bg-panel stays OPAQUE, so rows are hidden as they pass under it
  //   - the scroll container has NO padding-top. Padding above the stick point
  //     leaves a strip that rows scroll into and remain visible in, which reads
  //     as the header clipping them mid-row.
  const th =
    "pb-2 pt-1 font-black sticky top-0 bg-panel border-b border-line-modal z-10 select-none";
  const sortable = "cursor-pointer hover:text-white transition-colors";
  const caret = (key: string) => (activeSort === key ? " ▾" : "");

  return (
    <>
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
          <table className="w-full text-left border-collapse relative">
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
    </>
  );
};

export default ProcessProductsTable;
