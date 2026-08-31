import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { isNum } from "../../core/format";
import { palette } from "../../theme/palette";
import SortableTh, { SortState } from "./SortableTh";
import ProcessProductsTable from "./ProcessProductsTable";
import ProductDrilldownModal from "./ProductDrilldownModal";
import DpmoiPane from "./DpmoiPane";
import ScrewDefectsPane from "./ScrewDefectsPane";
import { useProcessProducts } from "./useProcessProducts";
import { DEFECT_DRILLDOWN_STEPS } from "./useProductDefects";
import { yieldRowTone } from "./metrics";

export type YieldTab = "UNITS" | "TRX" | "PA";

// Which process step explains a failure at each level.
//
// TRX and PA share one step on purpose: both are MODULE_TEST_IN04, split only by
// the item's sub_module. The drill-down is addressed per item, so the item decides
// which slice it came from and one step serves both.
const LEVEL_STEP: Record<YieldTab, string> = {
  UNITS: "UNIT_TEST",
  TRX: "MODULE_TEST",
  PA: "MODULE_TEST",
};

// The process steps that can be shown as a tab, in process order.
//
// `label` is what the tile calls it, `step` is the mart name the endpoint takes.
// Every entry must also be in DRILLDOWN_STEPS, which is what makes the matching
// tile clickable — the same steps reached two ways.
// Sentinel for the screw-defects tab. Not a mart process_step, so it is kept
// distinct from the names the per-product endpoint accepts.
export const SCREW_DEFECTS_TAB = "__SCREW_DEFECTS__";
// Same reasoning: DPMOI's denominator is OPPORTUNITIES (solder joints, components,
// placements), so /process/{step}/products cannot answer it either.
export const DPMOI_TAB = "__DPMOI__";

const STEP_TABS: { label: string; step: string }[] = [
  { label: "AXI-S", step: "AXI" },
  { label: "THERMAL AVI", step: "THERMAL_AVI" },
  { label: "BURN-IN-S", step: "BURN_IN" },
  { label: "LBTS-S", step: "LBTS" },
  { label: "RTWP", step: "RTWP" },
  { label: "IP", step: "IP" },
  { label: "OTA", step: "OTA_TEST" },
  { label: "AUTO OGI", step: "AUTO_OGI" },
  // NOT a PROCESS_STEPS entry, and it cannot be one: its denominator is SCREWS
  // DRIVEN rather than boards, so /process/{step}/products cannot answer it. The
  // sentinel routes to its own pane and endpoint.
  { label: "SCREW DEFECTS", step: SCREW_DEFECTS_TAB },
  { label: "DPMOI", step: DPMOI_TAB },
];

const TAB_CLASS =
  "border text-[11px] font-bold px-4 py-1 rounded uppercase transition-colors whitespace-nowrap flex-shrink-0";
const TAB_ON = "bg-tab-active text-white border-tab-border/50";
const TAB_OFF = "bg-page text-ink-dim border-line hover:bg-line";

// A step tab's table, plus the NC log it opens.
//
// Split out because useProcessProducts cannot be called conditionally, and the
// query should only run while its tab is selected.
//
// The selected product lives here rather than in the panel so switching tabs
// clears it: an NC log belongs to one step, and carrying a selection across a
// tab change would ask a different step about a product it may not have run.
const StepPane = ({ step, shift }: { step: string; shift: string | null }) => {
  const query = useProcessProducts(step, shift);
  const [selected, setSelected] = useState<{
    item: string;
    product_name: string | null;
  } | null>(null);

  // Only steps whose rework operation is mapped can explain a failure. The rest
  // keep inert rows instead of opening a modal that would report 501.
  const canDrill = Boolean(DEFECT_DRILLDOWN_STEPS[step]);

  return (
    <>
      <ProcessProductsTable
        query={query}
        onRowClick={canDrill ? setSelected : undefined}
      />
      {selected && (
        <ProductDrilldownModal
          step={step}
          item={selected.item}
          productName={selected.product_name}
          // The day the table itself is showing, so the log cannot describe a
          // different window from the row that opened it.
          businessDate={query.data?.business_date ?? null}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};
type SortKey = "name" | "tested" | "failed";

const ITEMS_PER_PAGE = 10;

interface ProductYieldPanelProps {
  /** Rows as the feed returned them. Their order is meaningful, so sorting is
   *  applied non-destructively on top. */
  rows: any[];
  /** UNITS / TRX / PA. Owned by the dashboard because it is a request
   *  parameter (?level=…), not just a client-side filter. */
  activeTab: YieldTab;
  onTabChange: (tab: YieldTab) => void;
  fetchState: "loading" | "ready" | "error";
  /** AI yield recommendations, keyed by product name. UNITS tab only. */
  recommendations: Record<string, any>;
  recsLoading: boolean;
  planStatus: { available: boolean; month?: string | null };
  /** "A" | "B" | "C", or null for the whole production day. Passed straight to
   *  the process-step endpoint, which takes the letter rather than the label. */
  shift: string | null;
}

// Product Yield panel: level tabs, a sortable and paginated table, and the AI
// recommendation column.
//
// Sorting and paging live here because they are view state. The tab does not —
// changing it refetches, so the dashboard owns it.
export const ProductYieldPanel = ({
  rows,
  activeTab,
  onTabChange,
  fetchState,
  recommendations,
  recsLoading,
  planStatus,
  shift,
}: ProductYieldPanelProps) => {
  // Product opened from a UNITS row. Lives here rather than in StepPane because
  // the UNITS tab is the panel's own table, not a step pane.
  //
  // The UNITS level IS the UNIT_TEST_IN04 first-pass report -- same products, same
  // figures as the plant's own screen -- so its rows drill into the UNIT_TEST step
  // instead of needing a tab of their own.
  const [levelSelection, setLevelSelection] = useState<{
    step: string;
    item: string;
    name: string | null;
  } | null>(null);

  const [sort, setSort] = useState<SortState<SortKey>>({
    key: null,
    order: "asc",
  });
  const [page, setPage] = useState(1);
  // null = a level tab (UNITS/TRX/PA) is showing. A step name = that step's
  // table is showing instead. Level lives in the dashboard because it is a
  // request parameter for a different endpoint; step is local to this panel.
  const [activeStep, setActiveStep] = useState<string | null>(null);

  // The tab strip scrolls horizontally: eleven tabs need ~870px and the middle
  // dashboard column only has that above ~1850px. The scrollbar is hidden
  // (.no-scrollbar) because it would eat height from a fixed 380px panel, so
  // these flags drive a fade on whichever edge still has tabs behind it. A fade
  // that showed when there was nothing to scroll to would read as a bug.
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = tabStripRef.current;
    if (!el) return;

    const measure = () => {
      // 1px of slack: fractional scroll positions never settle exactly on the
      // end, which would leave the right fade permanently visible.
      const maxScroll = el.scrollWidth - el.clientWidth;
      setTabOverflow({
        left: el.scrollLeft > 1,
        right: el.scrollLeft < maxScroll - 1,
      });
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Catches the panel being resized, not just the window — the column is a
    // grid fraction, so it changes width without a window resize event.
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  const sortedRows = React.useMemo(() => {
    if (!sort.key) return rows;
    return [...rows].sort((a, b) => {
      const key = sort.key!;
      const order = sort.order;

      if (key === "name") {
        const valA = (a.name || "").toString().toLowerCase();
        const valB = (b.name || "").toString().toLowerCase();
        return order === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        const parseNum = (val: any) => {
          if (val === null || val === undefined) return 0;
          const clean = val.toString().replace(/,/g, "");
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        };
        const valA = parseNum(a[key]);
        const valB = parseNum(b[key]);
        return order === "asc" ? valA - valB : valB - valA;
      }
    });
  }, [rows, sort]);

  const totalPages = Math.ceil(sortedRows.length / ITEMS_PER_PAGE) || 1;

  // The 5-minute poll can return fewer products than the page we are on, which
  // would otherwise leave an empty table with "next" already disabled and no way
  // forward. Clamping during render rather than in an effect means there is no
  // frame where the empty page is visible. Everything below reads safePage, so a
  // stale `page` cannot leak into the controls either.
  const safePage = Math.min(page, totalPages);

  const pageRows = sortedRows.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  // A new level returns a different row set, so the old page number is
  // meaningless and can land past the end.
  useEffect(() => {
    setPage(1);
    // A drill-down belongs to one level; carrying it across a tab change would
    // ask UNIT_TEST about a product from the TRX or PA list.
    setLevelSelection(null);
  }, [activeTab]);

  return (
      <section className="bg-panel border border-line rounded-xl p-4 flex flex-col h-[380px]">
        <span className="text-[12px] font-black tracking-widest text-ink-muted uppercase mb-1.5">
          PRODUCT YIELD
        </span>
        {/* One row, horizontally scrollable: three level tabs then one per
            process step. A step is its own view and level does not apply to it,
            because /process/{step}/products takes no level parameter. */}
        <div className="relative mb-1.5">
          <div
            ref={tabStripRef}
            className="flex gap-2 overflow-x-auto no-scrollbar"
          >
          {(["UNITS", "TRX", "PA"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveStep(null);
                onTabChange(tab);
              }}
              className={`${activeStep === null && activeTab === tab ? TAB_ON : TAB_OFF} ${TAB_CLASS}`}
            >
              {tab}
            </button>
          ))}
          {STEP_TABS.map(({ label, step }) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              className={`${activeStep === step ? TAB_ON : TAB_OFF} ${TAB_CLASS}`}
            >
              {label}
            </button>
            ))}
          </div>

          {/* Fades sit above the strip and ignore the pointer, so a tab under
              the gradient is still clickable. */}
          {tabOverflow.left && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-panel to-transparent"
            />
          )}
          {tabOverflow.right && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-panel to-transparent"
            />
          )}
        </div>

        {activeStep === DPMOI_TAB ? (
          <DpmoiPane businessDate={null} />
        ) : activeStep === SCREW_DEFECTS_TAB ? (
          // Its own pane: screws-driven denominator, and a line/station/item
          // grouping the per-product table has no column for.
          <ScrewDefectsPane businessDate={null} />
        ) : activeStep ? (
          <StepPane step={activeStep} shift={shift} />
        ) : (
          <>
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full min-w-[720px] text-left text-[12px] border-collapse relative">
            <thead>
              <tr className="text-ink-dim font-bold text-[10px] uppercase">
                <th className="pb-2 font-black pl-2 sticky top-0 bg-panel border-b border-line z-10">
                  S.No
                </th>
                <SortableTh
                  column="name"
                  label="PRODUCT NAME"
                  sort={sort}
                  onSortChange={setSort}
                />
                <SortableTh
                  column="tested"
                  label="TESTED"
                  sort={sort}
                  onSortChange={setSort}
                  align="center"
                />
                <SortableTh
                  column="failed"
                  label="FAILED COUNT"
                  sort={sort}
                  onSortChange={setSort}
                  align="center"
                />
                <th className="pb-2 font-black text-center sticky top-0 bg-panel border-b border-line z-10">
                  FPY %
                </th>
                <th className="pb-2 font-black text-center sticky top-0 bg-panel border-b border-line z-10">
                  TARGET YIELD %
                </th>
                <th className="pb-2 font-black text-center sticky top-0 bg-panel border-b border-line z-10">
                  FPY STATUS
                </th>
                {activeTab === "UNITS" && (
                  <th className="pb-2 font-black text-center sticky top-0 bg-panel border-b border-line z-10">
                    AI RECOMMENDATION HFTPY
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/45 font-mono text-[11px]">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={activeTab === "UNITS" ? 8 : 7}
                    className="py-10 text-center font-sans text-[12px] font-bold tracking-wide"
                  >
                    {fetchState === "loading" ? (
                      <span className="text-ink-dim">Loading…</span>
                    ) : fetchState === "error" ? (
                      <span className="text-warning">
                        Product yield unavailable — API unreachable
                      </span>
                    ) : (
                      <span className="text-ink-dim">No records found</span>
                    )}
                  </td>
                </tr>
              )}
              {pageRows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-panel/40">
                  <td className="py-[2.5px] text-ink-muted pl-2">
                    {(safePage - 1) * ITEMS_PER_PAGE + idx + 1}.
                  </td>
                  <td className="py-[2.5px] text-white font-sans font-bold">
                    {/* Only the UNITS level maps to a step whose failures can be
                        explained (UNIT_TEST). TRX and PA have no rework mapping,
                        so their names stay inert rather than opening a modal that
                        would report 501. Gated on the same list the step panes
                        use, so unmapping the step removes this click too. */}
                    {DEFECT_DRILLDOWN_STEPS[LEVEL_STEP[activeTab]] &&
                    row.item ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLevelSelection({
                            step: LEVEL_STEP[activeTab],
                            item: row.item,
                            name: row.name,
                          })
                        }
                        className="text-white font-bold hover:text-info focus-visible:outline focus-visible:outline-1 cursor-pointer text-left"
                        title={`Open the failure breakdown for ${row.name} (${row.item})`}
                      >
                        {row.name}
                      </button>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="py-[2.5px] text-center text-white">
                    {row.tested}
                  </td>
                  <td className="py-[2.5px] text-center text-white">
                    {row.failed}
                  </td>
                  <td className="py-[2.5px] text-center font-bold">
                    <span style={{ color: yieldRowTone(row.status) }}>
                      {row.fpy}%
                    </span>
                    <span className="ml-1 opacity-80 inline-block w-4 h-3 overflow-hidden align-middle mb-0.5">
                      <svg viewBox="0 0 20 10" className="w-full h-full">
                        <polyline
                          fill="none"
                          stroke={yieldRowTone(row.status)}
                          strokeWidth="1.5"
                          points={
                            row.status === "No Target"
                              ? "0,6 5,6 10,6 15,6 20,6"
                              : row.status === "Healthy"
                                ? "0,10 5,5 10,8 15,2 20,4"
                                : "0,2 5,8 10,4 15,10 20,6"
                          }
                        />
                      </svg>
                    </span>
                  </td>
                  <td className="py-[2.5px] text-center text-white">
                    {isNum(row.target) ? `${row.target}%` : "—"}
                  </td>
                  <td className="py-[2.5px] text-center">
                    <span
                      className="text-[9.5px] font-black px-1.5 py-0.5 rounded border border-line/50"
                      style={{
                        color: yieldRowTone(row.status),
                        backgroundColor: `${yieldRowTone(row.status)}1a`,
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                  {activeTab === "UNITS" && (
                    <td className="py-[2.5px] text-center text-ink-secondary font-sans text-[10px] leading-tight">
                      {(() => {
                        const yr = recommendations[row.name];
                        if (!yr) {
                          if (recsLoading) {
                            return (
                              <span className="text-ink-dim italic animate-soft-pulse">
                                loading latest AI update…
                              </span>
                            );
                          }
                          if (
                            !planStatus.available &&
                            activeTab === "UNITS"
                          ) {
                            return (
                              <span
                                className="text-ink-dim italic"
                                title={`No ${planStatus.month ?? ""} sheet in HFTPY Plan.xlsx — add it to get period recommendations.`}
                              >
                                awaiting {planStatus.month ?? "period"}{" "}
                                plan
                              </span>
                            );
                          }
                          return (
                            <span
                              className="text-ink-dim italic"
                              title={`No target on file for ${row.name}, so no recommendation can be computed. Add it to Target sheet.xlsx.`}
                            >
                              no target on file
                            </span>
                          );
                        }

                        if (yr.product_level && yr.product_level !== "UNIT") {
                          const recover = yr.passes_to_recover;
                          const headroom = yr.failure_headroom;
                          const onTarget = isNum(headroom);
                          const hopeless =
                            isNum(recover) && recover > yr.tested_quantity;
                          const colour = onTarget
                            ? palette.healthy
                            : palette.critical;
                          return (
                            <div
                              className="flex flex-col gap-[1px] text-[9px] leading-[1.3] min-w-[110px]"
                              title={
                                onTarget
                                  ? `${yr.product}: ${yr.tested_quantity.toLocaleString()} tested at ${isNum(yr.current_yield) ? (yr.current_yield * 100).toFixed(1) : "—"}%, above the ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% target. ${headroom.toLocaleString()} further failure(s) can be absorbed before it breaches.`
                                  : hopeless
                                    ? `${yr.product}: needs ${recover?.toLocaleString()} consecutive passes to reach the ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% target — more than the ${yr.tested_quantity.toLocaleString()} already built. Not recoverable this period.`
                                    : `${yr.product}: ${yr.tested_quantity.toLocaleString()} tested at ${isNum(yr.current_yield) ? (yr.current_yield * 100).toFixed(1) : "—"}%, below the ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% target. ${isNum(recover) ? recover.toLocaleString() : "—"} consecutive passes would restore it. No period plan exists for module products, so no feasibility verdict is given.`
                              }
                            >
                              <div className="flex justify-between gap-2">
                                <span className="text-ink-dim">
                                  Yield / target
                                </span>
                                <span className="text-ink-secondary font-bold tabular-nums">
                                  {isNum(yr.current_yield)
                                    ? `${(yr.current_yield * 100).toFixed(1)}%`
                                    : "—"}
                                  <span className="text-ink-dim"> / </span>
                                  {isNum(yr.target_yield)
                                    ? `${(yr.target_yield * 100).toFixed(0)}%`
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-ink-dim">Tested</span>
                                <span className="text-ink-secondary font-bold tabular-nums">
                                  {yr.tested_quantity.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2 items-center mt-[1px]">
                                <span className="text-ink-dim">
                                  {onTarget
                                    ? "Failures spare"
                                    : "Passes to recover"}
                                </span>
                                <span
                                  className="font-black px-1.5 py-[1px] rounded text-[8.5px] uppercase tracking-wide tabular-nums"
                                  style={{
                                    color: colour,
                                    backgroundColor: `${colour}1a`,
                                    border: `1px solid ${colour}55`,
                                  }}
                                  title={
                                    hopeless
                                      ? `Needs ${recover?.toLocaleString()} consecutive passes — more than the ${yr.tested_quantity.toLocaleString()} already built. Not recoverable this period.`
                                      : undefined
                                  }
                                >
                                  {onTarget
                                    ? headroom.toLocaleString()
                                    : hopeless
                                      ? `>${yr.tested_quantity.toLocaleString()}`
                                      : isNum(recover)
                                        ? recover.toLocaleString()
                                        : "n/a"}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const verdictLabel =
                          {
                            ACHIEVED: "Achieved",
                            ACHIEVABLE: "Achievable",
                            UNLIKELY: "Unlikely",
                            NOT_ACHIEVABLE: "Not achievable",
                          }[yr.achievability as string] ?? "—";
                        const achievable =
                          yr.achievability === "ACHIEVED" ||
                          yr.achievability === "ACHIEVABLE";
                        const verdictColor = achievable
                          ? palette.healthy
                          : palette.critical;
                        const unprecedented = yr.achievability === "UNLIKELY";

                        return (
                          <div
                            className="flex flex-col gap-[1px] text-[9px] leading-[1.3] min-w-[110px]"
                            title={
                              yr.recommendation ||
                              [
                                `${yr.product}: ${yr.tested_quantity.toLocaleString()} of ${isNum(yr.planned_quantity) ? yr.planned_quantity.toLocaleString() : "—"} planned units built at ${isNum(yr.current_yield) ? (yr.current_yield * 100).toFixed(1) : "—"}%, against a ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% period target.`,
                                isNum(yr.remaining_quantity) &&
                                isNum(yr.required_future_yield)
                                  ? `The remaining ${yr.remaining_quantity.toLocaleString()} units must average ${(yr.required_future_yield * 100).toFixed(1)}%.`
                                  : "No remaining quantity is known, so no required yield can be computed.",
                                unprecedented &&
                                isNum(yr.best_historical_yield)
                                  ? `That is above the best full period on record (${(yr.best_historical_yield * 100).toFixed(1)}%) — unprecedented for this product.`
                                  : isNum(yr.best_historical_yield)
                                    ? `Within the best full period on record (${(yr.best_historical_yield * 100).toFixed(1)}%).`
                                    : "No completed periods on record to compare against.",
                                `Maths: ${yr.mathematical_status ?? "n/a"} · History: ${yr.historical_status ?? "n/a"} · Verdict: ${yr.achievability ?? "n/a"}`,
                              ].join("\n")
                            }
                          >
                            <div className="flex items-center justify-center mt-[1px]">
                              <span
                                className="font-black px-1.5 py-[1px] rounded text-[8.5px] uppercase tracking-wide"
                                style={{
                                  color: verdictColor,
                                  backgroundColor: `${verdictColor}1a`,
                                  border: `1px solid ${verdictColor}55`,
                                }}
                              >
                                {verdictLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end items-center gap-3 mt-1.5 pt-2 text-[11px] text-white border-t border-line">
          <span className="text-ink-muted font-bold">
            {Math.min(
              (safePage - 1) * ITEMS_PER_PAGE + 1,
              sortedRows.length,
            )}{" "}
            - {Math.min(safePage * ITEMS_PER_PAGE, sortedRows.length)}{" "}
            of {sortedRows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className={`p-1 transition-colors ${safePage === 1 ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
            >
              <ChevronsLeft size={13} />
            </button>
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className={`p-1 transition-colors ${safePage === 1 ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
            >
              <ChevronLeft size={13} />
            </button>
            <button className="bg-line text-white font-bold w-4.5 h-4.5 rounded flex items-center justify-center text-[10px]">
              {safePage}
            </button>
            <button
              onClick={() =>
                setPage(Math.min(totalPages, safePage + 1))
              }
              disabled={safePage === totalPages}
              className={`p-1 transition-colors ${safePage === totalPages ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
            >
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              className={`p-1 transition-colors ${safePage === totalPages ? "text-ink-dim/50 cursor-not-allowed" : "text-ink-dim hover:text-white"}`}
            >
              <ChevronsRight size={13} />
            </button>
          </div>
        </div>
          </>
        )}

        {/* The drill-down for a UNITS row. Mounted at the panel level because the
            UNITS table is the panel's own, unlike the step tabs which each own a
            StepPane.

            businessDate is left null on purpose: the UNITS table always shows the
            current production day, and the endpoint defaults to the same one, so
            passing nothing keeps the two in step. */}
        {levelSelection && (
          <ProductDrilldownModal
            step={levelSelection.step}
            item={levelSelection.item}
            productName={levelSelection.name}
            businessDate={null}
            onClose={() => setLevelSelection(null)}
          />
        )}
      </section>
  );
};

export default ProductYieldPanel;
