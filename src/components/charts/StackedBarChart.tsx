import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { palette } from "../../theme/palette";
import { OTHER_COLOR } from "./seriesPalette";

export type BarSeries = {
  key: string;
  label: string;
  color: string;
};

export type BarCategory = {
  /** Identity. Also the tick label's lookup key. */
  key: string;
  /** X-axis tick text. Truncated on the axis, never in the tooltip. */
  label: string;
  /** series key -> value. Missing keys count as zero. */
  values: Record<string, number>;
  /** Extra line in the tooltip — the full name, a description. */
  hint?: string;
};

export type StackedBarChartProps = {
  categories: BarCategory[];
  series: BarSeries[];
  height?: number;
  /** Suffix on every count, e.g. "u". */
  unit?: string;
  /** Y-axis title. Name the unit here so no bar has to. */
  yLabel?: string;
  /** Categories past this many are folded into one "Other" bar rather than
   *  squeezed onto the axis. */
  maxCategories?: number;
  /** Longest tick before it is truncated with an ellipsis. */
  maxLabelChars?: number;
  emptyLabel?: string;
  className?: string;
  /** Turn off ONLY when something else on screen names every series with its
   *  colour — a ranked list of the same entities, say. Identity must never rest
   *  on colour alone, so there has to be a legend somewhere. */
  showLegend?: boolean;
  /** Fires with the clicked SEGMENT, not just the bar it sits in — a stacked bar
   *  carries two facts (which category, which series) and throwing the second
   *  one away is what makes most stacked charts a dead end. */
  onSegmentClick?: (categoryKey: string, seriesKey: string) => void;
};

const AXIS_TICK = {
  fill: palette.inkDim,
  fontSize: 9.5,
  fontWeight: 700,
};

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

/**
 * Vertical stacked bars — a count broken down along one dimension and split by
 * one series.
 *
 * The Pareto question: what fails most, and who it happens on. Categories arrive
 * pre-sorted by the caller; this component does not reorder them, because the
 * sort is usually part of the answer.
 *
 * Deliberate choices worth not undoing:
 *
 *   - ONE axis. Never add a second y-scale for a rate alongside these counts —
 *     two scales on one plot can be made to tell any story, including the wrong
 *     one. A rate belongs in its own chart.
 *   - Series colours come from the caller (`seriesPalette`), assigned by the
 *     series' STABLE rank. Filtering the categories must never repaint a series,
 *     so the colour cannot depend on what is currently on screen.
 *   - Only the total is direct-labelled, on top of each bar. Labelling every
 *     segment turns a chart back into a table; labelling the total is what stops
 *     a reader having to measure against the axis.
 *   - Segments are separated by a 2px surface-coloured stroke rather than left
 *     flush, so two adjacent hues never read as one block.
 */
export const StackedBarChart = ({
  categories,
  series,
  height = 260,
  unit = "",
  yLabel,
  maxCategories = 12,
  maxLabelChars = 22,
  emptyLabel = "Nothing to chart",
  className = "",
  showLegend = true,
  onSegmentClick,
}: StackedBarChartProps) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const { rows, shown, folded } = useMemo(() => {
    const head = categories.slice(0, maxCategories);
    const tail = categories.slice(maxCategories);

    const toRow = (c: BarCategory) => ({
      key: c.key,
      label: truncate(c.label, maxLabelChars),
      fullLabel: c.label,
      hint: c.hint,
      total: series.reduce((acc, s) => acc + (c.values[s.key] ?? 0), 0),
      // Which series ends up on top of THIS bar. Recharts stacks in series
      // order, so it is the last one with a value — and it differs per bar,
      // which is why the total cannot simply hang off the last <Bar>.
      __topKey:
        [...series].reverse().find((s) => (c.values[s.key] ?? 0) > 0)?.key ??
        null,
      ...Object.fromEntries(series.map((s) => [s.key, c.values[s.key] ?? 0])),
    });

    const rows = head.map(toRow);

    // The tail is summed rather than dropped: a chart that silently omits bars
    // understates the total a reader is about to compare against.
    if (tail.length > 0) {
      const merged: Record<string, number> = {};
      for (const c of tail) {
        for (const s of series) {
          merged[s.key] = (merged[s.key] ?? 0) + (c.values[s.key] ?? 0);
        }
      }
      rows.push(
        toRow({
          key: "__other__",
          label: `Other (${tail.length})`,
          values: merged,
          hint: `${tail.length} more, each smaller than the bars shown`,
        }),
      );
    }

    return { rows, shown: head.length, folded: tail.length };
  }, [categories, series, maxCategories, maxLabelChars]);

  if (rows.length === 0 || series.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-[11px] font-bold text-ink-dim ${className}`}
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    // Descending, and zero-value series omitted: a stacked tooltip that lists
    // every series including the absent ones is the thing people stop reading.
    const parts = series
      .map((s) => ({ ...s, value: row[s.key] as number }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    return (
      <div className="bg-panel border border-line-soft rounded-lg px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] max-w-[320px]">
        <div className="text-[11px] font-black text-white leading-snug break-words">
          {row.fullLabel}
        </div>
        {row.hint && (
          <div className="text-[10px] text-ink-dim leading-snug mt-0.5">
            {row.hint}
          </div>
        )}
        <div className="mt-1.5 pt-1.5 border-t border-line/60 space-y-0.5">
          {parts.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-2 text-[10px] whitespace-nowrap"
            >
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-ink-muted font-mono">{s.label}</span>
              <span className="ml-auto font-mono font-bold text-white tabular-nums">
                {s.value}
                {unit}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-[10px] pt-1 mt-1 border-t border-line/60">
            <span className="text-ink-dim font-black uppercase tracking-wider">
              Total
            </span>
            <span className="ml-auto font-mono font-black text-white tabular-nums">
              {row.total}
              {unit}
            </span>
          </div>
        </div>
        {onSegmentClick && (
          <div className="text-[9.5px] text-ink-dim/80 mt-1.5">
            Click a segment to open that tester&apos;s log
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          margin={{ top: 18, right: 8, bottom: 64, left: 8 }}
          barCategoryGap="22%"
        >
          {/* Horizontal only, and dashed: the grid is for reading a value off
              the axis, not a feature of the data. */}
          <CartesianGrid
            vertical={false}
            stroke={palette.line}
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={64}
            tickLine={false}
            axisLine={{ stroke: palette.line }}
          />
          <YAxis
            tick={AXIS_TICK}
            allowDecimals={false}
            width={44}
            tickLine={false}
            axisLine={false}
            label={
              yLabel
                ? {
                    value: yLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: {
                      fill: palette.inkDim,
                      fontSize: 9.5,
                      fontWeight: 700,
                      textAnchor: "middle",
                    },
                  }
                : undefined
            }
          />
          <Tooltip
            cursor={{ fill: palette.white, fillOpacity: 0.04 }}
            isAnimationActive={false}
            wrapperStyle={{ outline: "none", zIndex: 60 }}
            content={renderTooltip}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="stack"
              fill={s.color}
              fillOpacity={hovered && hovered !== s.key ? 0.25 : 1}
              // The 2px surface-coloured separator between stacked segments.
              stroke={palette.panel}
              strokeWidth={2}
              isAnimationActive={false}
              cursor={onSegmentClick ? "pointer" : "default"}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={(_: unknown, index: number) => {
                const row = rows[index];
                if (row) onSegmentClick?.(row.key, s.key);
              }}
              // Only the topmost segment is rounded, so the stack reads as one
              // bar with a 4px cap rather than a pile of lozenges.
              radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            >
              {/* Every Bar carries the label, and each one draws it only for
                  the rows where IT is the topmost segment — so exactly one
                  label lands on each bar, at the top of the stack. Hanging it
                  off the last <Bar> instead silently skipped any bar whose
                  last series happened to be zero. */}
              <LabelList
                dataKey="total"
                content={(props: any) => {
                  const { index, x, y, width, value } = props;
                  if (
                    typeof index !== "number" ||
                    rows[index]?.__topKey !== s.key ||
                    typeof x !== "number" ||
                    typeof y !== "number" ||
                    typeof width !== "number"
                  ) {
                    return null;
                  }
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fill={palette.inkMuted}
                      fontSize={9.5}
                      fontWeight={700}
                    >
                      {value}
                    </text>
                  );
                }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Present whenever nothing else on screen carries the series names, and
          never the only carrier of identity — the tooltip names every segment
          too. */}
      {showLegend && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(s.key)}
            onBlur={() => setHovered(null)}
            className="flex items-center gap-1.5 text-[10px] whitespace-nowrap text-ink-muted hover:text-white rounded px-1 -mx-1 transition-opacity focus-visible:outline focus-visible:outline-1"
            style={{ opacity: hovered && hovered !== s.key ? 0.4 : 1 }}
            title={`Highlight ${s.label}`}
          >
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="font-mono font-bold">{s.label}</span>
          </button>
        ))}
        {folded > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] text-ink-dim">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: OTHER_COLOR }}
            />
            {shown} shown, {folded} folded into Other
          </span>
        )}
      </div>
      )}
    </div>
  );
};

export default StackedBarChart;
