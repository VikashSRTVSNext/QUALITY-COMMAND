import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { isNum } from "../../core/format";
import DpmoiDetailModal from "./DpmoiDetailModal";
import SortableTh from "./SortableTh";
import { useTableSort } from "./tableSort";
import { useDpmoiProducts, type DpmoiRow } from "./useDpmoiProducts";
import type { DateRange } from "./dashboardFilters";

const fmtNum = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-US") : "—";
const fmtIdx = (v: number | null | undefined) =>
  isNum(v) ? v.toFixed(2) : "—";

const TH =
  "px-2 py-2 text-[9.5px] font-black uppercase tracking-wider text-ink-dim " +
  "whitespace-nowrap sticky top-0 bg-panel z-10 border-b border-line";
const TD = "px-2 py-1.5 whitespace-nowrap";

/** Against the card's target of 2.0. Lower is better — this is a defect index,
 *  the opposite of every yield column on the dashboard. */
const idxColour = (v: number | null) => {
  if (!isNum(v)) return undefined;
  if (v <= 2) return "#22c55e";
  if (v <= 10) return "#eab308";
  return "#ff4c4c";
};

/** AOI_TOP_REWORK_IN04 -> "AOI TOP". The _REWORK_IN04 suffix is on every row. */
const opLabel = (op: string | null) =>
  op ? op.replace(/_REWORK_IN04$/, "").replace(/_/g, " ") : "—";

/**
 * DPMOI per item and operation — the table behind the card.
 *
 * Mirrors the plant's Daily DPMOi screen: Item, Op, Des, Qty, largest quantity
 * first. `Qty` is boards (a lot can carry several), `Des` and the opportunity
 * counts come from the opportunity master.
 *
 * Reads mart_dpmo, which is ALREADY at (item, operation) grain — so unlike the
 * screw breakdown nothing is recomputed and this table cannot drift from the
 * card above it.
 */
export const DpmoiPane = ({
  businessDate,
  range,
  shift,
}: {
  businessDate?: string | null;
  range?: DateRange | null;
  shift?: string | null;
}) => {
  const { data, state, error } = useDpmoiProducts(businessDate, range, shift);

  /**
   * Column sorting. Every row is already here -- this pane is not paginated --
   * so it sorts client-side and the feed's own worst-first order is one more
   * click away.
   *
   * `operation` sorts by the LABEL the cell shows, not the raw
   * AOI_TOP_REWORK_IN04. A column that sorts by something the reader cannot see
   * looks broken.
   */
  const { sort, setSort, sorted: sortedRows } = useTableSort<
    DpmoiRow,
    "item" | "operation" | "description" | "qty" | "dpmo"
  >(data?.rows ?? [], (r, key) =>
    key === "operation" ? opLabel(r.operation) : r[key],
  );
  // The (item, operation) whose AOI defects are open. One at a time, which is
  // what a modal implies.
  const [openRow, setOpenRow] = useState<DpmoiRow | null>(null);

  if (state === "loading") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
        Loading DPMOI…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-critical">
        {error}
      </div>
    );
  }
  if (!data) return null;
  if (data.rows.length === 0) {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
        No AOI production on {data.business_date}.
      </div>
    );
  }

  const { totals } = data;

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <SortableTh
                column="item"
                label="Item"
                sort={sort}
                onSortChange={setSort}
                className={`${TH} text-left`}
              />
              <SortableTh
                column="operation"
                label="Op"
                sort={sort}
                onSortChange={setSort}
                className={`${TH} text-left`}
              />
              <SortableTh
                column="description"
                label="Description"
                sort={sort}
                onSortChange={setSort}
                className={`${TH} text-left`}
              />
              <SortableTh
                column="qty"
                label="Qty"
                sort={sort}
                onSortChange={setSort}
                align="right"
                className={`${TH} text-right`}
                title="Boards — a lot can carry several"
              />
              {/* Defects and Opportunities hidden on request. The data is
                  still in the payload (defects_total, opportunities), so
                  uncommenting these three blocks and putting the footer colSpan
                  back to 3 restores them with no backend change. */}
              {/*
              <th className={`${TH} text-right`}>Defects</th>
              <th className={`${TH} text-right`} title="Boards x opportunities per board">
                Opportunities
              </th>
              */}
              <SortableTh
                column="dpmo"
                label="DPMOI"
                sort={sort}
                onSortChange={setSort}
                align="right"
                className={`${TH} text-right`}
                title="Defects per million opportunities"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/45 font-mono">
            {sortedRows.map((r: DpmoiRow) => {
              // No opportunity row for this board: the rate is UNKNOWN, not zero.
              // Dimmed and dashed so it cannot be read as a clean result.
              const noDenominator = !r.opportunities;
              return (
                <tr
                  key={`${r.item}-${r.operation}`}
                  className={`cursor-pointer hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-info ${
                    noDenominator ? "opacity-70" : ""
                  }`}
                  onClick={() => setOpenRow(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenRow(r);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  title={`What the ${opLabel(r.operation)} defects on ${r.item} were, and which process they came from`}
                >
                  <td className={`${TD} text-left text-white font-bold`}>
                    <span className="inline-flex items-center gap-1.5">
                      {r.item ?? "—"}
                      <ChevronRight size={12} className="text-ink-dim" />
                    </span>
                  </td>
                  <td className={`${TD} text-left text-ink-secondary`}>
                    {opLabel(r.operation)}
                  </td>
                  <td className={`${TD} text-left text-ink-muted`}>
                    {r.description ?? "—"}
                  </td>
                  <td className={`${TD} text-right text-ink-muted tabular-nums`}>
                    {fmtNum(r.qty)}
                  </td>
                  {/* Defects and Opportunities hidden — pairs with the
                      commented headers above. */}
                  {/*
                  <td
                    className={`${TD} text-right tabular-nums font-bold ${
                      (r.defects_total ?? 0) > 0
                        ? "text-critical"
                        : "text-ink-dim"
                    }`}
                  >
                    {fmtNum(r.defects_total)}
                  </td>
                  <td className={`${TD} text-right text-ink-dim tabular-nums`}>
                    {fmtNum(r.opportunities)}
                  </td>
                  */}
                  {/* The "not in master" note moved here from the Opportunities
                      column: without it a blank index reads as a bug rather than
                      an item the opportunity master has no row for. */}
                  <td
                    className={`${TD} text-right tabular-nums font-black`}
                    style={{ color: idxColour(r.dpmo) }}
                  >
                    {noDenominator ? (
                      <span
                        className="text-warning text-[9.5px] font-bold"
                        title="This item has no row in the opportunity master, so no index can be computed. Usually a new revision the master has not caught up with."
                      >
                        not in master
                      </span>
                    ) : (
                      fmtIdx(r.dpmo)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong bg-page/60 font-mono">
              <td
                className={`${TD} text-left text-[10px] font-black uppercase tracking-wider text-ink-dim`}
                colSpan={3}
              >
                Total
              </td>
              <td className={`${TD} text-right text-white font-bold tabular-nums`}>
                {fmtNum(totals.qty)}
              </td>
              {/* Defects and Opportunities hidden — pairs with the blocks
                  above. */}
              {/*
              <td
                className={`${TD} text-right tabular-nums font-bold ${
                  (totals.defects_total ?? 0) > 0
                    ? "text-critical"
                    : "text-ink-dim"
                }`}
              >
                {fmtNum(totals.defects_total)}
              </td>
              <td className={`${TD} text-right text-ink-muted tabular-nums`}>
                {fmtNum(totals.opportunities)}
              </td>
              */}
              <td
                className={`${TD} text-right tabular-nums font-black`}
                style={{ color: idxColour(totals.dpmo) }}
              >
                {fmtIdx(totals.dpmo)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {openRow && (
        <DpmoiDetailModal
          item={openRow.item ?? ""}
          operation={openRow.operation ?? ""}
          description={openRow.description}
          businessDate={data.business_date}
          // Seeds the modal's own picker, so the drill-down opens on the window
          // the table was read from rather than snapping back to today.
          range={range}
          onClose={() => setOpenRow(null)}
        />
      )}
    </div>
  );
};

export default DpmoiPane;
