import { useEffect, useState } from "react";
import { REWORK_SURFACE } from "./reworkPalette";
import ReworkChainCard, {
  chainBars,
  fmtCount,
  resolvePick,
  TopSelect,
} from "./ReworkChainCard";
import ReworkPeriodControls, {
  DEFAULT_REWORK_SCOPE,
  ReworkPeriodTitle,
} from "./ReworkPeriodControls";
import type { ReworkScope } from "./useReworkParetos";
import { useSpiComponentPareto, useSpiDefectPareto } from "./useSpiRework";

type Props = {
  /** The SPI product row's item code. */
  item: string;
  productName?: string | null;
  /** Reports in-flight requests so the modal shell can lock. */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * SPI rework for one product: which defect types failed its boards, and which
 * components carried the one chosen (handoff 3.6).
 *
 * Week / Month only — the endpoints refuse `day`. The component chart follows
 * the selected defect bar and defaults to the biggest, so it is never blank on
 * open. Counts COMPONENTS on NG boards: one ComponentID on one board counts
 * once, however many pins it flagged. WARNING_… results are left out by the
 * server and reported as a count.
 */
export const SpiReworkPane = ({ item, productName, onBusyChange }: Props) => {
  const [scope, setScope] = useState<ReworkScope>(DEFAULT_REWORK_SCOPE);
  const [top, setTop] = useState(3);
  const [chosen, setChosen] = useState<string | null>(null);

  const defects = useSpiDefectPareto(item, scope, top);
  const activeDefect = resolvePick(chosen, defects.data?.rows, "defect");
  const components = useSpiComponentPareto(item, scope, top, activeDefect);

  const period = defects.data?.period ?? null;
  const loading = defects.state === "loading" || components.state === "loading";
  useEffect(() => {
    onBusyChange?.(loading);
  }, [loading, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const totals = defects.data?.totals;

  return (
    <div
      className="flex-1 overflow-auto px-6 pt-3 pb-4 space-y-3"
      style={{ backgroundColor: REWORK_SURFACE.background }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <span className="text-[14px] font-black text-white uppercase tracking-wider truncate">
            {defects.data?.product_name ?? productName ?? item}
            <span className="ml-1.5 text-[11px] font-mono font-bold text-ink-dim normal-case">({item})</span>
          </span>
          <ReworkPeriodTitle period={period} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReworkPeriodControls
            scope={scope}
            onScopeChange={setScope}
            period={period}
            loading={loading}
            rejected={defects.status === 400}
            allowDay={false}
          />
          <TopSelect value={top} options={[3, 5, 10, 15]} onChange={setTop} />
        </div>
      </div>

      {defects.state === "error" && defects.data && (
        <div className="text-[11px] font-bold text-warning">{defects.error}</div>
      )}

      {totals && (
        <div className="text-[10.5px] font-bold text-ink-muted">
          {fmtCount(totals.ng_boards)} NG boards of {fmtCount(totals.boards_inspected)} inspected ·{" "}
          {fmtCount(totals.components)} defective components across{" "}
          {fmtCount(totals.distinct_defects)} defect types
          {totals.warning_components > 0 && (
            <span className="text-ink-dim">
              {" "}· {fmtCount(totals.warning_components)} warning-only components left out
            </span>
          )}
        </div>
      )}

      {defects.data && totals?.ng_boards === 0 ? (
        <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
          No NG boards for this product in this period.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ReworkChainCard
            title="Defect type"
            query={defects}
            emptyLabel="No defect records on the NG boards."
            bars={(d) => chainBars(d.rows, "defect", "Components")}
            valueLabel="Components"
            onBarClick={setChosen}
            selectedKey={activeDefect}
            caption="Click a bar to see which components carried that defect. One component on one NG board counts once, however many pins it flagged."
          />
          <ReworkChainCard
            title={
              <>
                Components
                {components.data && (
                  <span className="ml-1.5 normal-case text-info">· {components.data.defect_label}</span>
                )}
              </>
            }
            aside={
              components.data && (
                <span className="text-[10px] font-bold text-ink-muted whitespace-nowrap">
                  {fmtCount(components.data.totals.components)} across{" "}
                  {fmtCount(components.data.totals.distinct_components)} components
                </span>
              )
            }
            query={components}
            idleLabel={defects.data ? "No defect to break down." : ""}
            emptyLabel="No components recorded for this defect."
            // "(unnamed)" is the end of the line on SPI: there is no level below.
            bars={(d) => chainBars(d.rows, "component", "NG boards", ["(unnamed)"])}
            valueLabel="NG boards"
            caption="Each bar is the number of NG boards on which that component had this defect."
          />
        </div>
      )}
    </div>
  );
};

export default SpiReworkPane;
