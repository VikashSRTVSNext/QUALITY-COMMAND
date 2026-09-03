import { useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { isNum } from "../../core/format";
import { palette } from "../../theme/palette";

export type StripSegment = {
  /** Stable identity. Also the Recharts dataKey, so it must be unique. */
  key: string;
  /** Legend and tooltip text. */
  label: string;
  value: number;
  color: string;
  /** Drawn hatched rather than solid: the slice is part of the total but is NOT
   *  one of the things the strip breaks it down BY — a pending review, an
   *  unmapped code. Without this they read as another cause. */
  muted?: boolean;
  /** Makes the slice and its legend chip interactive. Omit for a slice with
   *  nothing to open. */
  onClick?: () => void;
  /** Second line in the tooltip — why the slice exists, or what a click opens. */
  hint?: string;
};

export type StackedBarStripProps = {
  segments: StripSegment[];
  /** The denominator. When it exceeds the segment sum, the gap is drawn as an
   *  explicit remainder rather than the slices being rescaled to fill the bar —
   *  a strip that always looks complete cannot show an incomplete breakdown,
   *  which is the normal state while a review is still in flight. Omit to let
   *  the segments define their own total. */
  total?: number | null;
  /** Label for that remainder. */
  remainderLabel?: string;
  height?: number;
  /** Suffix on every count, e.g. "u" for units. */
  unit?: string;
  showLegend?: boolean;
  /** Shown instead of the bar when nothing has a value. */
  emptyLabel?: string;
  className?: string;
  /** Describes the strip to a screen reader. Defaults to reading the slices out. */
  ariaLabel?: string;
};

const fmtPct = (v: number) => `${v.toFixed(v >= 10 ? 0 : 1)}%`;

/**
 * A single-row 100% stacked bar — one total split into its parts, in one row of
 * pixels.
 *
 * Built for "where did the N failures go?", where the alternative is scanning a
 * row of mostly-zero columns to find the one that is not. Kept generic (segments
 * in, clicks out) so any card with a part-of-whole breakdown can use it: cause
 * mix, disposition state, defect category, shift split.
 *
 * Two things it deliberately does not do:
 *
 *   - Rescale to fill itself. See `total` above.
 *   - Rely on the bar for interaction. Recharts draws plain SVG rects, which no
 *     keyboard can reach, so every clickable slice is repeated as a real
 *     <button> in the legend. The bar is the glance; the legend is the control.
 */
export const StackedBarStrip = ({
  segments,
  total,
  remainderLabel = "Unaccounted",
  height = 18,
  unit = "",
  showLegend = true,
  emptyLabel = "Nothing to break down",
  className = "",
  ariaLabel,
}: StackedBarStripProps) => {
  const [hovered, setHovered] = useState<string | null>(null);
  // Pattern ids resolve document-wide, so they must not collide with a second
  // strip on the same screen.
  const patternPrefix = useId().replace(/:/g, "");

  const { slices, denominator } = useMemo(() => {
    const present = segments.filter((s) => isNum(s.value) && s.value > 0);
    const sum = present.reduce((acc, s) => acc + s.value, 0);
    const denom = isNum(total) && total > sum ? total : sum;

    const remainder: StripSegment = {
      key: "__remainder__",
      label: remainderLabel,
      value: denom - sum,
      color: palette.unknown,
      muted: true,
    };

    return {
      slices: denom > sum ? [...present, remainder] : present,
      denominator: denom,
    };
  }, [segments, total, remainderLabel]);

  if (slices.length === 0 || denominator <= 0) {
    return (
      <div className={`text-[10px] font-bold text-ink-dim ${className}`}>
        {emptyLabel}
      </div>
    );
  }

  // One Recharts row, one field per slice: a stacked bar wants its parts as
  // sibling keys, not as rows.
  const row = slices.reduce<Record<string, number | string>>(
    (acc, s) => {
      acc[s.key] = s.value;
      return acc;
    },
    { name: "strip" },
  );

  const pctOf = (v: number) => (v / denominator) * 100;
  const radius = Math.min(4, height / 2);
  const patternId = (key: string) => `${patternPrefix}-hatch-${key}`;

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entries = payload
      .map((p: any) => slices.find((s) => s.key === p.dataKey))
      .filter(Boolean) as StripSegment[];
    if (entries.length === 0) return null;

    return (
      <div className="bg-panel border border-line-soft rounded-lg px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] max-w-[280px]">
        {entries.map((s) => (
          <div key={s.key}>
            <div className="flex items-center gap-2 text-[11px] whitespace-nowrap">
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-bold text-white">{s.label}</span>
              <span className="font-mono text-ink-muted tabular-nums ml-auto">
                {s.value}
                {unit} · {fmtPct(pctOf(s.value))}
              </span>
            </div>
            {s.hint && (
              <div className="text-[10px] text-ink-dim leading-snug mt-1">
                {s.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Paint servers resolve document-wide, so the hatch the muted slices use
          can be defined outside the chart's SVG. It cannot be defined inside:
          Recharts renders only the children it recognises, and a raw <defs> is
          not one of them. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          {slices
            .filter((s) => s.muted)
            .map((s) => (
              <pattern
                key={s.key}
                id={patternId(s.key)}
                width="6"
                height="6"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill={s.color} fillOpacity={0.22} />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke={s.color}
                  strokeWidth="3"
                  strokeOpacity={0.85}
                />
              </pattern>
            ))}
        </defs>
      </svg>

      <div
        style={{ height }}
        role="img"
        aria-label={
          ariaLabel ?? slices.map((s) => `${s.label} ${s.value}${unit}`).join(", ")
        }
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            layout="vertical"
            data={[row]}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={0}
          >
            <XAxis type="number" domain={[0, denominator]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              cursor={false}
              shared={false}
              isAnimationActive={false}
              wrapperStyle={{ outline: "none", zIndex: 60 }}
              content={renderTooltip}
            />
            {slices.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="strip"
                barSize={height}
                isAnimationActive={false}
                fill={s.muted ? `url(#${patternId(s.key)})` : s.color}
                fillOpacity={hovered && hovered !== s.key ? 0.3 : 1}
                cursor={s.onClick ? "pointer" : "default"}
                onMouseEnter={() => setHovered(s.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={s.onClick}
                radius={
                  slices.length === 1
                    ? [radius, radius, radius, radius]
                    : i === 0
                      ? [radius, 0, 0, radius]
                      : i === slices.length - 1
                        ? [0, radius, radius, 0]
                        : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          {slices.map((s) => {
            const chip = (
              <>
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: s.color, opacity: s.muted ? 0.5 : 1 }}
                />
                <span className="font-bold">{s.label}</span>
                <span className="font-mono tabular-nums text-ink-dim">
                  {s.value}
                  {unit}
                </span>
                <span className="font-mono tabular-nums text-ink-dim/70">
                  {fmtPct(pctOf(s.value))}
                </span>
              </>
            );
            const base =
              "flex items-center gap-1.5 text-[10px] whitespace-nowrap transition-opacity px-1 -mx-1";
            const dim = { opacity: hovered && hovered !== s.key ? 0.45 : 1 };

            return s.onClick ? (
              <button
                key={s.key}
                type="button"
                onClick={s.onClick}
                onMouseEnter={() => setHovered(s.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(s.key)}
                onBlur={() => setHovered(null)}
                className={`${base} text-ink-muted hover:text-white cursor-pointer rounded focus-visible:outline focus-visible:outline-1`}
                title={s.hint ?? `Open ${s.label}`}
                style={dim}
              >
                {chip}
              </button>
            ) : (
              <span
                key={s.key}
                className={`${base} text-ink-dim`}
                title={s.hint}
                style={dim}
              >
                {chip}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StackedBarStrip;
