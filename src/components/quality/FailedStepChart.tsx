import { useMemo, useState } from "react";
import StackedBarChart from "../charts/StackedBarChart.lazy";
import type { BarCategory, BarSeries } from "../charts/StackedBarChart";
import { MAX_SERIES, OTHER_COLOR, seriesColor } from "../charts/seriesPalette";
import type { NcLogRow, ProductDefectsQuery } from "./useProductDefects";

/** What goes on the x-axis. */
type Dimension = "nc" | "cause";

const DIMENSIONS: { key: Dimension; label: string; hint: string }[] = [
  {
    key: "nc",
    label: "NC code",
    hint: "What the failure was recorded as — the closest thing we hold to a failed test step",
  },
  {
    key: "cause",
    label: "Cause",
    hint: "What the failure was dispositioned as — FCR, SMT, SQA…",
  },
];

const OTHER_SERIES = "__other_tester__";
const NO_CAUSE = "__no_cause__";

type Props = {
  query: ProductDefectsQuery;
  /** Opens the NC log, same signature as everywhere else in the drill-down. */
  onDrill: (resource: string | null, category: string | null) => void;
};

/**
 * Failures by NC code (or cause), split by the tester they happened on.
 *
 * The Pareto view of the same day the tester table describes: which failure
 * dominates, and whether it is spread across the line or concentrated on one
 * machine. A table answers the first question and buries the second.
 *
 * Counts EVENTS, not distinct units, and the y-axis says so. Events are additive
 * — a unit that failed on two testers contributes one event to each — so the
 * segments of a bar sum to its total exactly. Distinct units do not have that
 * property across testers (the same double-count the tester table warns about),
 * and a stacked bar whose parts overflow its whole is a broken chart. The
 * distinct-unit figure is in the tooltip, where it can be stated rather than
 * implied by a bar height.
 *
 * Carried-over rows are excluded, matching every other figure at this level:
 * they are today's rework on an earlier day's failures, and belong to that day's
 * yield.
 */
export const FailedStepChart = ({ query, onDrill }: Props) => {
  const [dimension, setDimension] = useState<Dimension>("nc");
  const { data, state, error } = query;

  const { categories, series, excluded } = useMemo(() => {
    const rows: NcLogRow[] = data?.nc_log ?? [];
    const own = rows.filter((r) => r.first_pass_unit);

    // Series order is fixed by each tester's TOTAL across the whole log, not by
    // the current dimension — so switching the x-axis never repaints a tester.
    const byTester = new Map<string, number>();
    for (const r of own) {
      const t = r.resource ?? "—";
      byTester.set(t, (byTester.get(t) ?? 0) + 1);
    }
    const ranked = [...byTester.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    // Past the palette's slots, testers fold into one "Other" series. Cycling
    // the hues instead would give two machines the same colour, which is worse
    // than not naming the ninth.
    const head = ranked.slice(0, MAX_SERIES);
    const seriesKeyFor = (t: string) => (head.includes(t) ? t : OTHER_SERIES);

    const series: BarSeries[] = head.map((t, i) => ({
      key: t,
      label: t,
      color: seriesColor(i),
    }));
    if (ranked.length > head.length) {
      series.push({
        key: OTHER_SERIES,
        label: `Other (${ranked.length - head.length})`,
        color: OTHER_COLOR,
      });
    }

    const keyOf = (r: NcLogRow) =>
      dimension === "nc" ? (r.nc ?? "—") : (r.category ?? NO_CAUSE);
    const labelOf = (r: NcLogRow) =>
      dimension === "nc"
        ? (r.nc_description || r.nc || "—")
        : (r.category ?? "No category yet");

    const acc = new Map<
      string,
      { label: string; values: Record<string, number>; units: Set<string> }
    >();
    for (const r of own) {
      const key = keyOf(r);
      let bucket = acc.get(key);
      if (!bucket) {
        bucket = { label: labelOf(r), values: {}, units: new Set() };
        acc.set(key, bucket);
      }
      const sk = seriesKeyFor(r.resource ?? "—");
      bucket.values[sk] = (bucket.values[sk] ?? 0) + 1;
      bucket.units.add(r.sfc);
    }

    const categories: BarCategory[] = [...acc.entries()]
      .map(([key, b]) => ({
        key,
        label: b.label,
        values: b.values,
        hint:
          `${b.units.size} distinct unit(s)` +
          (dimension === "nc" && key !== b.label ? ` · code ${key}` : ""),
      }))
      // Pareto order. The chart does not re-sort, so this is the sort.
      .sort(
        (a, b) =>
          Object.values(b.values).reduce((x, y) => x + y, 0) -
          Object.values(a.values).reduce((x, y) => x + y, 0),
      );

    return { categories, series, excluded: rows.length - own.length };
  }, [data, dimension]);

  // "idle" is the beat between flipping to this view and the request starting.
  // Falling through would blank the panel for a frame.
  if (state === "loading" || state === "idle") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
        Loading failure breakdown…
      </div>
    );
  }
  if (state === "unsupported" || state === "error") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-warning">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const label = DIMENSIONS.find((d) => d.key === dimension);

  return (
    <div className="flex-1 overflow-auto px-6 pt-3 pb-4">
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
          Failures by {label?.label.toLowerCase()}, split by tester
        </span>
        <div className="flex items-center gap-1">
          {DIMENSIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDimension(d.key)}
              title={d.hint}
              className={`border text-[9.5px] font-bold px-2 py-0.5 rounded uppercase transition-colors cursor-pointer ${
                dimension === d.key
                  ? "bg-tab-active text-white border-tab-border/50"
                  : "bg-page text-ink-dim border-line hover:bg-line"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <StackedBarChart
        categories={categories}
        series={series}
        height={280}
        yLabel="Failure events"
        emptyLabel="No failure events recorded for this product on this day."
        onSegmentClick={(categoryKey, seriesKey) => {
          // A segment carries both facts, so both are used. The "Other" tester
          // bucket and the "Other" category bar each drop their half rather than
          // opening a log filtered to something the server cannot express.
          const resource = seriesKey === OTHER_SERIES ? null : seriesKey;
          // Only the cause dimension maps onto a filter the endpoint accepts —
          // there is no per-NC-code filter, so an NC bar drills by tester alone.
          const category =
            dimension === "cause" &&
            categoryKey !== NO_CAUSE &&
            categoryKey !== "__other__"
              ? categoryKey
              : null;
          onDrill(resource, category);
        }}
      />

      <div className="text-[10px] text-ink-dim leading-relaxed mt-2">
        One bar per {label?.label.toLowerCase()}, stacked by the tester the
        failure happened on. Counts failure EVENTS, so a unit that failed twice
        counts twice — the distinct-unit figure is in each tooltip.
        {excluded > 0 && (
          <>
            {" "}
            {excluded} row(s) carried over from an earlier day are excluded, as
            they are everywhere else at this level.
          </>
        )}
        {dimension === "nc" && (
          <>
            {" "}
            NC code is the nearest thing this feed holds to the failed test step;
            the test-step name itself is not in the payload yet.
          </>
        )}
      </div>
    </div>
  );
};

export default FailedStepChart;
