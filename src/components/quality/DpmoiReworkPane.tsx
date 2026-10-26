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
import {
  useDpmoiComponentPareto,
  useDpmoiNcPareto,
  useDpmoiRefDesPareto,
} from "./useSpiRework";

type Props = {
  item: string;
  /** AOI_TOP_REWORK_IN04 / AOI_BOT_REWORK_IN04 from the clicked row, or null
   *  for a row that covers both sides. */
  operation: string | null;
  /** Reports in-flight requests so the modal shell can lock. */
  onBusyChange?: (busy: boolean) => void;
};

/** "AOI_TOP_REWORK_IN04" -> "TOP". */
const sideOf = (op: string | null) => (op ? (/TOP/i.test(op) ? "TOP" : /BOT/i.test(op) ? "BOT" : op) : "TOP + BOT");

/**
 * DPMOI rework for one product: NC code → component → ref_des (handoff 3.7).
 *
 * Three linked paretos, each driving the next and each defaulting to the
 * biggest bar, so all three are filled on open. Counts DEFECTS exactly as the
 * DPMOI card does, so the NC bars add up to the product's defects, a component
 * chart to its NC bar, a ref_des chart to its component bar. Week / Month only.
 */
export const DpmoiReworkPane = ({ item, operation, onBusyChange }: Props) => {
  const [scope, setScope] = useState<ReworkScope>(DEFAULT_REWORK_SCOPE);
  const [top, setTop] = useState(5);
  const [chosenNc, setChosenNc] = useState<string | null>(null);
  const [chosenComponent, setChosenComponent] = useState<string | null>(null);

  const ncs = useDpmoiNcPareto(item, operation, scope, top);
  const nc = resolvePick(chosenNc, ncs.data?.rows, "nc");
  const components = useDpmoiComponentPareto(item, operation, scope, top, nc);
  // Only read the component answer that belongs to the NC on screen, so a
  // stale list never picks a component for the wrong NC.
  const componentRows = components.data?.nc === nc ? components.data.rows : undefined;
  const component = resolvePick(chosenComponent, componentRows, "component");
  const refDes = useDpmoiRefDesPareto(item, operation, scope, top, nc, component);

  const period = ncs.data?.period ?? null;
  const loading =
    ncs.state === "loading" || components.state === "loading" || refDes.state === "loading";
  useEffect(() => {
    onBusyChange?.(loading);
  }, [loading, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const totals = ncs.data?.totals;

  return (
    <div
      className="flex-1 overflow-auto px-6 pt-3 pb-4 space-y-3"
      style={{ backgroundColor: REWORK_SURFACE.background }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <span className="text-[14px] font-black text-white uppercase tracking-wider truncate">
            {ncs.data?.product_name ?? item}
            <span className="ml-1.5 text-[11px] font-mono font-bold text-ink-dim normal-case">({item})</span>
          </span>
          <span className="text-[10.5px] font-black uppercase tracking-wider text-ink-dim whitespace-nowrap">
            AOI {sideOf(operation)}
          </span>
          <ReworkPeriodTitle period={period} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReworkPeriodControls
            scope={scope}
            onScopeChange={setScope}
            period={period}
            loading={loading}
            rejected={ncs.status === 400}
            allowDay={false}
          />
          <TopSelect value={top} options={[5, 10, 15]} onChange={setTop} />
        </div>
      </div>

      {ncs.state === "error" && ncs.data && (
        <div className="text-[11px] font-bold text-warning">{ncs.error}</div>
      )}

      {totals && (
        <div className="text-[10.5px] font-bold text-ink-muted">
          {fmtCount(totals.defects)} defects on {fmtCount(totals.boards_inspected)} boards ·{" "}
          {fmtCount(totals.distinct_ncs)} NC codes
          {/* Should always agree; when it does not, say so rather than let two
              different figures for one card sit on screen unexplained. */}
          {totals.card_defects !== totals.defects && (
            <span className="text-warning">
              {" "}· card shows {fmtCount(totals.card_defects)}
            </span>
          )}
        </div>
      )}

      {ncs.data && totals?.defects === 0 ? (
        <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
          No DPMOI defects for this product in this period.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ReworkChainCard
            title="NC code"
            query={ncs}
            emptyLabel="No defect records."
            bars={(d) => chainBars(d.rows, "nc", "Defects")}
            valueLabel="Defects"
            onBarClick={(k) => {
              setChosenNc(k);
              // A new NC has its own components; start that chart from its top.
              setChosenComponent(null);
            }}
            selectedKey={nc}
            caption="Click an NC code for its components."
          />
          <ReworkChainCard
            title={
              <>
                Component
                {nc && <span className="ml-1.5 normal-case text-info">· {nc}</span>}
              </>
            }
            aside={
              components.data && (
                <span className="text-[10px] font-bold text-ink-muted whitespace-nowrap">
                  {fmtCount(components.data.totals.defects)} defects
                </span>
              )
            }
            query={components}
            idleLabel={ncs.data ? "No NC code to break down." : ""}
            emptyLabel="No components recorded for this NC code."
            // "(unnamed)" stays clickable here: the ref_des level still answers.
            bars={(d) => chainBars(d.rows, "component", "Defects")}
            valueLabel="Defects"
            onBarClick={setChosenComponent}
            selectedKey={component}
            caption={components.data?.nc_description ?? "Click a component for its ref_des."}
          />
          <ReworkChainCard
            title={
              <>
                Ref des
                {component && <span className="ml-1.5 normal-case text-info">· {component}</span>}
              </>
            }
            aside={
              refDes.data && (
                <span className="text-[10px] font-bold text-ink-muted whitespace-nowrap">
                  {fmtCount(refDes.data.totals.defects)} defects
                </span>
              )
            }
            query={refDes}
            idleLabel={components.data ? "No component to break down." : ""}
            emptyLabel="No designators recorded for this component."
            bars={(d) => chainBars(d.rows, "ref_des", "Defects")}
            valueLabel="Defects"
            caption="Defect positions on the board for this NC code and component."
          />
        </div>
      )}
    </div>
  );
};

export default DpmoiReworkPane;
