import { useRef } from "react";
import ServerParetoChart from "../charts/ServerParetoChart.lazy";
import type { ServerParetoBar } from "../charts/ServerParetoChart";
import ChartExportButtons from "./ChartExportButtons";
import { errorTone } from "./dashboardFilters";
import { REWORK_PARETO_COLORS, REWORK_SURFACE } from "./reworkPalette";
import type { ParetoQuery } from "./useReworkParetos";
import type { ChainParetoRow } from "./useSpiRework";

const CARD_STYLE = { backgroundColor: REWORK_SURFACE.panel };

export const fmtCount = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US") : "—";

/** What a bar is called on the next level's request, per chart. */
export type ChainKey = "defect" | "component" | "nc" | "ref_des";

/** The value sent back to the server for a row — the identity key, never the
 *  label. ref_des "" is a real value ("no designator on record"). */
export const rowKey = (r: ChainParetoRow, key: ChainKey): string => r[key] ?? r.label;

/**
 * Rows to bars, in the server's order (it is already the pareto order).
 *
 * `leafMuted` names the placeholder values that are not worth drilling into on
 * THIS chart — "(unnamed)" is a dead end on SPI but clickable on DPMOI, which
 * is why it is the caller's call. "Others" is always muted: it is a fold.
 */
export const chainBars = (
  rows: ChainParetoRow[],
  key: ChainKey,
  valueName: string,
  leafMuted: string[] = [],
): ServerParetoBar[] =>
  rows.map((r) => {
    const k = rowKey(r, key);
    const others = k === "Others";
    const value = r.components ?? r.defects ?? 0;
    const details: [string, string][] = [[valueName, fmtCount(value)]];
    if (typeof r.share_pct === "number") details.push(["Share", `${r.share_pct.toFixed(1)}%`]);
    return {
      // An empty ref_des still needs a unique, stable key for the chart.
      key: k === "" ? "__no_ref_des__" : k,
      label: others && r.folded ? `Others (+${r.folded})` : r.label,
      value,
      cumPct: r.cum_pct,
      muted: others || leafMuted.includes(k),
      details,
      note: others && r.folded ? `${r.folded} more folded into this bar` : (r.description ?? null),
    };
  });

type Props<T extends { rows: ChainParetoRow[] }> = {
  title: React.ReactNode;
  /** Right of the title: a total, a control. */
  aside?: React.ReactNode;
  query: ParetoQuery<T>;
  /** Shown instead of the chart before this level has anything to ask for. */
  idleLabel?: string;
  emptyLabel: string;
  bars: (data: T) => ServerParetoBar[];
  valueLabel: string;
  /** Makes the bars drive the next level. */
  onBarClick?: (key: string) => void;
  selectedKey?: string | null;
  caption?: React.ReactNode;
  /** Adds PNG / Copy buttons. The title and subtitle are what the image says
   *  about itself, since a pasted chart has no screen around it. */
  exportAs?: {
    filename: string;
    title: string;
    subtitle?: string;
    summary?: string;
    note?: string;
  };
};

/**
 * One link of a rework drill chain: a card holding one server-ordered pareto,
 * its loading / error / empty states, and optionally the click that feeds the
 * next card. The SPI and DPMOI views are two and three of these side by side.
 */
export const ReworkChainCard = <T extends { rows: ChainParetoRow[] }>({
  title,
  aside,
  query,
  idleLabel = "",
  emptyLabel,
  bars,
  valueLabel,
  onBarClick,
  selectedKey = null,
  caption,
  exportAs,
}: Props<T>) => {
  const cardRef = useRef<HTMLElement>(null);
  const hasChart = Boolean(query.data && query.data.rows.length > 0);
  return (
  <section ref={cardRef} className="border border-line rounded-lg px-4 pt-3 pb-3 min-w-0" style={CARD_STYLE}>
    <div className="flex items-center justify-between gap-2 mb-1 min-h-[20px]">
      <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim truncate">
        {title}
      </span>
      <span className="flex items-center gap-2">
        {exportAs && (
          <ChartExportButtons
            targetRef={cardRef}
            filename={exportAs.filename}
            disabled={!hasChart}
            options={() => ({
              title: exportAs.title,
              subtitle: exportAs.subtitle,
              summary: exportAs.summary,
              note: exportAs.note,
              legend: [
                { label: valueLabel, color: REWORK_PARETO_COLORS.vital },
                { label: "Cumulative %", color: REWORK_PARETO_COLORS.line, kind: "line" },
                { label: "80% cut-off", color: REWORK_PARETO_COLORS.cutoff, kind: "dashed" },
              ],
            })}
          />
        )}
        {aside}
      </span>
    </div>
    {query.state === "idle" ? (
      <div className="py-14 text-center text-[11px] font-bold text-ink-dim">{idleLabel}</div>
    ) : query.state === "error" && !query.data ? (
      <div className={`py-14 text-center text-[11px] font-bold ${errorTone(query.error)}`}>{query.error}</div>
    ) : !query.data ? (
      <div className="py-14 text-center text-[11px] font-bold text-ink-dim">Loading…</div>
    ) : query.data.rows.length === 0 ? (
      <div className="py-14 text-center text-[12px] font-bold text-ink-dim">{emptyLabel}</div>
    ) : (
      <>
        <ServerParetoChart
          bars={bars(query.data)}
          valueLabel={valueLabel}
          labelChars={12}
          height={220}
          colors={REWORK_PARETO_COLORS}
          onBarClick={onBarClick}
          selectedKey={selectedKey}
        />
        {caption && <div className="text-[10px] text-ink-dim leading-snug mt-1">{caption}</div>}
      </>
    )}
  </section>
  );
};

/** The first bar worth drilling into — what a level shows before any click. */
export const firstPickable = (
  rows: ChainParetoRow[] | undefined,
  key: ChainKey,
  skip: string[] = [],
): string | null => {
  const r = (rows ?? []).find((row) => {
    const k = rowKey(row, key);
    return k !== "Others" && !skip.includes(k);
  });
  return r ? rowKey(r, key) : null;
};

/** The user's pick while it is still a bar in the answer, else the first. */
export const resolvePick = (
  chosen: string | null,
  rows: ChainParetoRow[] | undefined,
  key: ChainKey,
  skip: string[] = [],
): string | null =>
  chosen !== null && (rows ?? []).some((r) => rowKey(r, key) === chosen)
    ? chosen
    : firstPickable(rows, key, skip);

export const TopSelect = ({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (n: number) => void;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    className="bg-page border border-line rounded px-1.5 py-1 text-[10px] font-bold text-white cursor-pointer"
    aria-label="How many bars each chart shows"
  >
    {options.map((n) => (
      <option key={n} value={n}>
        Top {n}
      </option>
    ))}
  </select>
);

export default ReworkChainCard;
