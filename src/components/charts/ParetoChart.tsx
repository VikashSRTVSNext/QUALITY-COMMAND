import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { palette } from "../../theme/palette";
import { OTHER_COLOR } from "./seriesPalette";
import type { RankedBar } from "./RankedBarChart";

/** Where the "vital few" stop. The conventional Pareto cutoff. */
const CUTOFF_PCT = 80;

export type ParetoChartProps = {
  /** The same bars RankedBarChart takes. Re-sorted here: a Pareto is defined by
   *  its descending order, so it cannot inherit the caller's. */
  bars: RankedBar[];
  unit?: string;
  /** Categories past this many fold into one "Other" bar. The CURVE still counts
   *  them — see the note below. */
  maxBars?: number;
  height?: number;
  /**
   * Characters kept on an axis label before it is elided.
   *
   * A prop rather than a measurement because the component cannot see its own
   * width: the narrow side-by-side cuts need 7, and a full-width chart has room
   * for twice that. Getting it wrong is not cosmetic — three failure IDs that
   * share a prefix all render as the SAME tick, and a chart with two
   * indistinguishable bars is worse than one with none.
   */
  labelChars?: number;
  /** What the bars ARE, for the caption. "4 of 6 days" reads as the finding;
   *  "4 of 6 categories" makes the reader translate it back. */
  noun?: { one: string; many: string };
  emptyLabel?: string;
};

type Row = {
  key: string;
  label: string;
  value: number;
  /** Running share of the grand total, after this category. */
  cumulative: number;
  /** Inside the vital few — this category is at or before the 80% crossing. */
  vital: boolean;
  isOther: boolean;
};

/** "D141000" -> "D1410…" so a narrow column's axis stays one line. */
const truncate = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

/**
 * Build the Pareto rows.
 *
 * TWO THINGS THAT ARE EASY TO GET WRONG, and are the reason this is not just a
 * sorted bar list:
 *
 * 1. The cumulative percentage is computed over EVERY category, including the
 *    ones folded into "Other". Folding first and then accumulating would end the
 *    curve at whatever the visible bars happened to sum to, and a Pareto whose
 *    curve stops at 64% is not reporting a tail — it is misreporting the whole.
 *
 * 2. The cutoff is read off the CROSSING, not off a bar count. "The top 3" is a
 *    guess; "the categories that together make 80%" is the actual claim a Pareto
 *    makes, and it can be one category or eleven. The category that carries the
 *    curve THROUGH 80% is included — dropping it would leave the highlighted set
 *    summing to less than 80%.
 */
const buildParetoRows = (
  bars: RankedBar[],
  maxBars: number,
): { rows: Row[]; total: number; vitalCount: number } => {
  const ranked = [...bars].sort((a, b) => b.value - a.value);
  const total = ranked.reduce((sum, b) => sum + (b.value || 0), 0);

  // Cumulative over the FULL list, before any folding.
  let running = 0;
  const withCumulative = ranked.map((b) => {
    running += b.value || 0;
    return {
      ...b,
      cumulative: total > 0 ? (100 * running) / total : 0,
    };
  });

  const vitalCount =
    total > 0
      ? Math.max(
          1,
          withCumulative.findIndex((b) => b.cumulative >= CUTOFF_PCT) + 1,
        )
      : 0;

  const head = withCumulative.slice(0, maxBars);
  const tail = withCumulative.slice(maxBars);

  const rows: Row[] = head.map((b, i) => ({
    key: b.key,
    label: b.label,
    value: b.value,
    cumulative: b.cumulative,
    vital: i < vitalCount,
    isOther: false,
  }));

  if (tail.length > 0) {
    rows.push({
      key: "__pareto_other__",
      label: `Other (${tail.length})`,
      value: tail.reduce((sum, b) => sum + (b.value || 0), 0),
      // The last category's running total IS 100% by construction, which is what
      // closes the curve.
      cumulative: 100,
      vital: false,
      isOther: true,
    });
  }

  return { rows, total, vitalCount };
};

/**
 * A defect Pareto — ranked bars with the cumulative share drawn over them.
 *
 * The question it answers that a ranked bar list does not: HOW MUCH OF THE
 * PROBLEM a given set of categories accounts for. A ranked list says B99 is the
 * biggest; a Pareto says B99 and A2 are two thirds of everything, so fixing the
 * rest first is motion without progress.
 *
 * Vertical, unlike RankedBarChart. Bars are read left to right against a curve
 * that only rises, and that reading is the whole point — laid out horizontally
 * the curve runs top-to-bottom and stops looking like the thing every quality
 * engineer already knows how to read.
 *
 * The labels pay for that: they are truncated to fit rather than given the full
 * width a horizontal list would allow. The tooltip carries the full name, which
 * is the right trade here because the axis is a lookup and the shape is the
 * message.
 */
export const ParetoChart = ({
  bars,
  unit = "",
  maxBars = 8,
  height = 190,
  labelChars = 7,
  noun = { one: "category", many: "categories" },
  emptyLabel = "Nothing to rank.",
}: ParetoChartProps) => {
  const { rows, total, vitalCount } = buildParetoRows(bars, maxBars);

  // Long labels are tilted rather than shortened further. Eleven horizontal
  // ticks of real identifiers either overlap or truncate to the point where two
  // different failure IDs render as the same text — which is the one thing an
  // axis must never do. Tied to labelChars so there is a single knob: a caller
  // asking for long labels is telling us it has the width for them.
  const angled = labelChars > 8;

  if (rows.length === 0 || total <= 0) {
    return (
      <div className="flex items-center justify-center text-[10.5px] font-bold text-ink-dim" style={{ height }}>
        {emptyLabel}
      </div>
    );
  }

  // One category IS 100% of itself. The curve would be a flat line at the top
  // and the cutoff meaningless, so the chart says so in words instead of drawing
  // a Pareto that cannot be wrong.
  const degenerate = rows.length === 1;

  return (
    <div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <ComposedChart
            data={rows}
            margin={{ top: 14, right: 34, bottom: angled ? 0 : 4, left: -6 }}
          >
            <XAxis
              dataKey="label"
              tick={{
                fill: palette.inkMuted,
                fontSize: 8.5,
                ...(angled ? { angle: -32, textAnchor: "end" as const } : {}),
              }}
              // By index, so the fold bar keeps its full name. "Other (8)" cut
              // to "Other …" loses the one number that says how much is hiding
              // in it, and it is the bar most likely to be asked about.
              tickFormatter={(v: string, i: number) =>
                rows[i]?.isOther ? String(v) : truncate(String(v), labelChars)
              }
              interval={0}
              axisLine={{ stroke: palette.line }}
              tickLine={false}
              height={angled ? 52 : 16}
            />
            {/* Counts on the left, share on the right. The right axis is pinned
                to 0-100 so the curve's height means the same thing in every cut
                -- fitted to the data it would look identical whether one
                category carried 40% or 95%. */}
            <YAxis
              yAxisId="count"
              // These are counts of defects. Half a defect is not a reading, and
              // a chart topping out at 1 would otherwise tick 0.25, 0.5, 0.75.
              allowDecimals={false}
              tick={{ fill: palette.inkMuted, fontSize: 8.5 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 50, 80, 100]}
              tick={{ fill: palette.inkMuted, fontSize: 8.5 }}
              tickFormatter={(v: number) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            {!degenerate && (
              <ReferenceLine
                yAxisId="pct"
                y={CUTOFF_PCT}
                stroke={palette.warning}
                strokeDasharray="3 3"
                strokeOpacity={0.65}
              />
            )}
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{
                background: palette.panel,
                border: `1px solid ${palette.lineStrong}`,
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: palette.white, fontWeight: 700 }}
              // Both rows get a legible colour explicitly.
              //
              // Recharts colours a tooltip row from its SERIES fill, and this
              // chart's bar colours live on per-bar <Cell>s -- the <Bar> itself
              // has none -- so the count row fell through to the library's
              // default grey and read as disabled text on this panel.
              itemStyle={{ color: palette.ink, fontWeight: 600 }}
              formatter={((value: unknown, name: unknown) =>
                name === "cumulative"
                  ? [`${Number(value).toFixed(1)}%`, "Cumulative"]
                  : [
                      `${Number(value).toLocaleString("en-US")}${unit ? ` ${unit}` : ""}`,
                      "Count",
                    ]) as never}
            />
            <Bar
              yAxisId="count"
              dataKey="value"
              // Capped, so one or two days do not draw slabs the width of the
              // panel. A bar's width carries no meaning here -- only its height
              // does -- and a lone full-width block reads as a bigger finding
              // than one defect is.
              maxBarSize={96}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell
                  key={r.key}
                  // The vital few carry the colour. Dimming the rest is the
                  // chart making its own point: those are the ones to leave
                  // alone for now.
                  fill={
                    r.isOther
                      ? OTHER_COLOR
                      : r.vital
                        ? palette.critical
                        : palette.accentRail
                  }
                  fillOpacity={r.vital || r.isOther ? 0.9 : 0.4}
                />
              ))}
            </Bar>
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="cumulative"
              stroke={palette.warning}
              strokeWidth={1.6}
              dot={{ r: 1.8, fill: palette.warning, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 text-[9.5px] font-bold text-ink-dim leading-snug">
        {degenerate ? (
          // No unit here on purpose: "all 1 defects" and "all 1 defect" both
          // need the count to agree with the noun, and the header above already
          // says what is being counted.
          <>All {total.toLocaleString("en-US")} on one {noun.one}.</>
        ) : (
          <>
            <span className="text-critical">
              {vitalCount} of {bars.length}
            </span>{" "}
            {vitalCount === 1 ? `${noun.one} is` : `${noun.many} are`}{" "}
            {CUTOFF_PCT}% of {total.toLocaleString("en-US")}
            {unit ? ` ${unit}` : ""}
          </>
        )}
      </div>
    </div>
  );
};

export default ParetoChart;
