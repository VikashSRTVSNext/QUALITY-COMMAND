import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { isNum } from "../../core/format";
import DrilldownModalShell from "./DrilldownModalShell";
import DateRangeFilter from "./DateRangeFilter";
import {
  EMPTY_RANGE,
  rangeDayCount,
  type DateRange,
} from "./dashboardFilters";
import ChartViewToggle, {
  paretoAvailable,
  type ChartView,
} from "./ChartViewToggle";
import FailedStepChart from "./FailedStepChart";
import NcLogTable from "./NcLogTable";
import TesterYieldTable from "./TesterYieldTable";
import UnitImageViewer from "./UnitImageViewer";
import { useProductDefects } from "./useProductDefects";
import { useProductTesters } from "./useProductTesters";
import { useProductImages } from "./useUnitImages";

type Props = {
  /** Mart step name, e.g. "RTWP" — the endpoint's path segment. */
  step: string;
  /** Item code whose failures this explains. */
  item: string;
  /** Short name from the Target sheet, for the header. Falls back to the code. */
  productName?: string | null;
  /** Production day the parent table is showing, so every level agrees on the
   *  window. */
  businessDate?: string | null;
  /** The dashboard's date range at the moment the modal was opened. Seeds
   *  the picker below; the modal then owns its own copy. */
  range?: DateRange | null;
  onClose: () => void;
};

/** Where in the drill-down we are. A tester selection is what distinguishes the
 *  two: null = the tester list, set = that tester's NC log. */
type Selection = { resource: string | null; category: string | null } | null;

/** How level 2 is drawn. The table is the plant's own report and stays the
 *  default; the chart answers "what fails most, and is it one machine", which a
 *  table can hold but cannot show. */
type Level2View = "table" | "chart";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";

/**
 * The process drill-down below a product, in two levels.
 *
 *   level 2  which TESTERS make up this product's yield, and what caused the
 *            failures on each  (TesterYieldTable)
 *   level 3  which UNITS are behind one tester, or one cause  (NcLogTable)
 *
 * Level 1 — which products make up a card's yield — is the step tab that opened
 * this, and stays visible behind the backdrop.
 *
 * One modal rather than two because the levels are one question asked at
 * narrowing scope, and a breadcrumb makes the scope explicit; two modals would
 * either stack or lose the trail back. The tables themselves are separate
 * components so neither has to know about the other.
 *
 * Formerly ProcessProductsModal, which showed the level-one product table. That
 * table moved into the step tabs, so this shell was reused rather than left dead.
 */
export const ProductDrilldownModal: React.FC<Props> = ({
  step,
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
   * drill-down does NOT move the table underneath it. Opening a row, widening to
   * a fortnight to see whether a fault repeats, then closing, leaves the screen
   * behind exactly as it was — which is what a modal should do.
   */
  const [modalRange, setModalRange] = useState<DateRange>(range ?? EMPTY_RANGE);
  const [selection, setSelection] = useState<Selection>(null);
  const [view, setView] = useState<Level2View>("table");
  /** Bars or Pareto inside the chart view. */
  const [chartView, setChartView] = useState<ChartView>("bars");
  // The plant's two NC-log filters. Off by default: their screen hides later
  // attempts and unverified records, which makes its log shorter than the floor
  // actually is. Held here rather than in the table so they survive stepping back
  // to the tester list and drilling into a different cell.
  const [firstAttemptOnly, setFirstAttemptOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  // Which unit's inspection images are open, if any.
  const [imagesFor, setImagesFor] = useState<string | null>(null);

  const canPareto = paretoAvailable(modalRange);
  const rangeDays = rangeDayCount(modalRange);
  // Derived, not stored: narrowing back to one day must not leave the chart on
  // a view its own toggle no longer offers.
  const activeChartView: ChartView = canPareto ? chartView : "bars";

  const testers = useProductTesters(step, item, businessDate, modalRange);
  // The NC log loads once a tester or cause is chosen -- or once the chart view
  // is opened, which needs the same rows unfiltered to break them down. `null`
  // item keeps the hook idle, so opening the modal on the table still costs one
  // request rather than two.
  const needsLog = Boolean(selection) || view === "chart";
  const defects = useProductDefects(
    needsLog ? step : null,
    needsLog ? item : null,
    businessDate,
    selection?.resource ?? null,
    selection?.category ?? null,
    firstAttemptOnly ? 1 : null,
    verifiedOnly,
    modalRange,
  );

  // Inspection images for the whole product and day, in ONE request, loaded
  // alongside the NC log so a badge is ready the moment rows render rather than
  // popping in afterwards. Idles on steps whose cells have no camera, and the
  // hook answers "off" rather than erroring when the image store is
  // unconfigured or the gateway is unreachable -- so on a laptop outside the
  // plant network this simply contributes nothing.
  const unitImages = useProductImages(
    needsLog ? step : null,
    needsLog ? item : null,
    businessDate,
    // AXI names its product folders after the PRODUCT ("AHEGG.Z"), not the item
    // code, so the folder resolver needs the Target-sheet name. The AVI steps
    // key on the item and ignore this.
    productName,
  );

  const totals = testers.data?.totals;

  return (
    <>
    <DrilldownModalShell
      onClose={onClose}
      // Either level can be in flight: the tester table on open, the NC log on
      // a drill, and the chart view refetches the log when the dimension changes.
      busy={
        testers.state === "loading" || (needsLog && defects.state === "loading")
      }
      // Escape steps back to the tester list first, and only closes from there.
      onBack={selection ? () => setSelection(null) : null}
      header={
        <>
          {/* The shell already wraps this slot in the flex row, so no container
              here -- one was left behind when this moved onto the shell and left
              the fragment unbalanced. */}
          {/* The product crumb is a button only when there is somewhere to go
                back to, so it never looks interactive while it is the current
                level. */}
          {selection ? (
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="text-[16px] font-black text-ink-muted hover:text-white uppercase tracking-wider truncate cursor-pointer focus-visible:outline focus-visible:outline-1"
              title="Back to the tester list"
            >
              {productName || item}
            </button>
          ) : (
            <span className="text-[16px] font-black text-white uppercase tracking-wider truncate">
              {productName || item}
            </span>
          )}

          <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
            {step}
          </span>

          {selection ? (
            <>
              <ChevronRight size={13} className="text-ink-dim flex-shrink-0" />
              <span className="text-[13px] font-bold text-white font-mono whitespace-nowrap">
                {selection.resource ?? "All testers"}
              </span>
              {selection.category && (
                <>
                  <ChevronRight
                    size={13}
                    className="text-ink-dim flex-shrink-0"
                  />
                  <span className="text-[12px] font-black text-info uppercase tracking-wider">
                    {selection.category}
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
              · By tester
            </span>
          )}

          {productName && !selection && (
            <span className="text-[11px] font-mono text-ink-dim truncate">
              {item}
            </span>
          )}

          {totals && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-ink-dim" />
              {totals.failed} of {totals.tested} failed ·{" "}
              {fmtPct(totals.ftpy_pct)}
            </span>
          )}
        </>
      }
      meta={
        <>
          {/* Level 2 only. At level 3 the NC log IS the detail, so a view
              switch there would offer a chart of a single selection. */}
          {!selection && (
            <div className="flex items-center gap-1">
              {(["table", "chart"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`border text-[10px] font-bold px-2.5 py-1 rounded uppercase transition-colors cursor-pointer ${
                    view === v
                      ? "bg-tab-active text-white border-tab-border/50"
                      : "bg-page text-ink-dim border-line hover:bg-line"
                  }`}
                  title={
                    v === "table"
                      ? "The plant's tester yield report, cell for cell"
                      : "Failures by NC code, stacked by tester"
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {/* Only in the chart view: the table below has no bars to re-draw,
              and a control that did nothing where it sat would be worse than
              one that appears when it applies. */}
          {view === "chart" && canPareto && (
            <ChartViewToggle
              value={activeChartView}
              onChange={setChartView}
              days={rangeDays}
            />
          )}
          {/* The same control the dashboard header uses, so the range reads
              and behaves identically in both places. With no range set it shows
              the day the data is for, which is what the static label used to
              say. */}
          <DateRangeFilter
            value={modalRange}
            onChange={setModalRange}
            appliedLabel={
              modalRange.from || modalRange.to
                ? null
                : (testers.data?.business_date ?? businessDate ?? null)
            }
          />
          {selection && (
            <button
              onClick={() => setSelection(null)}
              className="bg-raised hover:bg-line text-ink-muted hover:text-white border border-line-strong rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              ← Testers
            </button>
          )}
        </>
      }
    >
      {/* ---- level 2: testers ------------------------------------------ */}
      {!selection && (
        <>
          {testers.state === "loading" && (
            <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
              Loading tester breakdown…
            </div>
          )}
          {testers.state === "unsupported" && (
            <div className="py-16 px-8 text-center">
              <div className="text-[12px] font-bold text-warning mb-1.5">
                No tester breakdown available for {step}
              </div>
              <div className="text-[11px] text-ink-dim max-w-[60ch] mx-auto leading-relaxed">
                {testers.error}
              </div>
            </div>
          )}
          {testers.state === "error" && (
            <div className="py-16 text-center text-[12px] font-bold text-critical">
              {testers.error}
            </div>
          )}
          {testers.state === "ready" &&
            testers.data &&
            (testers.data.testers.length === 0 ? (
              <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
                No production for this product on {testers.data.business_date}.
              </div>
            ) : (
              <>
                {/* Above BOTH views, not inside the table: it summarises the
                      level, and a supervisor switching views should not watch
                      the summary disappear and come back. */}
                {/* <CauseStrip
                    totals={testers.data.totals}
                    onDrill={(resource, category) =>
                      setSelection({ resource, category })
                    }
                  /> */}
                {view === "table" ? (
                  <TesterYieldTable
                    data={testers.data}
                    onDrill={(resource, category) =>
                      setSelection({ resource, category })
                    }
                  />
                ) : (
                  <FailedStepChart
                    view={activeChartView}
                    query={defects}
                    onDrill={(resource, category) =>
                      setSelection({ resource, category })
                    }
                  />
                )}
              </>
            ))}
        </>
      )}

      {/* ---- level 3: the NC log --------------------------------------- */}
      {selection && (
        <NcLogTable
          query={defects}
          firstAttemptOnly={firstAttemptOnly}
          onFirstAttemptOnly={setFirstAttemptOnly}
          verifiedOnly={verifiedOnly}
          onVerifiedOnly={setVerifiedOnly}
          imagesData={unitImages.data}
          onOpenImages={setImagesFor}
        />
      )}
    </DrilldownModalShell>

    {/* ---- the images for one unit ------------------------------------- */}
    {/* A SIBLING of the shell, not one of its children. The shell's panel is
        overflow-hidden with rounded corners, and its backdrop-blur makes that
        panel a containing block for fixed-position descendants -- so nested
        here the viewer would be clipped to the drill-down's box instead of
        covering the screen. Rendered above rather than instead of the
        drill-down, so closing it returns to the same log row. */}
    {imagesFor && unitImages.data?.by_sfc[imagesFor] && (
      <UnitImageViewer
        sfc={imagesFor}
        unit={unitImages.data.by_sfc[imagesFor]}
        store={unitImages.data.store}
        subject={productName || item}
        onClose={() => setImagesFor(null)}
      />
    )}
    </>
  );
};

export default ProductDrilldownModal;
