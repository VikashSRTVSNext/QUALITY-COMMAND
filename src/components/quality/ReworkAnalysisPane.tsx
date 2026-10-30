import { useEffect, useState } from "react";
import ServerParetoChart from "../charts/ServerParetoChart.lazy";
import type { ServerParetoBar } from "../charts/ServerParetoChart";
import StackedBarChart from "../charts/StackedBarChart.lazy";
import type { BarCategory, BarSeries } from "../charts/StackedBarChart";
import YieldTrendChart from "../charts/YieldTrendChart.lazy";
import type { YieldTrendPoint } from "../charts/YieldTrendChart";
import {
  REWORK_CATEGORY_COLORS,
  REWORK_PARETO_COLORS,
  REWORK_UNKNOWN_CATEGORY,
  REWORK_SURFACE,
  REWORK_YIELD_COLORS,
} from "./reworkPalette";
import { shortDay, type YieldRequestLevel } from "./dashboardFilters";
import ReworkPeriodControls, {
  DEFAULT_REWORK_SCOPE,
  ReworkPeriodTitle,
} from "./ReworkPeriodControls";
import {
  useCategoryTrend,
  useReworkParetos,
  useYieldTrend,
  type CategoryParetoResponse,
  type CategoryTrendResponse,
  type FailureIdParetoResponse,
  type ReworkScope,
  type YieldTrendResponse,
} from "./useReworkParetos";

const TOP_OPTIONS = [5, 10, 15, 20, 30, 50];

const categoryColor = (code: string): string =>
  REWORK_CATEGORY_COLORS[code] ?? REWORK_UNKNOWN_CATEGORY;

const CARD_STYLE = { backgroundColor: REWORK_SURFACE.panel };

const trendChart = (
  data: CategoryTrendResponse,
): { categories: BarCategory[]; series: BarSeries[] } => ({
  // In the server's order, biggest first: Recharts stacks the first series at
  // the bottom, which is where the handoff wants the biggest.
  series: data.categories.map((c) => ({
    key: c.category,
    label: c.label,
    color: categoryColor(c.category),
  })),
  // Every bucket, future ones included, so a week always reads as seven bars.
  categories: data.buckets.map((b) => ({
    key: b.from,
    // Week buckets are dates; month buckets are already "WK37".
    label: data.bucket === "day" ? shortDay(b.label) : b.label,
    values: b.by_category,
    hint: b.in_future
      ? "Not reached yet"
      : `${fmt(b.failed_units)} failed` +
        (b.awaiting_disposition > 0 ? ` · ${fmt(b.awaiting_disposition)} awaiting` : ""),
  })),
});

const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US") : "—";

const yieldPoints = (data: YieldTrendResponse): YieldTrendPoint[] =>
  data.buckets.map((b) => ({
    key: b.from,
    label: b.label,
    range: `${shortDay(b.from)} – ${shortDay(b.to)}`,
    passed: b.passed,
    failed: b.failed,
    tested: b.tested,
    fpyPct: b.fpy_pct,
    belowTarget: b.below_target,
    future: b.in_future,
  }));

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
      // assignments = dispositioned units since each unit has one category.
      ["Of dispositioned", `${r.share_pct.toFixed(1)}%`],
    ],
  }));

const failureIdBars = (data: FailureIdParetoResponse): ServerParetoBar[] =>
  data.rows.map((r) => {
    const others = r.failure_id === "Others";
    // Boards since 2026-10-29 (`events` equals it); an older backend sent a
    // null `units` on Others, so fall back to events there.
    const boards = r.units ?? r.events;
    const details: [string, string][] = [["Units", fmt(boards)]];
    if (typeof r.pct_of_failed === "number") {
      details.push(["Of failed units", `${r.pct_of_failed.toFixed(1)}%`]);
    }
    details.push(["Share", `${r.share_pct.toFixed(1)}%`]);
    return {
      key: r.failure_id,
      label: others && r.folded_ids?.length ? `Others (+${r.folded_ids.length} more)` : r.failure_id,
      value: boards,
      cumPct: r.cum_pct,
      muted: others || r.failure_id === "(none)",
      details,
      note: others
        ? r.folded_ids?.length
          ? `${r.folded_ids.slice(0, 8).join(", ")}${r.folded_ids.length > 8 ? ` +${r.folded_ids.length - 8} more` : ""}`
          : null
        : r.sample_comment,
      // A grouped bar (BIAS CHECKING XXXX DACX BXCHX) lists the raw ids it
      // stands for; an exact id has no `variants`.
      list: r.variants?.length
        ? { title: `${r.variants.length} variants`, items: r.variants }
        : null,
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
 * failure id, for one fiscal day, a span of fiscal weeks (the selected week and
 * the four before it by default, or a From–To range) or one fiscal period
 * (handoff Part 3.4).
 *
 * Owns its own period, shift and window rules. The drill-down's date picker,
 * the dashboard's 30-day limit and the line filter do not apply: the endpoints
 * take an `anchor` up to 365 days back, and rework is per product with no line.
 */
export const ReworkAnalysisPane = ({ level, item, onBusyChange }: Props) => {
  const [scope, setScope] = useState<ReworkScope>(DEFAULT_REWORK_SCOPE);
  const [top, setTop] = useState(5);

  const { category, failureId } = useReworkParetos(level, item, scope, top);
  const trend = useCategoryTrend(level, item, scope);
  const yieldTrend = useYieldTrend(level, item, scope);

  // The period both charts are on. Read from whichever answered last; they are
  // requested with the same scope, so they agree.
  const head = category.data ?? failureId.data;
  const period = head?.period ?? null;
  const loading =
    category.state === "loading" ||
    failureId.state === "loading" ||
    trend.state === "loading" ||
    yieldTrend.state === "loading";
  useEffect(() => {
    onBusyChange?.(loading);
  }, [loading, onBusyChange]);
  // Unmounting mid-request (switching back to Table) must not leave the
  // modal locked on a request nobody is waiting for.
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const tooFarBack = category.status === 400 || failureId.status === 400;

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

  const trendData = scope.granularity !== "day" ? trend.data : null;
  const trendView = trendData ? trendChart(trendData) : null;

  const yieldData = scope.granularity !== "day" ? yieldTrend.data : null;
  // 3.8 — beside the category trend, on the same weeks. Kept even with no
  // failures: a clean week is a 100% FPY point worth seeing.
  const yieldCard = scope.granularity !== "day" && (
    <section className="border border-line rounded-lg px-4 pt-3 pb-3 min-w-0" style={CARD_STYLE}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
          Yield by fiscal week
          {scope.granularity === "week" && period?.span_label && (
            <span className="ml-1.5 normal-case font-bold text-ink-dim/80">· {period.span_label}</span>
          )}
        </span>
        {yieldData && (
          <span className="text-[10.5px] font-bold text-ink-muted">
            {fmt(yieldData.totals.tested)} tested · {fmt(yieldData.totals.failed)} failed · FPY{" "}
            <span
              style={{
                color: yieldData.totals.below_target ? REWORK_YIELD_COLORS.belowTarget : undefined,
              }}
              className={yieldData.totals.below_target ? "" : "text-white"}
            >
              {yieldData.totals.fpy_pct === null ? "—" : `${yieldData.totals.fpy_pct.toFixed(1)}%`}
            </span>
            {yieldData.target_yield_pct !== null && (
              <span className="text-ink-dim"> / target {yieldData.target_yield_pct}%</span>
            )}
          </span>
        )}
      </div>
      {yieldTrend.state === "error" ? (
        <div className="py-10 text-center text-[11px] font-bold text-warning">{yieldTrend.error}</div>
      ) : !yieldData ? (
        <div className="py-16 text-center text-[11px] font-bold text-ink-dim">Loading yield trend…</div>
      ) : yieldData.totals.tested === 0 ? (
        <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
          Nothing tested in this period.
        </div>
      ) : (
        <>
          <YieldTrendChart
            points={yieldPoints(yieldData)}
            targetPct={yieldData.target_yield_pct}
            colors={REWORK_YIELD_COLORS}
            height={260}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-ink-dim mt-2">
            <LegendSwatch color={REWORK_YIELD_COLORS.passed} label="Passed" />
            <LegendSwatch color={REWORK_YIELD_COLORS.failed} label="Failed" />
            <LegendSwatch color={REWORK_YIELD_COLORS.fpy} label="FPY %" line />
            {yieldData.target_yield_pct !== null && (
              <LegendSwatch color={REWORK_YIELD_COLORS.target} label="Target" dashed />
            )}
            <LegendSwatch color={REWORK_YIELD_COLORS.belowTarget} label="Under target" dot />
          </div>
          <div className="text-[10px] text-ink-dim leading-snug mt-1">
            FPY = (tested − failed) / tested for the week. A week with nothing
            tested leaves a gap in the line.
          </div>
        </>
      )}
    </section>
  );

  return (
    <div
      className="flex-1 overflow-auto px-6 pt-3 pb-4 space-y-3"
      style={{ backgroundColor: REWORK_SURFACE.background }}
    >
      {/* ---- period, shift --------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[14px] font-black text-white uppercase tracking-wider truncate">
            {head?.product_name ?? item}
            <span className="ml-1.5 text-[11px] font-mono font-bold text-ink-dim normal-case">({item})</span>
          </span>
          <ReworkPeriodTitle period={period} />
        </div>
        <ReworkPeriodControls
          scope={scope}
          onScopeChange={setScope}
          period={period}
          loading={loading}
          rejected={tooFarBack}
        />
      </div>

      {/* A 400 keeps the last good period on screen — the hook holds the old
          body — and says why the step did not happen. */}
      {(category.state === "error" || failureId.state === "error") && (
        <div className="text-[11px] font-bold text-warning">
          {category.error ?? failureId.error}
        </div>
      )}

      {noFailures ? (
        <>
          <div className="py-10 text-center text-[12px] font-bold text-ink-dim">
            No failures in this period.
          </div>
          {yieldCard}
        </>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* ---- defect category ---------------------------------------- */}
          <section className="border border-line rounded-lg px-4 pt-3 pb-3 min-w-0" style={CARD_STYLE}>
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
                <ServerParetoChart bars={categoryBars(category.data)} valueLabel="Units" labelChars={12} colors={REWORK_PARETO_COLORS} />
                <div className="text-[10px] text-ink-dim leading-snug mt-1">
                  Each failed unit is counted once, under the category of its first
                  rework disposition. The line is the cumulative share.
                </div>
              </>
            )}
          </section>

          {/* ---- failure id --------------------------------------------- */}
          <section className="border border-line rounded-lg px-4 pt-3 pb-3 min-w-0" style={CARD_STYLE}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
                Failure id
              </span>
              <div className="flex items-center gap-2">
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
                {fmt(failureId.data.totals.failed_units ?? failureId.data.totals.events)} failed units across{" "}
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
              <ServerParetoChart bars={failureIdBars(failureId.data)} valueLabel="Units" labelChars={14} colors={REWORK_PARETO_COLORS} />
            )}
          </section>

          {/* ---- yield trend (3.8) + defect category trend (3.5) ---------- */}
          {/* Week and Month only: a single day has nothing to stack, and both
              endpoints refuse it. Side by side, on the same weeks. */}
          {yieldCard}
          {scope.granularity !== "day" && (
            <section className="border border-line rounded-lg px-4 pt-3 pb-3 min-w-0" style={CARD_STYLE}>
              <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-1">
                Defect category by fiscal week
                {scope.granularity === "week" && period?.span_label && (
                  <span className="ml-1.5 normal-case font-bold text-ink-dim/80">· {period.span_label}</span>
                )}
              </div>
              {trend.state === "error" ? (
                <div className="py-10 text-center text-[11px] font-bold text-warning">{trend.error}</div>
              ) : !trendView ? (
                <div className="py-16 text-center text-[11px] font-bold text-ink-dim">
                  Loading category trend…
                </div>
              ) : (
                <>
                  <StackedBarChart
                    categories={trendView.categories}
                    series={trendView.series}
                    height={260}
                    yLabel="Units"
                    maxCategories={31}
                    maxLabelChars={10}
                    emptyLabel="No dispositioned failures to stack in this period."
                    surfaceColor={REWORK_SURFACE.panel}
                  />
                  <div className="text-[10px] text-ink-dim leading-snug mt-2">
                    Units per rework category per fiscal week, biggest at the bottom.
                    Each unit sits in one stack (its first disposition), so a bar is
                    that week&apos;s dispositioned units. The current week is
                    drawn while still in progress; a week with nothing stays on the
                    axis, empty.
                  </div>
                </>
              )}
            </section>
          )}
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

const LegendSwatch = ({
  color,
  label,
  line,
  dashed,
  dot,
}: {
  color: string;
  label: string;
  line?: boolean;
  dashed?: boolean;
  dot?: boolean;
}) => (
  <span className="inline-flex items-center gap-1.5">
    {dot ? (
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
    ) : line || dashed ? (
      <span
        className="w-3.5 h-0 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
      />
    ) : (
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
    )}
    {label}
  </span>
);
