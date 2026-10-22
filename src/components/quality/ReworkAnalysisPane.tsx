import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServerParetoChart from "../charts/ServerParetoChart.lazy";
import type { ServerParetoBar } from "../charts/ServerParetoChart";
import type { YieldRequestLevel } from "./dashboardFilters";
import {
  useReworkParetos,
  type CategoryParetoResponse,
  type FailureIdParetoResponse,
  type ReworkGranularity,
  type ReworkScope,
} from "./useReworkParetos";

const GRANULARITIES: { key: ReworkGranularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];
const SHIFTS = [null, "A", "B", "C"] as const;
const TOP_OPTIONS = [10, 15, 20, 30, 50];

/** The anchor limit, kept here only to grey out ‹ before a request that is
 *  certain to 400. The server is the authority — and this is deliberately NOT
 *  the dashboard's 30-day validator, which does not apply to these endpoints. */
const MAX_ANCHOR_DAYS_BACK = 365;

const oldestAnchor = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - MAX_ANCHOR_DAYS_BACK);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
};

const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US") : "—";

const pill = (on: boolean) =>
  `border text-[10px] font-bold px-2.5 py-1 rounded uppercase transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
    on ? "bg-tab-active text-white border-tab-border/50" : "bg-page text-ink-dim border-line hover:bg-line"
  }`;

const categoryBars = (data: CategoryParetoResponse): ServerParetoBar[] =>
  data.rows.map((r) => ({
    key: r.category,
    label: r.label,
    value: r.units,
    cumPct: r.cum_pct,
    muted: r.category === "UNCATEGORISED",
    details: [
      ["Units", fmt(r.units)],
      ["Of failed units", r.pct_of_failed === null ? "—" : `${r.pct_of_failed.toFixed(1)}%`],
      ["Of assignments", `${r.share_pct.toFixed(1)}%`],
    ],
  }));

const failureIdBars = (data: FailureIdParetoResponse): ServerParetoBar[] =>
  data.rows.map((r) => {
    const others = r.failure_id === "Others";
    const details: [string, string][] = [["Events", fmt(r.events)]];
    // null on Others: its units are not distinct across the folded ids.
    if (r.units !== null) details.push(["Units", fmt(r.units)]);
    details.push(["Share", `${r.share_pct.toFixed(1)}%`]);
    return {
      key: r.failure_id,
      label: others && r.folded_ids?.length ? `Others (+${r.folded_ids.length} more)` : r.failure_id,
      value: r.events,
      cumPct: r.cum_pct,
      muted: others || r.failure_id === "(none)",
      details,
      note: others
        ? r.folded_ids?.length
          ? `${r.folded_ids.slice(0, 8).join(", ")}${r.folded_ids.length > 8 ? ` +${r.folded_ids.length - 8} more` : ""}`
          : null
        : r.sample_comment,
    };
  });

type Props = {
  /** The Product Yield tab the row came from. */
  level: YieldRequestLevel;
  /** The row's item code, never its display name. */
  item: string;
  /** Reports whether either pareto is in flight, so the modal's shell can show
   *  its loading lock -- the pane's requests are its own, not the modal's. */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Rework analysis for one Product Yield row: failures by defect category and by
 * failure id, for one fiscal day, week or period (handoff Part 3.4).
 *
 * Owns its own period, shift and window rules. The drill-down's date picker,
 * the dashboard's 30-day limit and the line filter do not apply: the endpoints
 * take an `anchor` up to 365 days back, and rework is per product with no line.
 */
export const ReworkAnalysisPane = ({ level, item, onBusyChange }: Props) => {
  const [scope, setScope] = useState<ReworkScope>({
    granularity: "week",
    // Unset on open so the server picks today. Afterwards only ever an anchor
    // the server returned — fiscal periods do not follow calendar weeks or
    // months, so a date computed here would land in the wrong one.
    anchor: null,
    shift: null,
  });
  const [top, setTop] = useState(15);
  const [firstPassOnly, setFirstPassOnly] = useState(false);

  const { category, failureId } = useReworkParetos(level, item, scope, top, firstPassOnly);

  // The period both charts are on. Read from whichever answered last; they are
  // requested with the same scope, so they agree.
  const head = category.data ?? failureId.data;
  const period = head?.period ?? null;
  const loading = category.state === "loading" || failureId.state === "loading";
  useEffect(() => {
    onBusyChange?.(loading);
  }, [loading, onBusyChange]);
  // Unmounting mid-request (switching back to Table) must not leave the
  // modal locked on a request nobody is waiting for.
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const tooFarBack = category.status === 400 || failureId.status === 400;

  const prevDisabled =
    loading || !period?.prev_anchor || period.prev_anchor < oldestAnchor() || tooFarBack;
  const nextDisabled = loading || !period?.next_anchor;

  // 404 = this item belongs to the other module tab. Nothing to show for any
  // period, so it replaces the whole pane rather than sitting in one chart.
  if (category.status === 404 || failureId.status === 404) {
    return (
      <div className="py-16 px-8 text-center">
        <div className="text-[12px] font-bold text-warning mb-1.5">
          No rework analysis for {item} on the {level} tab
        </div>
        <div className="text-[11px] text-ink-dim max-w-[60ch] mx-auto leading-relaxed">
          {category.error ?? failureId.error}
        </div>
      </div>
    );
  }

  const failedUnits = category.data?.totals.failed_units ?? null;
  const noFailures = category.state === "ready" && failedUnits === 0;

  return (
    <div className="flex-1 overflow-auto px-6 pt-3 pb-4 space-y-3">
      {/* ---- period, shift --------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[14px] font-black text-white uppercase tracking-wider truncate">
            {head?.product_name ?? item}
            <span className="ml-1.5 text-[11px] font-mono font-bold text-ink-dim normal-case">({item})</span>
          </span>
          {period && (
            <>
              <span className="text-[13px] font-black text-info whitespace-nowrap">
                – {period.label}
                {period.partial && <span className="ml-1 text-[11px] font-bold text-warning">(in progress)</span>}
              </span>
              <span className="text-[10.5px] font-bold text-ink-dim whitespace-nowrap">
                {period.from === period.to ? period.from : `${period.from} – ${period.to}`}
                {period.partial && period.read_to !== period.to && ` · data to ${period.read_to}`}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {GRANULARITIES.map((g) => (
              <button
                key={g.key}
                type="button"
                disabled={loading && scope.granularity !== g.key}
                // Keeps the anchor, so the user stays around the same date.
                onClick={() => setScope((s) => ({ ...s, granularity: g.key }))}
                className={pill(scope.granularity === g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous period"
              disabled={prevDisabled}
              onClick={() => period?.prev_anchor && setScope((s) => ({ ...s, anchor: period.prev_anchor }))}
              className={`${pill(false)} !px-1.5`}
              title={tooFarBack ? "Older than 365 days is not available" : "Previous period"}
            >
              <ChevronLeft size={12} />
            </button>
            <button
              type="button"
              aria-label="Next period"
              disabled={nextDisabled}
              onClick={() => period?.next_anchor && setScope((s) => ({ ...s, anchor: period.next_anchor }))}
              className={`${pill(false)} !px-1.5`}
              title={period && !period.next_anchor ? "This is the current period" : "Next period"}
            >
              <ChevronRight size={12} />
            </button>
          </div>
          <select
            value={scope.shift ?? ""}
            onChange={(e) =>
              setScope((s) => ({ ...s, shift: (e.target.value || null) as ReworkScope["shift"] }))
            }
            className="bg-page border border-line rounded px-2 py-1 text-[10px] font-bold text-white uppercase cursor-pointer"
            aria-label="Shift"
          >
            {SHIFTS.map((s) => (
              <option key={s ?? "all"} value={s ?? ""}>
                {s ? `Shift ${s}` : "All shifts"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* A 400 keeps the last good period on screen — the hook holds the old
          body — and says why the step did not happen. */}
      {(category.state === "error" || failureId.state === "error") && (
        <div className="text-[11px] font-bold text-warning">
          {category.error ?? failureId.error}
        </div>
      )}

      {noFailures ? (
        <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
          No failures in this period.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* ---- defect category ---------------------------------------- */}
          <section className="bg-inset/40 border border-line rounded-lg px-4 pt-3 pb-3 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
                Defect category
              </span>
            </div>
            {category.data && (
              <div className="text-[10.5px] font-bold text-ink-muted mb-1.5">
                {fmt(category.data.totals.failed_units)} failed units ·{" "}
                {fmt(category.data.totals.dispositioned_units)} dispositioned
                {category.data.totals.awaiting_disposition > 0 && (
                  <span className="text-warning">
                    {" "}· {fmt(category.data.totals.awaiting_disposition)} awaiting
                  </span>
                )}
              </div>
            )}
            {!category.data ? (
              <div className="py-16 text-center text-[11px] font-bold text-ink-dim">
                {category.state === "error" ? "" : "Loading defect categories…"}
              </div>
            ) : category.data.rows.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-[12px] font-bold text-ink-dim">Failures not yet dispositioned</div>
                <div className="text-[11px] text-warning mt-1">
                  {fmt(category.data.totals.awaiting_disposition)} units awaiting rework disposition
                </div>
              </div>
            ) : (
              <>
                <ServerParetoChart bars={categoryBars(category.data)} valueLabel="Units" labelChars={12} />
                <div className="text-[10px] text-ink-dim leading-snug mt-1">
                  A unit reworked under two causes counts under both, so % of failed
                  units can add up past 100. The line is share of all assignments.
                </div>
              </>
            )}
          </section>

          {/* ---- failure id --------------------------------------------- */}
          <section className="bg-inset/40 border border-line rounded-lg px-4 pt-3 pb-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
                Failure id
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-ink-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={firstPassOnly}
                    onChange={(e) => setFirstPassOnly(e.target.checked)}
                    className="accent-[#0091ff]"
                  />
                  First attempts only
                </label>
                <select
                  value={top}
                  onChange={(e) => setTop(Number(e.target.value))}
                  className="bg-page border border-line rounded px-1.5 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                  aria-label="How many failure ids to show"
                >
                  {TOP_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      Top {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {failureId.data && (
              <div className="text-[10.5px] font-bold text-ink-muted mb-1.5">
                {fmt(failureId.data.totals.events)} failures across{" "}
                {fmt(failureId.data.totals.distinct_failure_ids)} parameters
              </div>
            )}
            {!failureId.data ? (
              <div className="py-16 text-center text-[11px] font-bold text-ink-dim">
                {failureId.state === "error" ? "" : "Loading failure ids…"}
              </div>
            ) : failureId.data.rows.length === 0 ? (
              <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
                No failure records
              </div>
            ) : (
              <ServerParetoChart bars={failureIdBars(failureId.data)} valueLabel="Events" labelChars={14} />
            )}
          </section>
        </div>
      )}

      {head && (
        <div className="text-[10px] text-ink-dim leading-relaxed">
          {head.step} · test {head.operations.test.join(", ")} · rework{" "}
          {head.operations.rework.join(", ")}. Weeks and periods follow the
          fiscal calendar. Rework analysis is per product and is not filtered by line.
        </div>
      )}
    </div>
  );
};

export default ReworkAnalysisPane;
