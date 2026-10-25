import { useState } from "react";
import LoadingBar from "../common/LoadingBar";
import ServerParetoChart from "../charts/ServerParetoChart.lazy";
import type { ServerParetoBar } from "../charts/ServerParetoChart";
import { REWORK_PARETO_COLORS, REWORK_SURFACE } from "./reworkPalette";
import ReworkPeriodControls, {
  DEFAULT_REWORK_SCOPE,
  ReworkPeriodTitle,
} from "./ReworkPeriodControls";
import type { ReworkScope } from "./useReworkParetos";
import {
  useSpiComponentPareto,
  useSpiDefectPareto,
  type SpiParetoRow,
} from "./useSpiRework";

const TOP_OPTIONS = [3, 5, 10, 15];
const CARD_STYLE = { backgroundColor: REWORK_SURFACE.panel };

const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US") : "—";

const toBars = (rows: SpiParetoRow[], keyOf: (r: SpiParetoRow) => string): ServerParetoBar[] =>
  rows.map((r) => {
    const key = keyOf(r);
    const others = key === "Others";
    return {
      key,
      label: others && r.folded ? `Others (+${r.folded})` : r.label,
      value: r.components,
      cumPct: r.cum_pct,
      // Folds and nameless components are not something to act on.
      muted: others || key === "(unnamed)",
      details: [
        ["Components", fmt(r.components)],
        ...(typeof r.share_pct === "number"
          ? ([["Share", `${r.share_pct.toFixed(1)}%`]] as [string, string][])
          : []),
      ],
      note: others && r.folded ? `${r.folded} more folded into this bar` : null,
    };
  });

type Props = {
  /** The dashboard's product selection (items or product names). Empty =
   *  the whole SPI card, which is how the endpoint reads no `product`. */
  products?: string[];
};

/**
 * SPI rework: which defect types failed the boards, and which components
 * carried the one chosen (handoff 3.6).
 *
 * Two linked paretos under one period selector — the same Day / Week / Month,
 * five-week window and From–To range as the unit rework view. The component
 * chart follows the selected defect bar, defaulting to the biggest so it is
 * never blank on open.
 *
 * Counts COMPONENTS on NG boards: one ComponentID on one board counts once,
 * however many pins it flagged. WARNING_… results are left out by the server
 * and reported as a count.
 */
export const SpiReworkPane = ({ products = [] }: Props) => {
  const [scope, setScope] = useState<ReworkScope>(DEFAULT_REWORK_SCOPE);
  const [top, setTop] = useState(3);
  // What the user clicked. The component chart shows this when it is still a
  // bar in the current answer, otherwise the top defect.
  const [chosen, setChosen] = useState<string | null>(null);

  const defects = useSpiDefectPareto(scope, products, top);
  const rows = defects.data?.rows ?? [];
  const pickable = rows.filter((r) => r.defect && r.defect !== "Others");
  const activeDefect =
    (chosen && pickable.some((r) => r.defect === chosen) ? chosen : pickable[0]?.defect) ?? null;

  const components = useSpiComponentPareto(scope, products, top, activeDefect);

  const period = defects.data?.period ?? components.data?.period ?? null;
  const loading = defects.state === "loading" || components.state === "loading";
  const totals = defects.data?.totals;

  return (
    <div
      className="relative flex-1 overflow-auto px-4 pt-3 pb-4 space-y-3 rounded-lg"
      style={{ backgroundColor: REWORK_SURFACE.background }}
    >
      <LoadingBar active={loading} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <span className="text-[13px] font-black text-white uppercase tracking-wider">
            SPI rework
          </span>
          <ReworkPeriodTitle period={period} />
          {products.length > 0 && (
            <span className="text-[10px] font-bold text-ink-dim" title={products.join(", ")}>
              · {products.length === 1 ? products[0] : `${products.length} products`}
            </span>
          )}
        </div>
        <ReworkPeriodControls
          scope={scope}
          onScopeChange={setScope}
          period={period}
          loading={loading}
          rejected={defects.status === 400}
        />
      </div>

      {defects.state === "error" && (
        <div className="text-[11px] font-bold text-warning">{defects.error}</div>
      )}

      {totals && (
        <div className="text-[10.5px] font-bold text-ink-muted">
          {fmt(totals.ng_boards)} NG boards of {fmt(totals.boards_inspected)} inspected ·{" "}
          {fmt(totals.components)} defective components across {fmt(totals.distinct_defects)} defect
          types
          {totals.warning_components > 0 && (
            <span className="text-ink-dim">
              {" "}· {fmt(totals.warning_components)} warning-only components left out
            </span>
          )}
        </div>
      )}

      {defects.data && totals?.ng_boards === 0 ? (
        <div className="py-12 text-center text-[12px] font-bold text-ink-dim">
          No NG boards in this period.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* ---- defect type ------------------------------------------- */}
          <section className="border border-line rounded-lg px-4 pt-3 pb-3 min-w-0" style={CARD_STYLE}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
                Defect type
              </span>
              <select
                value={top}
                onChange={(e) => setTop(Number(e.target.value))}
                className="bg-page border border-line rounded px-1.5 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                aria-label="How many bars to show"
              >
                {TOP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>
            </div>
            {!defects.data ? (
              <div className="py-14 text-center text-[11px] font-bold text-ink-dim">
                {defects.state === "error" ? "" : "Loading SPI defects…"}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-14 text-center text-[12px] font-bold text-ink-dim">
                No defect records on the NG boards.
              </div>
            ) : (
              <>
                <ServerParetoChart
                  bars={toBars(rows, (r) => r.defect ?? r.label)}
                  valueLabel="Components"
                  labelChars={14}
                  height={230}
                  colors={REWORK_PARETO_COLORS}
                  onBarClick={setChosen}
                  selectedKey={activeDefect}
                />
                <div className="text-[10px] text-ink-dim leading-snug mt-1">
                  Click a bar to see which components carried that defect. One
                  component on one NG board counts once, however many pins it
                  flagged.
                </div>
              </>
            )}
          </section>

          {/* ---- components of the selected defect --------------------- */}
          <section className="border border-line rounded-lg px-4 pt-3 pb-3 min-w-0" style={CARD_STYLE}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
                Components
                {components.data && (
                  <span className="ml-1.5 normal-case text-info">
                    · {components.data.defect_label}
                  </span>
                )}
              </span>
              {components.data && (
                <span className="text-[10px] font-bold text-ink-muted">
                  {fmt(components.data.totals.components)} across{" "}
                  {fmt(components.data.totals.distinct_components)} components
                </span>
              )}
            </div>
            {!activeDefect ? (
              <div className="py-14 text-center text-[11px] font-bold text-ink-dim">
                {defects.data ? "No defect to break down." : ""}
              </div>
            ) : components.state === "error" ? (
              <div className="py-14 text-center text-[11px] font-bold text-warning">
                {components.error}
              </div>
            ) : !components.data ? (
              <div className="py-14 text-center text-[11px] font-bold text-ink-dim">
                Loading components…
              </div>
            ) : components.data.rows.length === 0 ? (
              <div className="py-14 text-center text-[12px] font-bold text-ink-dim">
                No components recorded for this defect.
              </div>
            ) : (
              <>
                <ServerParetoChart
                  bars={toBars(components.data.rows, (r) => r.component ?? r.label)}
                  valueLabel="NG boards"
                  labelChars={14}
                  height={230}
                  colors={REWORK_PARETO_COLORS}
                />
                <div className="text-[10px] text-ink-dim leading-snug mt-1">
                  Each bar is the number of NG boards on which that component had
                  this defect.
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default SpiReworkPane;
