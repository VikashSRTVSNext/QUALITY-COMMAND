import { useMemo, useState } from "react";
import { isNum } from "../../core/format";
import RankedBarChart from "../charts/RankedBarChart.lazy";
import type { RankedBar } from "../charts/RankedBarChart";
import { seriesColor } from "../charts/seriesPalette";
import DrilldownModalShell from "./DrilldownModalShell";
import DateRangeFilter from "./DateRangeFilter";
import { EMPTY_RANGE, type DateRange } from "./dashboardFilters";
import SpiPadLogTable from "./SpiPadLogTable";
import { EMPTY_SPI_FILTERS, useSpiDefects, type SpiFilters } from "./useSpiDefects";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";

const fmtTime = (iso: string | null | undefined) =>
  iso ? iso.slice(11, 19) : "—";

const CHIP =
  "border text-[9.5px] font-bold px-2 py-0.5 rounded uppercase transition-colors cursor-pointer whitespace-nowrap";
const CHIP_ON = "bg-tab-active text-white border-tab-border/50";
const CHIP_OFF = "bg-page text-ink-dim border-line hover:bg-line";

type Props = {
  item: string;
  /** From the level-one row. Null is normal — the Target sheet has no entry for
   *  every item code — so the header falls back to the code. */
  productName?: string | null;
  /** The day the products table is showing, so both levels describe one window. */
  businessDate?: string | null;
  /** The dashboard's date range when the modal was opened. Seeds the picker
   *  below; the modal then owns its own copy. */
  range?: DateRange | null;
  onClose: () => void;
};

/**
 * Pad defects behind one product's failed paste inspections — level two of SPI.
 *
 * Its own modal rather than ProductDrilldownModal, because SPI's level two is a
 * genuinely different shape: pads and machine measurements where the MES steps
 * have non-conformance records and dispositions. The two share the shell, not
 * the contents.
 *
 * Three things the payload does not make obvious, and which the layout exists to
 * enforce:
 *
 *   - PADS AND BOARDS ARE DIFFERENT UNITS. One board routinely carries eleven
 *     pads of one fault; that is one failed board. Every count here says which
 *     of the two it is, and the pads column is never totalled against a yield
 *     built on boards.
 *   - THE SUMMARY NEVER MOVES. defects / components / testers / sides are always
 *     the product's full figures. Only the pad log and `selection` answer to the
 *     filters, so the numbers a slice is measured against stay put while the
 *     slice changes.
 *   - COMPONENTS DESERVE EQUAL WEIGHT. A repeat offender there points at a
 *     stencil aperture rather than a bad print, which is usually the more
 *     actionable read, so it sits beside the defect chart rather than under it.
 */
export const SpiDefectsModal: React.FC<Props> = ({
  item,
  productName,
  businessDate,
  range = null,
  onClose,
}) => {
  /**
   * The window this modal is looking at.
   *
   * Seeded from the dashboard but owned here, so narrowing the range inside the
   * drill-down does NOT move the table underneath it. Same rule as every other
   * drill-down, so they all read the same way.
   */
  const [modalRange, setModalRange] = useState<DateRange>(range ?? EMPTY_RANGE);

  const [filters, setFilters] = useState<SpiFilters>(EMPTY_SPI_FILTERS);
  /** Which board's pads to show. Client-side — every board's pads are already in
   *  the one response, so narrowing to an SFC costs no request. */
  const [sfc, setSfc] = useState<string | null>(null);

  const { data, state, error } = useSpiDefects(item, businessDate, filters, modalRange);

  const setFilter = (key: keyof SpiFilters, value: string | null) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  const anyFilter =
    Boolean(filters.resource || filters.category || filters.pcbSide) ||
    Boolean(sfc);

  // Colours are assigned by RANK, never by code: the defect vocabulary comes
  // from the inspection machine and is open-ended, so any code -> colour map
  // would silently render an unknown fault as "no colour".
  const defectBars: RankedBar[] = useMemo(
    () =>
      (data?.defects ?? []).map((d, i) => ({
        key: d.code,
        label: d.label,
        value: d.pads,
        color: seriesColor(i),
        hint:
          `${d.pads} pad(s) across ${d.boards} board(s)` +
          (isNum(d.pct_of_failed_boards)
            ? ` · on ${fmtPct(d.pct_of_failed_boards)} of failed boards`
            : ""),
      })),
    [data],
  );

  const componentBars: RankedBar[] = useMemo(
    () =>
      (data?.components ?? []).map((c, i) => ({
        key: c.component,
        label: c.component,
        value: c.pads,
        color: seriesColor(i),
        hint:
          `${c.pads} pad(s) across ${c.boards} board(s)` +
          (c.defects?.length ? ` · ${c.defects.join(", ")}` : ""),
      })),
    [data],
  );

  const parent = data?.parent;

  return (
    <DrilldownModalShell
      onClose={onClose}
      // Escape clears a board selection first, so a mistyped key does not throw
      // away the whole drill-down.
      onBack={sfc ? () => setSfc(null) : null}
      header={
        <>
          <span className="text-[16px] font-black text-white uppercase tracking-wider truncate">
            {/* product_name ?? item. A null name is a gap in the Target sheet,
                not an error, and the code alone is still a complete answer. */}
            {productName || item}
          </span>
          <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
            SPI · Pad defects
          </span>
          {productName && (
            <span className="text-[11px] font-mono text-ink-dim truncate">
              {item}
            </span>
          )}
          {parent && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-ink-dim" />
              {parent.failed} of {parent.boards} boards failed ·{" "}
              {fmtPct(parent.yield_pct)}
            </span>
          )}
        </>
      }
      meta={
        <>
          {anyFilter && (
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_SPI_FILTERS);
                setSfc(null);
              }}
              className="bg-raised hover:bg-line text-ink-muted hover:text-white border border-line-strong rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              Clear filters
            </button>
          )}
          {/* Was a static date label. The same control the dashboard header
              uses, so the range reads and behaves identically in both places —
              and with no range set it still shows the day the data is for,
              which is all the label ever said. */}
          <DateRangeFilter
            value={modalRange}
            onChange={setModalRange}
            appliedLabel={
              modalRange.from || modalRange.to
                ? null
                : (data?.business_date ?? businessDate ?? null)
            }
          />
        </>
      }
    >
      {state === "loading" && !data && (
        <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
          Loading pad defects…
        </div>
      )}

      {/* 404 rather than an error: the item had no boards that day, almost
          always a business_date that moved between the two calls. */}
      {state === "stale" && (
        <div className="py-16 px-8 text-center">
          <div className="text-[12px] font-bold text-warning mb-1.5">
            No inspected boards for this product
          </div>
          <div className="text-[11px] text-ink-dim max-w-[60ch] mx-auto leading-relaxed">
            {error} The products table may be showing a different production day
            — close this and re-open it from a refreshed table.
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="py-16 text-center text-[12px] font-bold text-critical">
          {error}
        </div>
      )}

      {data && (state === "ready" || state === "loading") && (
        <>
          {/* ---- summary: always the product's FULL figures ---------------- */}
          <div className="flex-shrink-0 px-6 pt-3 pb-3 border-b border-line/60 bg-page/25">
            <div className="flex flex-col xl:flex-row gap-5 xl:gap-7">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
                  Pads by defect
                  <span className="ml-2 font-bold normal-case tracking-normal text-ink-dim/70">
                    click to filter the log
                  </span>
                </div>
                <RankedBarChart
                  bars={defectBars}
                  labelWidth={150}
                  rowHeight={24}
                  emptyLabel="No defects recorded."
                  onBarClick={(code) => setFilter("category", code)}
                />
              </div>

              <div className="flex-1 min-w-0 xl:border-l xl:border-line/60 xl:pl-6">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
                  Pads by component
                  <span className="ml-2 font-bold normal-case tracking-normal text-ink-dim/70">
                    a repeat offender points at the stencil
                  </span>
                </div>
                <RankedBarChart
                  bars={componentBars}
                  labelWidth={92}
                  rowHeight={24}
                  emptyLabel="No components recorded."
                />
              </div>
            </div>

            {/* Machine and side are short lists, so chips beat a chart. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-line/60">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
                Machine
              </span>
              {data.testers.map((t) => (
                <button
                  key={t.tester_id}
                  type="button"
                  onClick={() => setFilter("resource", t.tester_id)}
                  className={`${CHIP} ${
                    filters.resource === t.tester_id ? CHIP_ON : CHIP_OFF
                  }`}
                  title={`${t.pads} pad(s) on ${t.tester_id}`}
                >
                  {t.tester_id}
                  <span className="ml-1.5 font-mono text-ink-dim">
                    {t.pads}p
                  </span>
                </button>
              ))}

              <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim ml-2">
                Side
              </span>
              {data.sides.map((s) => (
                <button
                  key={s.pcb_side}
                  type="button"
                  onClick={() => setFilter("pcbSide", s.pcb_side)}
                  className={`${CHIP} ${
                    filters.pcbSide === s.pcb_side ? CHIP_ON : CHIP_OFF
                  }`}
                  title={`${s.pads} pad(s) on side ${s.pcb_side}`}
                >
                  {s.pcb_side === "T" ? "Top" : s.pcb_side === "B" ? "Bottom" : s.pcb_side}
                  <span className="ml-1.5 font-mono text-ink-dim">
                    {s.pads}p
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ---- boards: the SFC level, filtered client-side --------------- */}
          <div className="flex-shrink-0 px-6 py-2.5 border-b border-line/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
                Failed boards
              </span>
              {data.boards.map((b) => (
                <button
                  key={b.sfc}
                  type="button"
                  onClick={() => setSfc(sfc === b.sfc ? null : b.sfc)}
                  className={`${CHIP} font-mono normal-case ${
                    sfc === b.sfc ? CHIP_ON : CHIP_OFF
                  }`}
                  title={
                    `${b.pads} pad(s) · ${b.tester_id ?? "—"} · ` +
                    `${fmtTime(b.board_time)} · lot ${b.process_lot ?? "—"}`
                  }
                >
                  {b.sfc}
                  <span className="ml-1.5 text-ink-dim">{b.pads}p</span>
                </button>
              ))}
              {data.boards.length === 0 && (
                <span className="text-[10px] font-bold text-ink-dim">
                  No NG boards listed.
                </span>
              )}
            </div>
          </div>

          {/* ---- the pad log ---------------------------------------------- */}
          <div className="flex-1 overflow-auto">
            <SpiPadLogTable
              rows={data.pad_log}
              sfc={sfc}
              filtered={Boolean(
                filters.resource || filters.category || filters.pcbSide,
              )}
            />
          </div>

          <div className="flex-shrink-0 px-6 py-2.5 border-t border-line-modal bg-page/40 text-[10px] text-ink-dim leading-relaxed">
            {/* Stated because the two words are not interchangeable and the whole
                screen leans on the difference. */}
            <span className="text-ink-muted">
              {data.selection.pads} pad(s) across {data.selection.boards}{" "}
              board(s) in this selection
            </span>
            , out of {parent?.failed ?? 0} failed board(s) for the product. Pads
            and boards are different units — one board can carry many pads of the
            same fault, and that is still one failed board.
            {data.released > 0 && (
              <>
                {" "}
                <span className="text-warning">
                  {data.released} pad(s) were released by an operator
                </span>
                , so they are listed above but are not in the defect counts.
              </>
            )}
            {data.unexplained.boards > 0 && (
              <>
                {" "}
                <span className="text-critical">
                  {data.unexplained.boards} failed board(s) have no pad rows at
                  all
                </span>
                {data.unexplained.sfcs.length > 0 && (
                  <span className="font-mono">
                    {" "}
                    ({data.unexplained.sfcs.join(", ")})
                  </span>
                )}
                {" "}— real failures the source cannot explain.
              </>
            )}
            {data.duplicate_source_rows > 0 && (
              <span className="text-ink-dim/70">
                {" "}
                {data.duplicate_source_rows} duplicate source row(s) were
                collapsed; normal on some machines.
              </span>
            )}
            {/* No unit suffix anywhere: volume, height and area read as a
                percentage of the programmed target and the offsets as
                millimetres, but the source documents neither. */}
            <span className="text-ink-dim/70">
              {" "}
              Volume, height and area are relative to the programmed target (100
              = nominal); units are unconfirmed, so none are shown.
            </span>
          </div>
        </>
      )}
    </DrilldownModalShell>
  );
};

export default SpiDefectsModal;
