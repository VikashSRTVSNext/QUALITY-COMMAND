import { useMemo, useState } from "react";
import RankedBarChart from "../charts/RankedBarChart.lazy";
import type { RankedBar } from "../charts/RankedBarChart";
import StackedBarChart from "../charts/StackedBarChart.lazy";
import ParetoChart from "../charts/ParetoChart.lazy";
import type { BarCategory, BarSeries } from "../charts/StackedBarChart";
import { MAX_SERIES, OTHER_COLOR, seriesColor } from "../charts/seriesPalette";
import type { NcLogRow, ProductDefectsQuery } from "./useProductDefects";
import type { ChartView } from "./ChartViewToggle";
import { defectDateBars } from "./defectDateBars";
import { productionDayOf, shortDay } from "./dashboardFilters";

/** What goes on the x-axis. */
type Dimension = "failure" | "nc" | "cause" | "date";

const DIMENSIONS: { key: Dimension; label: string; hint: string }[] = [
  {
    key: "failure",
    label: "Failure ID",
    hint: "WHAT failed — the identifier on the failure record itself",
  },
  {
    key: "nc",
    label: "NC code",
    hint: "What was DONE about it — the NC code and its description (Retest, component replaced…)",
  },
  {
    key: "cause",
    label: "Cause",
    hint: "What the failure was dispositioned as — FCR, SMT, SQA…",
  },
  {
    key: "date",
    label: "Date",
    hint: "WHEN it failed — one bar per production day (06:15 to 06:15). Offered once the window holds more than one day",
  },
];

const OTHER_SERIES = "__other_tester__";
const NO_DATE = "__no_date__";


const NO_CAUSE = "__no_cause__";
const NO_FAILURE_ID = "__no_failure_id__";

type Props = {
  query: ProductDefectsQuery;
  /** Opens the NC log, same signature as everywhere else in the drill-down. */
  onDrill: (resource: string | null, category: string | null) => void;
  /** Owned by the modal, because its toggle is one control for the whole
   *  drill-down rather than one per chart. */
  view?: ChartView;
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
export const FailedStepChart = ({
  query,
  onDrill,
  view = "bars",
}: Props) => {
  // Failure ID by default. The NC code and its description say what the operator
  // DID ("Retest (False failure)"), which is the answer to a different question
  // and made the bars read as a list of actions rather than of failures.
  const [dimensionChoice, setDimensionChoice] =
    useState<Dimension>("failure");
  const { data, state, error } = query;

  /**
   * Distinct production days present in the log.
   *
   * Its own memo, keyed on the DATA only. The big one below is keyed on the
   * dimension too, and the count has to be known before the dimension is
   * resolved — it is what decides whether "Date" is a legal choice at all.
   */
  const dayCount = useMemo(() => {
    const days = new Set<string>();
    for (const r of data?.nc_log ?? []) {
      // Carried-over rows are excluded here exactly as they are everywhere else
      // at this level, so the day count matches the bars it gates.
      if (!r.first_pass_unit) continue;
      const day = productionDayOf(r.date_time);
      if (day) days.add(day);
    }
    return days.size;
  }, [data]);

  // Derived, not stored: a log that narrows to one day must not leave the chart
  // on a dimension its own selector no longer lists.
  const dimension: Dimension =
    dimensionChoice === "date" && dayCount <= 1 ? "failure" : dimensionChoice;
  const setDimension = setDimensionChoice;

  const { categories, series, testerBars, excluded } = useMemo(() => {
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

    const keyOf = (r: NcLogRow) => {
      if (dimension === "failure") return r.failure_id ?? NO_FAILURE_ID;
      if (dimension === "nc") return r.nc ?? "—";
      // ISO, so the chronological sort below is a plain string compare.
      if (dimension === "date") return productionDayOf(r.date_time) ?? NO_DATE;
      return r.category ?? NO_CAUSE;
    };
    const labelOf = (r: NcLogRow) => {
      if (dimension === "failure") return r.failure_id ?? "No failure ID";
      // The CODE, not its description. The description is a sentence ("Soldering
      // defect repaired") that the axis has to truncate to nothing useful, while
      // the code is two characters and is what the floor actually says out loud.
      // The description moves to the tooltip, where it has room to be read.
      if (dimension === "nc") return r.nc || r.nc_description || "—";
      if (dimension === "date") {
        const day = productionDayOf(r.date_time);
        return day ? shortDay(day) : "No date";
      }
      return r.category ?? "No category yet";
    };

    const acc = new Map<
      string,
      {
        label: string;
        values: Record<string, number>;
        units: Set<string>;
        /** What was DONE about this failure. Collected so the Failure ID view
         *  keeps the disposition a hover away instead of losing it. */
        actions: Set<string>;
      }
    >();
    for (const r of own) {
      const key = keyOf(r);
      let bucket = acc.get(key);
      if (!bucket) {
        bucket = {
          label: labelOf(r),
          values: {},
          units: new Set(),
          actions: new Set(),
        };
        acc.set(key, bucket);
      }
      const sk = seriesKeyFor(r.resource ?? "—");
      bucket.values[sk] = (bucket.values[sk] ?? 0) + 1;
      bucket.units.add(r.sfc);
      const action = r.nc_description || r.comment;
      if (action) bucket.actions.add(action);
    }

    const categories: BarCategory[] = [...acc.entries()]
      .map(([key, b]) => {
        // Two at most, then a count: a bar covering nine different dispositions
        // should say so, not print all nine into the tooltip.
        const actions = [...b.actions];
        const actionText =
          actions.length === 0
            ? ""
            : actions.length <= 2
              ? ` · ${actions.join(", ")}`
              : ` · ${actions.slice(0, 2).join(", ")} +${actions.length - 2} more`;

        return {
          key,
          label: b.label,
          values: b.values,
          hint:
            `${b.units.size} distinct unit(s)` +
            // Both of these axes show a short identifier, so the human-readable
            // description belongs in the tooltip for each.
            (dimension === "failure" || dimension === "nc" ? actionText : ""),
        };
      })
      // Pareto order, EXCEPT for dates.
      //
      // Time is an ordered dimension: ranking days biggest-first throws away the
      // one thing the date view is for, which is whether the failures are a
      // spike on one shift or a level that never came down. The Pareto view
      // re-sorts its own copy descending, so both readings stay available —
      // chronological in the bars, ranked under the curve.
      .sort((a, b) =>
        dimension === "date"
          ? a.key.localeCompare(b.key)
          : Object.values(b.values).reduce((x, y) => x + y, 0) -
            Object.values(a.values).reduce((x, y) => x + y, 0),
      );

    // The same testers, the same colours, ranked by how much they contributed.
    // Sharing the palette is what lets this list double as the stacked chart's
    // legend instead of repeating it.
    const unitsByTester = new Map<string, Set<string>>();
    for (const r of own) {
      const t = r.resource ?? "—";
      if (!unitsByTester.has(t)) unitsByTester.set(t, new Set());
      unitsByTester.get(t)!.add(r.sfc);
    }
    const testerBars: RankedBar[] = ranked.map((t, i) => ({
      key: t,
      label: t,
      value: byTester.get(t) ?? 0,
      // Rank in the FULL ordering, so a tester keeps its colour no matter how
      // many are on screen.
      color: seriesKeyFor(t) === t ? seriesColor(i) : OTHER_COLOR,
      hint: `${unitsByTester.get(t)?.size ?? 0} distinct unit(s) — open this tester's NC log`,
    }));

    return {
      categories,
      series,
      testerBars,
      excluded: rows.length - own.length,
    };
  }, [data, dimension]);

  /**
   * One bar per production day, for the Pareto.
   *
   * Independent of `dimension` on purpose: the Pareto answers one question —
   * which DAYS carry the failures — while the dimension selector belongs to the
   * bars. Keeping the two apart is what lets the bars stay a category
   * breakdown split by tester without the Pareto having to be single-series
   * over the same axis.
   */
  const dateBars: RankedBar[] = useMemo(
    () =>
      defectDateBars(
        (data?.nc_log ?? []).filter((r) => r.first_pass_unit),
        (r) => r.date_time,
      ),
    [data],
  );

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
          {view === "pareto"
            ? "Failures by date"
            : `Failures by ${label?.label.toLowerCase()}, split by tester`}
        </span>
        {/* The dimension selector belongs to the bars. The Pareto is one
            question — which days carry the failures — so a selector there would
            offer choices it does not honour. */}
        {view !== "pareto" && (
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
        )}
      </div>

      {view === "pareto" ? (
        <ParetoChart
          bars={dateBars}
          unit="events"
          maxBars={12}
          height={300}
          labelChars={12}
          noun={{ one: "day", many: "days" }}
          emptyLabel="No failure events recorded for this product in this window."
        />
      ) : (
      <>
      <div className="flex flex-col xl:flex-row gap-5 xl:gap-7">
      <div className="flex-1 min-w-0">
      <StackedBarChart
        categories={categories}
        series={series}
        height={280}
        yLabel="Failure events"
        emptyLabel="No failure events recorded for this product on this day."
        // The tester panel beside it names every series with its colour, so a
        // second legend here would only repeat it.
        showLegend={false}
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
      </div>

      {/* Beside the stacked chart rather than behind another toggle: "which
          failure" and "which machine" are one glance, and comparing them should
          not cost a mode switch. Shared colours make it the legend too. */}
      <div className="xl:w-[300px] flex-shrink-0 xl:border-l xl:border-line/60 xl:pl-6">
        <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
          Defects by tester
        </div>
        <RankedBarChart
          bars={testerBars}
          rowHeight={26}
          labelWidth={108}
          emptyLabel="No failures to attribute."
          onBarClick={(resource) => onDrill(resource, null)}
        />
        <div className="text-[10px] text-ink-dim/80 leading-snug mt-2">
          Failure events per tester, ranked. Same colours as the chart. Click a
          bar for that tester&apos;s NC log.
        </div>
      </div>
      </div>
      </>
      )}

      {/* Bars only. The Pareto is one chart with one caption under it, and a
          paragraph explaining a picture that explains itself is the clutter
          this view exists to avoid. */}
      {view !== "pareto" && (
        <div className="text-[10px] text-ink-dim leading-relaxed mt-3">
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
          {dimension === "failure" && (
            <>
              {" "}
              Bars are failure IDs — what failed. The disposition (what was done
              about it) is in each tooltip.
            </>
          )}
          {dimension === "nc" && (
            <>
              {" "}
              NC codes describe the ACTION taken, not the failure — switch to
              Failure ID for what actually failed.
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FailedStepChart;
