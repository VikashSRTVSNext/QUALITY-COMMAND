import { useMemo, useState } from "react";
import { isNum } from "../../core/format";
import RankedBarChart from "../charts/RankedBarChart.lazy";
import type { RankedBar } from "../charts/RankedBarChart";
import { seriesColor } from "../charts/seriesPalette";
import DrilldownModalShell from "./DrilldownModalShell";
import SmtLogTable from "./SmtLogTable";
import {
  EMPTY_SMT_FILTERS,
  useSmtDefects,
  type SmtFilters,
} from "./useSmtDefects";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";

const CHIP =
  "border text-[9.5px] font-bold px-2 py-0.5 rounded uppercase transition-colors cursor-pointer whitespace-nowrap";
const CHIP_ON = "bg-tab-active text-white border-tab-border/50";
const CHIP_OFF = "bg-page text-ink-dim border-line hover:bg-line";

type Props = {
  item: string;
  productName?: string | null;
  businessDate?: string | null;
  onClose: () => void;
};

/**
 * SMT solder defects behind one product — level two of the SMT Defects card.
 *
 * The whole screen is built on one distinction: BOARDS versus RECORDS. Twenty
 * bad joints on one board is one board with a print problem, not twenty boards.
 * So every bar here is measured in BOARDS — the unit the card's rate is built on
 * — and the record count rides in the tooltip beside it. Sizing these bars by
 * records would make a single badly-printed board look like an outbreak.
 *
 * The four cuts answer different questions and deserve equal weight:
 *   NC code       what kind of fault
 *   Ref des       where on the board  -- one designator across many boards is a
 *                 stencil aperture, not many bad boards
 *   Component     which part
 *   Machine       where it was raised
 *
 * None of them move when the log below is filtered; only the log and the
 * selection counts do. That is deliberate — the figures a slice is measured
 * against must not shift with the slice.
 */
export const SmtDefectsModal: React.FC<Props> = ({
  item,
  productName,
  businessDate,
  onClose,
}) => {
  const [filters, setFilters] = useState<SmtFilters>(EMPTY_SMT_FILTERS);
  /** One board's records, filtered client-side — the whole log is already here. */
  const [sfc, setSfc] = useState<string | null>(null);

  const { data, state, error } = useSmtDefects(item, businessDate, filters);

  const setFilter = (key: "resource" | "nc", value: string | null) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  const serverFiltered = Boolean(filters.resource || filters.nc);
  const anyFilter = serverFiltered || Boolean(sfc) || filters.timesProcessed != null;

  // Colours by RANK, never by code: the NC vocabulary is plant master data and a
  // code -> colour map would render an unlisted fault as "no colour".
  const bars = (
    rows: { records: number; boards: number }[],
    label: (r: any) => string,
    key: (r: any) => string,
    hint?: (r: any) => string,
  ): RankedBar[] =>
    rows.map((r, i) => ({
      key: key(r),
      label: label(r),
      // BOARDS, not records. See the component note above.
      value: r.boards,
      color: seriesColor(i),
      hint: `${r.boards} board(s) · ${r.records} record(s)${hint ? ` · ${hint(r)}` : ""}`,
    }));

  const ncBars = useMemo(
    () =>
      bars(
        data?.by_nc ?? [],
        (r) => r.nc,
        (r) => r.nc,
        (r) => r.description ?? "no description in the master",
      ),
    [data],
  );
  const refDesBars = useMemo(
    () => bars(data?.by_ref_des ?? [], (r) => r.ref_des, (r) => r.ref_des),
    [data],
  );
  const componentBars = useMemo(
    () => bars(data?.by_component ?? [], (r) => r.component, (r) => r.component),
    [data],
  );

  const parent = data?.parent;

  return (
    <DrilldownModalShell
      onClose={onClose}
      // Covers a refilter as well as the first load: the breakdowns stay on
      // screen while a chip refetches, so this is the only sign it is working.
      busy={state === "loading"}
      onBack={sfc ? () => setSfc(null) : null}
      header={
        <>
          <span className="text-[16px] font-black text-white uppercase tracking-wider truncate">
            {productName || item}
          </span>
          <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
            SMT defects
          </span>
          {productName && (
            <span className="text-[11px] font-mono text-ink-dim truncate">
              {item}
            </span>
          )}
          {parent && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-ink-dim" />
              {parent.failed} of {parent.done} boards ·{" "}
              {fmtPct(parent.failure_pct)}
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
                setFilters(EMPTY_SMT_FILTERS);
                setSfc(null);
              }}
              className="bg-raised hover:bg-line text-ink-muted hover:text-white border border-line-strong rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              Clear filters
            </button>
          )}
          <span className="text-[11px] font-bold text-ink-dim">
            {data?.business_date ?? businessDate ?? ""}
          </span>
        </>
      }
    >
      {state === "loading" && !data && (
        <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
          Loading defect log…
        </div>
      )}
      {state === "error" && (
        <div className="py-16 text-center text-[12px] font-bold text-critical">
          {error}
        </div>
      )}

      {data && state !== "error" && (
        <>
          {/* ---- the four cuts. Always the product's FULL figures ---------- */}
          <div className="flex-shrink-0 px-6 pt-3 pb-3 border-b border-line/60 bg-page/25">
            <div className="flex flex-col xl:flex-row gap-5 xl:gap-7">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
                  Boards by NC code
                  <span className="ml-2 font-bold normal-case tracking-normal text-ink-dim/70">
                    click to filter the log
                  </span>
                </div>
                <RankedBarChart
                  bars={ncBars}
                  labelWidth={60}
                  rowHeight={24}
                  emptyLabel="No NC codes recorded."
                  onBarClick={(nc) => setFilter("nc", nc)}
                />
              </div>

              <div className="flex-1 min-w-0 xl:border-l xl:border-line/60 xl:pl-6">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
                  Boards by ref des
                  <span className="ml-2 font-bold normal-case tracking-normal text-ink-dim/70">
                    one designator across many boards = a stencil aperture
                  </span>
                </div>
                <RankedBarChart
                  bars={refDesBars}
                  labelWidth={78}
                  rowHeight={24}
                  emptyLabel="No designators recorded."
                />
              </div>

              <div className="flex-1 min-w-0 xl:border-l xl:border-line/60 xl:pl-6">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
                  Boards by component
                </div>
                <RankedBarChart
                  bars={componentBars}
                  labelWidth={86}
                  rowHeight={24}
                  emptyLabel="No components recorded."
                />
              </div>
            </div>

            {/* Machines are a short list, so chips beat a fourth chart. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 pt-3 border-t border-line/60">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
                Machine
              </span>
              {data.resources.map((r) => (
                <button
                  key={r.resource}
                  type="button"
                  onClick={() => setFilter("resource", r.resource)}
                  className={`${CHIP} normal-case ${
                    filters.resource === r.resource ? CHIP_ON : CHIP_OFF
                  }`}
                  title={`${r.boards} board(s) · ${r.records} record(s) raised at ${r.resource}`}
                >
                  {r.resource}
                  <span className="ml-1.5 font-mono text-ink-dim">
                    {r.boards}b
                  </span>
                </button>
              ))}
              {data.resources.length === 0 && (
                <span className="text-[10px] font-bold text-ink-dim">
                  No machine recorded on these records.
                </span>
              )}
            </div>
          </div>

          {/* ---- boards, filtered client-side ------------------------------ */}
          {(() => {
            // Distinct SFCs in the log. The response has no boards[] list, and
            // deriving it here keeps the board picker honest: it can only offer
            // boards that actually have records in the current selection.
            const sfcs = [...new Set(data.log.map((r) => r.sfc))];
            if (sfcs.length === 0) return null;
            return (
              <div className="flex-shrink-0 px-6 py-2.5 border-b border-line/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
                    Failed boards
                  </span>
                  {sfcs.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSfc(sfc === s ? null : s)}
                      className={`${CHIP} font-mono normal-case ${
                        sfc === s ? CHIP_ON : CHIP_OFF
                      }`}
                      title={`${data.log.filter((r) => r.sfc === s).length} record(s) on ${s}`}
                    >
                      {s}
                      <span className="ml-1.5 text-ink-dim">
                        {data.log.filter((r) => r.sfc === s).length}r
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ---- the log --------------------------------------------------- */}
          <div className="flex-1 overflow-auto">
            <SmtLogTable rows={data.log} sfc={sfc} filtered={serverFiltered} />
          </div>

          <div className="flex-shrink-0 px-6 py-2.5 border-t border-line-modal bg-page/40 text-[10px] text-ink-dim leading-relaxed">
            <span className="text-ink-muted">
              {data.records} record(s) across {data.boards} board(s) in this
              selection
            </span>
            , out of {parent?.defect_records ?? 0} record(s) on{" "}
            {parent?.failed ?? 0} failed board(s) for the product. Boards and
            records are different units — several bad joints on one board is one
            failed board, and the bars above count boards for that reason.
            {/* Codes are not exclusive, so the per-code board counts deliberately
                sum to more than the failed-board total. Said out loud, because
                the arithmetic looks wrong otherwise. */}
            {data.by_nc.length > 1 && (
              <>
                {" "}
                A board carrying two NC codes counts in both, so the per-code
                board counts sum to more than {parent?.failed ?? 0}.
              </>
            )}
            {(data.missing.ref_des > 0 ||
              data.missing.component > 0 ||
              data.missing.resource > 0) && (
              <>
                {" "}
                <span className="text-warning">
                  Records with no attribute:{" "}
                  {[
                    data.missing.ref_des > 0 &&
                      `${data.missing.ref_des} without a ref des`,
                    data.missing.component > 0 &&
                      `${data.missing.component} without a component`,
                    data.missing.resource > 0 &&
                      `${data.missing.resource} without a machine`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                , which is why those breakdowns sum to less than the record
                count.
              </>
            )}
            <span className="text-ink-dim/70">
              {" "}
              Comment is what the operator wrote at the rework station; Failure
              comments is the measurement that tripped the test — two records,
              joined on SFC, failure id and attempt.
            </span>
          </div>
        </>
      )}
    </DrilldownModalShell>
  );
};

export default SmtDefectsModal;
