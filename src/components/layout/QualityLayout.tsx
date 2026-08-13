import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Maximize2,
  CheckCircle2,
  ShieldCheck,
  ClipboardList,
  RotateCcw,
  Brain,
  Zap,
  UserCheck,
  Search,
  Camera,
  Scan,
  Thermometer,
  Droplets,
  Bot,
  ChevronRight,
  Bell,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  Shield,
  Leaf,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import qualityData from "../../data/qualityData.json";
import { apiUrl, DASHBOARD_SSE_URL } from "../../core/api/config";
import {
  ZONES,
  ZoneDef,
  ZoneStatus,
  STATUS_CSS,
  STATUS_LABEL,
} from "../factory/zones";
import FactoryLayoutOverlay from "../factory/FactoryLayoutOverlay";
import ProcessProductsModal, {
  DRILLDOWN_STEPS,
} from "../quality/ProcessProductsModal";

interface QualityLayoutProps {
  header?: React.ReactNode;
}

interface EriData {
  period: string;
  fiscal_year: number;
  period_code: string;
  period_num: number;
  period_start: string;
  period_end: string;
  deliveries: number;
  returns: number;
  eri_pct: number | null;
  target_pct: number | null;
  status: string;
}

// One CI gauge, fully described by the API. `max` is the arc's upper bound: the
// site's best month over the trailing year, because no target is agreed for
// either metric. `targetLabel` is empty until one is, and the card says so
// rather than showing an invented figure.
interface CiMetricView {
  value: number;
  max: number;
  centerLabel: string;
  achievedLabel: string;
  targetLabel: string;
}

const EMPTY_CI_METRIC: CiMetricView = {
  value: 0,
  max: 0,
  centerLabel: "...",
  achievedLabel: "...",
  targetLabel: "",
};

const ScrewIcon = ({
  size = 24,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    {...props}
  >
    {/* Screw head */}
    <path d="M6 3h12v3H6z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 3v3" />
    {/* Screw thread/shaft */}
    <path d="M9 6h6v12a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3V6z" />
    {/* Thread lines */}
    <path d="M9 9h6" />
    <path d="M9 12h6" />
    <path d="M9 15h6" />
  </svg>
);

const CustomSymmetricalLeafIcon = ({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Symmetrical leaf outline */}
    <path d="M12 2C12 2 5 9 5 14C5 17.5 8 20.5 12 21C16 20.5 19 17.5 19 14C19 9 12 2 12 2Z" />
    {/* Center vein */}
    <line x1="12" y1="2" x2="12" y2="21" />
    {/* Veins */}
    <path d="M12 8c-2 1-3.5 3-3.5 3" />
    <path d="M12 11c2 1 3.5 3 3.5 3" />
    <path d="M12 14c-1.5 1-2.5 2.5-2.5 2.5" />
  </svg>
);

const CustomEriIcon = ({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Center top person head & shoulders */}
    <circle cx="12" cy="7.5" r="2.5" />
    <path d="M6 16.5a6 6 0 0 1 12 0" />
    {/* Left person */}
    <circle cx="6" cy="15.5" r="1.8" />
    <path d="M2 20a4 4 0 0 1 6.5-3.3" />
    {/* Right person */}
    <circle cx="18" cy="15.5" r="1.8" />
    <path d="M15.5 16.7A4 4 0 0 1 22 20" />
  </svg>
);

const Sparkline = ({
  points,
  type,
  color,
  target,
  targetDirection,
  synthetic = false,
}: {
  // Nulls are hours the line has no value for — an hour in which nothing ran, or
  // one the day has not reached yet. They keep their slot on the x-axis so the
  // axis stays a fixed 24 (day) or 8 (shift) wide and points never shift left as
  // the day fills in.
  points: (number | null)[];
  type: string;
  // Already graded by the caller (see cardVerdict) — the line does not re-derive
  // its own verdict, so it can never contradict the tile around it.
  color: string;
  target?: number | null;
  targetDirection?: string | null;
  // True when the series is an illustrative placeholder rather than measured
  // data (SPI only). Draws dashed and relabels the hover readout.
  synthetic?: boolean;
}) => {
  const width = 100;
  const height = 24;

  // Declared before the early return below: hooks cannot sit after a conditional
  // exit, and this component bails out when there is nothing to plot.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const values = points.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  // Fewer than two real values cannot describe a trend; draw nothing rather than
  // a flat line that implies a measurement.
  if (values.length < 2) return null;

  // Determine direction: higher-is-better or lower-is-better
  let direction = targetDirection;
  if (!direction) {
    if (type === "failure" || type === "dpmo") {
      direction = "lower";
    } else if (type === "yield") {
      direction = "higher";
    }
  }

  // Y-scale. With a target, the axis is a FIXED BAND CENTRED ON THE TARGET, not a
  // fit to the data — so the distance from the dashed target line is proportional
  // to the size of the miss, and comparable between cards.
  //
  // Auto-fitting to min/max was the bug: it stretched whatever spread existed to
  // the full height, so IP missing its target by 0.61 points looked exactly as
  // bad as LBTS missing by 7.7. A near-target value now sits near the line, which
  // is what the chart is supposed to say.
  //
  // The band is a tenth of the target, so a 1-point miss on a target of 100 draws
  // a tenth of the way down — visibly below the line but clearly close to it. It
  // widens to hold any outlier (plus 15% headroom) so a bad hour is never clipped
  // flat against the edge, and it never collapses to zero, which would make a
  // perfectly on-target series divide by nothing.
  let minVal: number;
  let maxVal: number;

  if (target !== null && target !== undefined) {
    const worstMiss = Math.max(...values.map((v) => Math.abs(v - target)));
    const band = Math.max(
      Math.abs(target) * 0.1,
      worstMiss * 1.15,
      Math.abs(target) * 0.01 || 0.01,
    );
    minVal = target - band;
    maxVal = target + band;
  } else {
    // No target to anchor to: fall back to fitting the data, with a floor so a
    // flat series still draws a line rather than dividing by a zero range.
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.01, 0.01);
    minVal = lo - pad;
    maxVal = hi + pad;
  }

  const paddingY = 3;
  const chartHeight = height - paddingY * 2;
  const range = maxVal - minVal || 1;
  // x is indexed against the FULL array, not the non-null subset, so a gap leaves
  // a gap rather than compressing the remaining points together.
  const denom = points.length > 1 ? points.length - 1 : 1;

  // Break the stroke across missing hours instead of drawing through them: an
  // idle hour is an absence of data, and joining across it would invent a slope.
  let path = "";
  let penDown = false;
  points.forEach((val, i) => {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      penDown = false;
      return;
    }
    const x = (i / denom) * width;
    const y = paddingY + chartHeight - ((val - minVal) / range) * chartHeight;
    path += `${penDown ? " L" : " M"} ${x} ${y}`;
    penDown = true;
  });

  // The caller has already graded the card green / amber / red on its distance
  // from target and passes that colour in. The old override that re-derived the
  // glow from the `status` string is gone — status is binary at source, so it
  // collapsed amber back to one of the two extremes and the line disagreed with
  // the tile it sat inside.
  const glowColor = color;

  const targetY =
    target !== null && target !== undefined
      ? paddingY + chartHeight - ((target - minVal) / range) * chartHeight
      : null;

  const hovered =
    hoverIdx !== null && typeof points[hoverIdx] === "number"
      ? (points[hoverIdx] as number)
      : null;

  // Nearest bucket under the cursor. The SVG is stretched to the card's width, so
  // the ratio across the element maps onto the point index rather than pixels.
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    const ratio = (e.clientX - box.left) / box.width;
    const idx = Math.round(ratio * denom);
    setHoverIdx(Math.min(Math.max(idx, 0), points.length - 1));
  };

  const hoverX = hoverIdx !== null ? (hoverIdx / denom) * width : 0;
  const hoverY =
    hovered !== null
      ? paddingY + chartHeight - ((hovered - minVal) / range) * chartHeight
      : 0;

  // Deviation from target, in points — what the tooltip reports. Signed against
  // the direction of goodness, so a positive number always reads as "better than
  // target" whether the card wants a high yield or a low defect rate.
  const deviation =
    hovered !== null && target !== null && target !== undefined
      ? direction === "lower"
        ? target - hovered
        : hovered - target
      : null;

  return (
    <div className="relative w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Target dashed line, full width. The target VALUE is not labelled here —
            it sits at the card's bottom-right instead, which leaves the plot area
            clean and keeps the dashes running the whole span. */}
        {targetY !== null && Number.isFinite(targetY) ? (
          <line
            x1="0"
            y1={targetY}
            x2={width}
            y2={targetY}
            stroke="#ffffff"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.35"
          />
        ) : (
          /* Fallback top baseline if no target exists */
          <line
            x1="0"
            y1={paddingY}
            x2={width}
            y2={paddingY}
            stroke="#ffffff"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.2"
          />
        )}

        {/* Main line. Dashed and dimmed when the series is illustrative, so it
            is distinguishable at a glance from the measured lines on the same
            strip without needing a legend. */}
        <path
          d={path}
          fill="none"
          stroke={glowColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={synthetic ? "3 2.5" : undefined}
          opacity={synthetic ? 0.7 : 1}
        />

        {/* Hovered point */}
        {hovered !== null && (
          <>
            <line
              x1={hoverX}
              y1={paddingY}
              x2={hoverX}
              y2={height - paddingY}
              stroke="#ffffff"
              strokeWidth="0.5"
              opacity="0.35"
            />
            <circle cx={hoverX} cy={hoverY} r="1.8" fill={glowColor} />
          </>
        )}
      </svg>

      {/* Hovered-hour readout. Both numbers are labelled on purpose: this is ONE
          HOUR, not the figure on the card above it, and two bare numbers next to
          a different headline read as a contradiction. A low-volume hour (4 units,
          1 fail = 75%) barely moves a shift that tested 27 — the card recomputes
          from summed counts rather than averaging the hourly percentages. */}
      {hovered !== null && (
        <div
          className="absolute -top-7 z-20 px-1.5 py-0.5 rounded bg-[#101c2b] border border-[#1c3149] whitespace-nowrap pointer-events-none"
          style={{
            left: `${Math.min(Math.max(hoverX, 16), width - 16)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="text-[#8fa0b5] text-[8.5px] font-bold uppercase mr-1">
            {synthetic ? "est" : "hr"}
          </span>
          <span className="text-white text-[9.5px] font-mono font-bold">
            {hovered.toFixed(2)}
            {type === "dpmo" ? "" : "%"}
          </span>
          {deviation !== null && (
            <span
              className="text-[9.5px] font-mono font-bold ml-1"
              style={{ color: deviation >= 0 ? "#22c55e" : "#ff4c4c" }}
            >
              {deviation >= 0 ? "+" : ""}
              {deviation.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ILLUSTRATIVE SERIES — SPI ONLY.
//
// SPI has no hourly source. mart_process_interval carries a row per step per
// hour for every other card on this strip, but the SPI figure arrives already
// aggregated, so there is genuinely nothing to plot and the card rendered with
// an empty slot where its neighbours have a line.
//
// This fills that slot with a line SHAPED around the real day figure the API
// sent — the mean is the actual value, the wiggle is invented. It is a visual
// placeholder, and the two properties below are what keep it from being taken
// for a measurement:
//
//   1. It is drawn DASHED and at reduced opacity, and its hover readout says
//      "est" where a real one says "hr". Every measured line on this strip is
//      solid, so dashed reads as "not measured" without needing a legend.
//   2. The seed is a CONSTANT, not the clock and not Math.random. The shape is
//      therefore identical on every render, every reload and every screen — so
//      it can never appear to move, and a moving line can never be mistaken for
//      fresh data. It also means two people comparing screenshots see the same
//      picture.
//
// Remove this whole block the moment SPI gains an hourly source; nothing else
// depends on it.
const SPI_SAMPLE_DEVIATION_PP = 0.6; // percentage points either side of actual
const SPI_SAMPLE_SEED = 0x5b1f;

/** Deterministic value in [0,1) from an integer seed (xorshift32). */
const seededUnit = (seed: number): number => {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = (x ^ (x << 13)) >>> 0;
  x = x ^ (x >>> 17);
  x = (x ^ (x << 5)) >>> 0;
  return x / 0x100000000;
};

/** `count` points scattered around `value`, clamped to a legal yield.
 *
 *  Only the first `elapsed` are filled; the rest come back null. A placeholder
 *  that ran to the end of the axis claimed the day was over — the line reached
 *  midnight while shift A was still running, which is a worse lie than having no
 *  line at all. Nulls keep their slot so the axis stays a fixed 24 (or 8) wide.
 */
const synthesiseSampleTrend = (
  value: number,
  count: number,
  elapsed: number,
): (number | null)[] =>
  Array.from({ length: count }, (_, i) => {
    if (i >= elapsed) return null;
    // 977 is just an odd stride, so neighbouring buckets draw from distant
    // points of the sequence rather than adjacent ones — otherwise the walk
    // trends in one direction and looks like a real drift.
    const dev =
      (seededUnit(SPI_SAMPLE_SEED + i * 977) * 2 - 1) * SPI_SAMPLE_DEVIATION_PP;
    return Math.min(100, Math.max(0, value + dev));
  });

// Hourly trend for one Process Performance card, straight from the API's
// `trend.buckets` — 24 buckets of one hour, anchored to the 06:15 factory day.
//
// Full day  -> all 24 buckets.
// Shift A/B/C -> the 8 buckets belonging to that shift. The backend tags each
// bucket with its shift (buckets are 1h and anchored to the day start, so each
// nests inside exactly one shift), which is why this is a filter and not index
// arithmetic that would have to know where shifts begin.
//
// Nulls are passed through rather than dropped or zero-filled: the axis has to
// stay a fixed 24 or 8 wide, and an hour that ran nothing has no yield to plot.
const getProcessTrendData = (trend: any, activeShift: string) => {
  const buckets: any[] = Array.isArray(trend?.buckets) ? trend.buckets : [];
  const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
  const shift = shiftMatch ? shiftMatch[1].toUpperCase() : null;

  const selected = shift
    ? buckets.filter((b) => (b.shift || "").toUpperCase() === shift)
    : buckets;

  const metricKey = trend?.metric || "value";
  const points: (number | null)[] = selected.map((b) => {
    if (!b) return null;
    if (isNum(b[metricKey])) return b[metricKey];
    if (isNum(b.value)) return b.value;
    if (isNum(b.yield_pct)) return b.yield_pct;
    if (isNum(b.failure_pct)) return b.failure_pct;
    return null;
  });

  // Direction over the plotted window: first real value to last real value.
  const real = points.filter((v): v is number => v !== null);
  let trendChange = "0.00%";
  let trendDirection: "up" | "down" | "flat" = "flat";
  if (real.length >= 2) {
    const delta = real[real.length - 1] - real[0];
    if (Math.abs(delta) > 0.001) {
      trendChange = `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`;
      trendDirection = delta > 0 ? "up" : "down";
    }
  }

  return { points, trendChange, trendDirection };
};

const SafetyChart = ({
  points,
  yTicks,
  xTicks,
  color = "#ff4c4c",
}: {
  points: number[];
  yTicks: number[];
  xTicks: string[];
  color?: string;
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 200;
  const height = 55;
  // Left gutter adapts to the widest y-axis label so multi-digit values
  // (e.g. 1600) don't overflow left and collide with the divider.
  const maxLabelLen = Math.max(1, ...yTicks.map((t) => String(t).length));
  const paddingLeft = 9 + maxLabelLen * 3.4;
  const paddingRight = 6;
  const paddingTop = 4;
  const paddingBottom = 11;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = yTicks[0];
  const minVal = yTicks[yTicks.length - 1];
  const range = maxVal - minVal || 1;

  const hasPoints = points && points.length >= 2;

  // Which x-axis labels to draw. Decided from real positions and real label
  // widths, walking right-to-left, rather than from a modulo step.
  //
  // A step-based rule kept the last label unconditionally and could land it
  // immediately beside a stepped one — which is how "Jul'26" and "Aug'26" ended up
  // printed on top of each other. Walking backwards from the newest label instead
  // means the current period is always shown and every earlier label is only kept
  // if it clears the one to its right.
  const visibleTicks = (() => {
    const keep = new Set<number>();
    if (xTicks.length === 0) return keep;
    if (xTicks.length === 1) return new Set([0]);

    // Widest label, in viewBox units, plus a gap so neighbours never touch.
    // 4.3 per character is measured against this axis's bold 7.5px text — a
    // smaller estimate let eight "Jan'26"-style labels claim to fit in a span
    // that only holds four, which is how Jul'26 and Aug'26 came out overlapping.
    const charWidth = 4.3;
    const minGap =
      Math.max(...xTicks.map((t) => String(t).length)) * charWidth + 3;
    const xOf = (i: number) =>
      paddingLeft + (i / (xTicks.length - 1)) * chartWidth;

    let lastKept = xTicks.length - 1;
    keep.add(lastKept);
    for (let i = xTicks.length - 2; i >= 0; i--) {
      if (xOf(lastKept) - xOf(i) >= minGap) {
        keep.add(i);
        lastKept = i;
      }
    }
    return keep;
  })();

  const svgPoints = hasPoints
    ? points
        .map((p, i) => {
          const x = paddingLeft + (i / (points.length - 1)) * chartWidth;
          const y =
            paddingTop + chartHeight - ((p - minVal) / range) * chartHeight;
          return `${x},${y}`;
        })
        .join(" ")
    : "";

  const areaPoints = hasPoints
    ? `${paddingLeft},${paddingTop + chartHeight} ${svgPoints} ${paddingLeft + chartWidth},${paddingTop + chartHeight}`
    : "";

  const gradId = React.useId();

  return (
    <div className="w-full h-[70px] 2xl:h-[55px] mt-1 relative select- mb-3">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible font-mono"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid Lines & Labels */}
        {yTicks.map((tick, i) => {
          const y =
            paddingTop + chartHeight - ((tick - minVal) / range) * chartHeight;
          return (
            <g key={i} className="opacity-65">
              <text
                x={paddingLeft - 4}
                y={y + 2}
                fill="#8fa0b5"
                fontSize="8"
                fontWeight="bold"
                textAnchor="end"
              >
                {tick}
              </text>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#1c3149"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </g>
          );
        })}

        {/* Area fill */}
        {hasPoints && <polygon points={areaPoints} fill={`url(#${gradId})`} />}

        {/* Line */}
        {hasPoints && (
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="1"
            points={svgPoints}
          />
        )}

        {/* Vertical Guideline on Hover */}
        {hoveredIdx !== null && hasPoints && (
          <line
            x1={paddingLeft + (hoveredIdx / (points.length - 1)) * chartWidth}
            y1={paddingTop}
            x2={paddingLeft + (hoveredIdx / (points.length - 1)) * chartWidth}
            y2={paddingTop + chartHeight}
            stroke={color}
            strokeWidth="0.5"
            strokeDasharray="2,2"
            opacity="0.5"
          />
        )}

        {/* Dots */}
        {hasPoints &&
          points.map((p, i) => {
            const x = paddingLeft + (i / (points.length - 1)) * chartWidth;
            const y =
              paddingTop + chartHeight - ((p - minVal) / range) * chartHeight;
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isHovered ? "2.5" : "1.8"}
                fill={color}
                stroke={isHovered ? "#ffffff" : "#050b12"}
                strokeWidth="0.4"
                style={{
                  transition: "all 0.1s ease-in-out",
                }}
              />
            );
          })}

        {/* Interactive Hit Areas */}
        {hasPoints &&
          points.map((p, i) => {
            const x = paddingLeft + (i / (points.length - 1)) * chartWidth;
            const y =
              paddingTop + chartHeight - ((p - minVal) / range) * chartHeight;
            return (
              <circle
                key={`hit-${i}`}
                cx={x}
                cy={y}
                r="7"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}

        {/* Tooltip Overlay */}
        {hoveredIdx !== null && hasPoints && (
          <g>
            {(() => {
              const x =
                paddingLeft + (hoveredIdx / (points.length - 1)) * chartWidth;
              const y =
                paddingTop +
                chartHeight -
                ((points[hoveredIdx] - minVal) / range) * chartHeight;

              const tooltipWidth = 36;
              const tooltipHeight = 18;
              let tx = x - tooltipWidth / 2;
              let ty = y - tooltipHeight - 4;

              // Bound adjustments
              if (tx < 2) tx = 2;
              if (tx + tooltipWidth > width - 2) tx = width - tooltipWidth - 2;
              if (ty < 2) ty = y + 4; // Display below if too high

              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={tx}
                    y={ty}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="3"
                    fill="#050b12"
                    stroke={color}
                    strokeWidth="0.8"
                    opacity="0.95"
                  />
                  {/* Period Name */}
                  <text
                    x={tx + tooltipWidth / 2}
                    y={ty + 6.5}
                    fill="#8fa0b5"
                    fontSize="5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {xTicks[hoveredIdx]}
                  </text>
                  {/* Point Value */}
                  <text
                    x={tx + tooltipWidth / 2}
                    y={ty + 14}
                    fill="#ffffff"
                    fontSize="7"
                    fontWeight="black"
                    textAnchor="middle"
                  >
                    {points[hoveredIdx]}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* X Axis Labels */}
        {xTicks.map((tick, i) => {
          const isFirst = i === 0;
          const isLast = i === xTicks.length - 1;

          if (!visibleTicks.has(i)) return null;

          const x = paddingLeft + (i / (xTicks.length - 1)) * chartWidth;
          const anchor = isFirst ? "start" : isLast ? "end" : "middle";
          return (
            <text
              key={i}
              x={x}
              y={height - 2}
              fill="#8fa0b5"
              fontSize="7.5"
              fontWeight="bold"
              textAnchor={anchor}
              className="opacity-90"
            >
              {tick}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

const SemiCircleGauge = ({
  value,
  min = 0,
  max = 100,
  labelMin,
  labelMax,
  color = "#3b82f6",
  icon: Icon,
  showValueInCenter = false,
  // Absolute-value gauges (CI) pass a pre-formatted centre label such as
  // "654K €". Omitted everywhere else, where the arc is a percentage and the
  // centre reads "<value>%".
  centerLabel,
}: any) => {
  const radius = 32;
  const strokeWidth = 6;
  const cx = 60;
  const cy = 38;

  const circumference = Math.PI * radius;
  // Guard the degenerate range: an absolute gauge whose max is still 0 (no data
  // yet) would divide by zero and render NaN into the SVG path.
  const span = max - min;
  const raw = span > 0 ? (value - min) / span : 0;
  const percentage = Math.min(Math.max(raw, 0), 1);
  const strokeDashoffset = circumference - percentage * circumference;

  const iconY = 25;

  return (
    <div className="flex items-center justify-center relative w-[145px] h-[78px] 2xl:w-[120px] 2xl:h-[64px] select-none">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 120 64"
        className="overflow-visible"
      >
        {/* Background Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#101c2b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Filled Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />

        {/* Left Label */}
        <text
          x={cx - radius}
          y={cy + 12}
          fill="#63788f"
          fontSize="9.5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {labelMin}
        </text>

        {/* Right Label */}
        <text
          x={cx + radius}
          y={cy + 12}
          fill="#63788f"
          fontSize="9.5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {labelMax}
        </text>

        {/* Center Value */}
        {showValueInCenter && (
          <text
            x={cx}
            y={cy - 1}
            fill="#ffffff"
            fontSize="11"
            fontWeight="900"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {centerLabel ?? `${value}%`}
          </text>
        )}

        {/* Center Icon */}
        {!showValueInCenter && Icon && (
          <g
            transform={`translate(${cx - 10}, ${iconY - 10})`}
            className="text-[#8fa0b5] opacity-90"
          >
            <Icon size={20} />
          </g>
        )}
      </svg>
    </div>
  );
};

// Tile label -> `process_performance` key in the API payload.
//
// Explicit rather than derived from the label, because two of them cannot be
// guessed by any transform: the mart calls burn-in THERMAL_TEST (same test, two
// names), and "SMT DEFECTS @ MFT" is stored as SMT_DEFECTS. Mangling the label
// instead produced "SMT_DEFECTS_@_MFT" and "BURN-IN", neither of which exists in
// the payload — so both tiles silently rendered "..." forever. Any tile added
// here whose label differs from its mart step needs an entry.
const API_KEY_BY_TILE: Record<string, string> = {
  "SMT DEFECTS @ MFT": "SMT_DEFECTS",
  "BURN-IN": "BURN_IN",
  "BURN-IN - S": "BURN_IN",
  "AXI - S": "AXI",
  "LBTS - S": "LBTS",
  OTA: "OTA_TEST",
};

const processPerformanceData = [
  {
    name: "SPI",
    icon: Search,
    section: "SMT",
    type: "yield",
    data: { done: "12,450", ok: "12,221", yield: "98.16%" },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "DPMOI",
    icon: Camera,
    section: "SMT",
    type: "dpmo",
    data: { defects: "...", opportunities: "...", index: "..." },
    status: "...",
    color: "#16253a",
  },
  {
    name: "AXI - S",
    icon: Scan,
    section: "SMT",
    type: "yield",
    data: { done: "11,180", ok: "11,001", yield: "98.40%" },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "SMT DEFECTS @ MFT",
    icon: Cpu,
    section: "SMT",
    type: "failure",
    data: { failure: "..." },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "THERMAL AVI",
    icon: Thermometer,
    section: "RFM",
    type: "yield",
    data: { done: "980", ok: "955", yield: "97.45%" },
    status: "At Risk",
    color: "#eab308",
  },
  {
    name: "SCREW DEFECTS",
    icon: ScrewIcon,
    section: "RFM",
    type: "failure",
    data: { failure: "1.6%" },
    status: "Critical",
    color: "#ff4c4c",
  },
  {
    name: "OTA",
    icon: Cpu,
    section: "RFM",
    type: "yield",
    data: { done: "540", ok: "531", yield: "98.33%" },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "RTWP",
    icon: Zap,
    section: "RFM",
    type: "yield",
    data: { done: "520", ok: "512", yield: "98.46%" },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "BURN-IN - S",
    icon: Thermometer,
    section: "RFM",
    type: "yield",
    data: { done: "6", ok: "6", yield: "100.00%" },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "LBTS - S",
    icon: Zap,
    section: "RFM",
    type: "yield",
    data: { done: "610", ok: "602", yield: "98.69%" },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "IP",
    icon: Scan,
    section: "RFM",
    type: "yield",
    data: { done: "510", ok: "502", yield: "98.43%" },
    status: "Healthy",
    color: "#22c55e",
  },
  {
    name: "AUTO OGI",
    icon: Search,
    section: "RFM",
    type: "yield",
    data: { done: "840", ok: "832", yield: "98.05%" },
    status: "Healthy",
    color: "#22c55e",
  },
];

const SHIFTS = [
  "Shift A (06:15 AM - 02:15 PM)",
  "Shift B (02:15 PM - 10:15 PM)",
  "Shift C (10:15 PM - 06:15 AM)",
  "Full Day (06:15 AM - 06:15 AM)",
];

// The feed sends null for metrics a shift has no data for. `x !== undefined`
// lets null through and `null.toFixed()` throws during render, white-screening
// the whole page — so every numeric format goes through these instead.
const isNum = (v: any): v is number =>
  typeof v === "number" && Number.isFinite(v);

const fmtFixed = (v: any, digits: number, fallback = "...") =>
  isNum(v) ? v.toFixed(digits) : fallback;

/** Fiscal-period label (P01..P12) for a row keyed by calendar month.
 *
 *  Shared by Customer Reflection and by both CI charts, because both are fed by
 *  CALENDAR-MONTH sources — the complaints workbook's 'Graph 2026' sheet and
 *  mart_ci.period_month — and neither has anything finer to offer.
 *
 *  The period labels work because the fiscal periods are numbered to track
 *  months (P01 opens 3 Jan, P07 opens 4 Jul), so the ordinal mapping is right.
 *  But the label is NOMINAL, and that is the caveat to keep in mind: P07 truly
 *  runs 4 Jul - 7 Aug, while the "July" figure underneath it covers 1-31 Jul.
 *  These axes are period-LABELLED, not period-AGGREGATED.
 *
 *  Used so every month-wise axis on the dashboard — Safety, CO2, CI, Customer
 *  Reflection — reads in the same units the plant plans in. Falls back to
 *  whatever label the payload carried if the month cannot be read.
 */
const monthPeriodLabel = (m: any): string => {
  const month = Number(String(m?.period_month ?? "").slice(5, 7));
  return month >= 1 && month <= 12
    ? `P${String(month).padStart(2, "0")}`
    : (m?.label ?? "");
};

// Compact money/count for the CI gauges: 653520 -> "654K", 2360000 -> "2.4M".
// The API sends savings in euros (the sheet holds thousands and the backend
// scales them), so this is the only place the magnitude is shortened.
const fmtCompact = (v: any, fallback = "...") => {
  if (!isNum(v)) return fallback;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${Math.round(v * 100) / 100}`;
};

// Build a CI gauge's view model from one metrics entry of the `ci` payload.
const toCiMetric = (m: any, unit: string): CiMetricView => {
  const value = isNum(m?.achieved) ? m.achieved : 0;
  const suffix = unit ? ` ${unit}` : "";
  return {
    value,
    // Fall back to the value itself so a lone data point still fills the arc
    // instead of dividing by a zero range.
    max: isNum(m?.scale_max) && m.scale_max > 0 ? m.scale_max : value,
    centerLabel: `${fmtCompact(value)}${suffix}`,
    achievedLabel: isNum(m?.achieved) ? `${fmtCompact(value)}${suffix}` : "—",
    targetLabel: isNum(m?.target)
      ? `Target ${fmtCompact(m.target)}${suffix}`
      : "",
  };
};

const fmtCount = (v: any, fallback = "...") =>
  isNum(v) ? v.toLocaleString() : fallback;

// ── Attention Center ────────────────────────────────────────────────────────
// Alert figures carry NO unit in the payload: an FCR defect rate per 100 boards
// (74.07 against 10.53) and a yield percentage arrive as bare numbers alike.
// Nothing is appended unless the row names a unit — the previous hardcoded '%'
// turned every non-yield alert into a percentage it never was.
const fmtAlertValue = (v: any, unit: string) =>
  isNum(v) ? `${Math.round(v * 100) / 100}${unit}` : "—";

// 156 minutes reads as "2h 36m ago", not "156m ago". Alerts sit on screen for
// a whole shift, so raw minutes stop being legible within the first hour.
const fmtAlertAge = (m: any) => {
  if (!isNum(m)) return "";
  if (m < 60) return `${Math.round(m)}m ago`;
  const hours = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  return mins ? `${hours}h ${mins}m ago` : `${hours}h ago`;
};

// ── Heat-map zone grading ───────────────────────────────────────────────────
// A zone is graded from the Process Performance cards that feed it, each card
// judged against its OWN target rather than a shared threshold:
//
//   green   target met
//   yellow  target missed, but still inside the band
//   red     target missed by more than the band
//
// For higher-is-better percentages the band is 5 points, which is the rule as
// specified: target 95 → 95 and up green, 90–94 yellow, 89 and below red.
const ZONE_BAND_POINTS = 5;

// Lower-is-better cards (the DPMOI index, failure rates) get a 5% relative band
// instead. Their targets are small numbers — DPMOI's is around 2 — so a flat
// 5-point band would sit further from the target than any real reading, and
// yellow and red could never be reached at all.
const ZONE_BAND_RELATIVE = 0.05;

type MetricGrade = "green" | "yellow" | "red" | "unknown";

// "unknown" means the card cannot be graded — no target agreed for it (SPI, AXI),
// or nothing ran this shift. Those carry no signal and are skipped by the zone,
// rather than counting as a pass and painting it green on no evidence.
const gradeAgainstTarget = (card: any): MetricGrade => {
  const target = card?.target;
  const actual = card?.actual;
  if (!isNum(target) || !isNum(actual)) return "unknown";

  // The API states the direction; fall back to the card type, where a yield is
  // the only kind that improves as it rises.
  const lowerIsBetter = card.targetDirection
    ? card.targetDirection === "lower"
    : card.type !== "yield";

  if (lowerIsBetter) {
    if (actual <= target) return "green";
    return actual <= target * (1 + ZONE_BAND_RELATIVE) ? "yellow" : "red";
  }
  if (actual >= target) return "green";
  return actual >= target - ZONE_BAND_POINTS ? "yellow" : "red";
};

// The one place a grade turns into a colour. Cards and heat-map zones both read
// from here, so a tile and its zone can never disagree about what amber means.
const GRADE_CSS: Record<MetricGrade, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ff4c4c",
  unknown: "#0091ff",
};

// THE grade for one process card. Both the tile's own colour and its zone's
// colour come from this, so a zone can never disagree with the cards inside it —
// and a single-card zone (thermalgel) is exactly the colour of its one card.
const cardGrade = (card: any): MetricGrade => {
  // Nothing ran, so there is nothing to grade. Neutral rather than scored
  // against a target it never had a chance to meet.
  if (
    card.status === "N/A" ||
    card.status === "..." ||
    card.status === "Not Run"
  ) {
    return "unknown";
  }

  const graded = gradeAgainstTarget(card);
  if (graded !== "unknown") return graded;

  // No target agreed for this card (SPI, AXI, Manual OGI). There is no band to
  // measure against, so it keeps the binary pass/fail the API's own verdict gave
  // it — those cards can never show amber, because nothing defines "near" here.
  return card.status === "Critical" || card.status === "At Risk"
    ? "red"
    : "green";
};

// KPI-card grade. These hold their figure as a display string ("94.2%") and carry
// no target_direction — every one is a yield, so higher is better and they land
// on the 5-point band. Falls back to direction of travel when untargeted, which
// is what the KPI tiles have always done.
const kpiCardGrade = (card: any): MetricGrade => {
  if (!card) return "unknown";
  const actual = Number.parseFloat(String(card.value).replace(/[^\d.-]/g, ""));
  const graded = gradeAgainstTarget({
    target: card.target,
    actual: Number.isFinite(actual) ? actual : null,
    targetDirection: "higher",
  });
  if (graded !== "unknown") return graded;
  const delta = card.delta_vs_yesterday ?? 0;
  if (delta > 0) return "green";
  if (delta < 0) return "red";
  return "unknown";
};

// What a process tile paints, and whether it is in the hard-fail state that gets
// the pulsing border. Amber deliberately does NOT pulse — the animation is what
// makes a tile demand attention, and a near-miss should not.
const cardVerdict = (card: any): { color: string; red: boolean } => {
  const grade = cardGrade(card);
  return { color: GRADE_CSS[grade], red: grade === "red" };
};

// Worst grade wins: one red card puts the whole zone red, one amber card makes it
// amber, and it is only green when every card is. A zone is as healthy as its
// weakest step. With a single card this collapses to that card's own grade.
const zoneStatusFromGrades = (all: MetricGrade[]): ZoneStatus => {
  const grades = all.filter((g) => g !== "unknown");
  if (grades.length === 0) return "unknown";
  if (grades.includes("red")) return "critical";
  if (grades.includes("yellow")) return "warning";
  return "healthy";
};

const bandedZoneStatus = (cards: any[]): ZoneStatus =>
  zoneStatusFromGrades(cards.map(cardGrade));

// ── Process Performance stage groups ────────────────────────────────────────
// Gap between process cards, in px. Shared by the card rows AND the group bar
// above them — the bar's widths are derived from it, so the two must not drift.
const PROCESS_CARD_GAP = 10;

// Every stage group uses the one blue. Kept as a constant because RFM is drawn
// as two separate segments (row 1 tail, then the band below) and they must stay
// the same colour to read as one group.
const STAGE_GROUP_COLOR = "#0091ff";

// One cell of the stage-group bar, sized to sit exactly above `span` cards.
//
// A plain flex-1 / flex-2 split lands half a gap out per cell, because the gaps
// between cards fall INSIDE a group that spans several of them while the gaps
// between groups do not. Growing on the card count alone and pushing the group's
// own internal gaps into flex-basis makes each cell resolve to exactly
// span*cardWidth + (span-1)*gap, matching the cards beneath at any width.
//
// Omit `label` to draw a bare line — used where a group opens on one row and is
// named on another. Pass `spacer` for a cell that draws nothing and only holds
// its width. `startCap`/`endCap` off means the group carries on past that end.
const StageGroupBar: React.FC<{
  span: number;
  label?: string;
  color?: string;
  spacer?: boolean;
  startCap?: boolean;
  endCap?: boolean;
}> = ({
  span,
  label,
  color = STAGE_GROUP_COLOR,
  spacer = false,
  startCap = true,
  endCap = true,
}) => {
  const cap = (
    <span
      className="w-[2px] h-2 rounded-sm flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
  return (
    <div
      className="min-w-0 flex items-center gap-1.5"
      style={{
        flexGrow: span,
        flexShrink: 1,
        flexBasis: (span - 1) * PROCESS_CARD_GAP,
      }}
      aria-hidden={!label}
    >
      {!spacer && (
        <>
          {startCap && cap}
          <span
            className="h-[2px] flex-1"
            style={{
              background: label
                ? `linear-gradient(90deg, ${color}66, ${color})`
                : `${color}b3`,
            }}
          />
          {label && (
            <>
              <span
                className="text-[10px] font-black tracking-[0.18em] whitespace-nowrap leading-none"
                style={{ color }}
              >
                {label}
              </span>
              <span
                className="h-[2px] flex-1"
                style={{
                  background: `linear-gradient(270deg, ${color}66, ${color})`,
                }}
              />
            </>
          )}
          {endCap && cap}
        </>
      )}
    </div>
  );
};

export const QualityLayout: React.FC<QualityLayoutProps> = () => {
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour12: false }),
  );
  const [dateStr, setDateStr] = useState(() =>
    new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
  );
  const [liveStatus, setLiveStatus] = useState("OFFLINE");
  const [isTwinModalOpen, setIsTwinModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  // The Process Performance tile whose per-product breakdown is open, or null.
  // Holds the mart step (what the endpoint's path takes) alongside the tile label
  // (what the header shows), because the two differ for several cards — see
  // API_KEY_BY_TILE.
  const [drilldownCard, setDrilldownCard] = useState<{
    step: string;
    title: string;
  } | null>(null);
  const [kpiCards, setKpiCards] = useState(
    qualityData.kpiCards.map((card) => {
      const isPercent = [1, 2, 3, 4, 5, 7, 9].includes(card.id);
      const delta = 0;
      const deltaSign = "▲";
      return {
        ...card,
        title: card.label,
        value: isPercent ? "0.0%" : "0",
        projectedValue:
          (card as any).projected !== undefined ? "0.0%" : undefined,
        change: isPercent
          ? `${deltaSign} ${Math.abs(delta).toFixed(1)}% vs Yesterday`
          : `${deltaSign} ${Math.abs(delta)} vs yesterday`,
        points: (card.trend as (number | null)[]).map(() => null) as (
          | number
          | null
        )[],
        yesterdayPoints: (card as any).yesterdayTrend
          ? (((card as any).yesterdayTrend as (number | null)[]).map(
              () => null,
            ) as (number | null)[])
          : (undefined as (number | null)[] | undefined),
      };
    }),
  );
  const [activeAlertTab, setActiveAlertTab] = useState<
    "All" | "Critical" | "Risk"
  >("All");
  // Hovered AI recommendation, rendered as a fixed-position tooltip through a
  // portal. It cannot live inside the alert card: the card is overflow-hidden
  // and the alert list scrolls, so either box would clip it.
  const [recTip, setRecTip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [activeShift, setActiveShift] = useState(
    "Full Day (06:15 AM - 06:15 AM)",
  );
  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const [activeYieldTab, setActiveYieldTab] = useState<"UNITS" | "TRX" | "PA">(
    "UNITS",
  );
  const [yieldPage, setYieldPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  // Alert cards the fixed-height panel shows before deferring to the modal.
  const ALERT_PREVIEW_LIMIT = 4;

  const [processPerformance, setProcessPerformance] = useState<any[]>(
    processPerformanceData.map((item) => ({
      ...item,
      data:
        item.type === "yield"
          ? { done: "...", ok: "...", yield: "..." }
          : { failure: "..." },
      status: "...",
      color: "#16253a",
    })),
  );
  const [productYield, setProductYield] = useState<any[]>([]);
  const [productSort, setProductSort] = useState<{
    key: "name" | "tested" | "failed" | null;
    order: "asc" | "desc";
  }>({ key: null, order: "asc" });
  // Distinguishes "still fetching" and "fetch failed" from a genuinely empty
  // result, so an unreachable API never reads as "No records found".
  const [yieldFetchState, setYieldFetchState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [rawKpiData, setRawKpiData] = useState<any>(null);
  // HFTPY is a TOP-LEVEL snapshot block, not part of `kpis`, because it is a
  // fiscal-PERIOD figure while everything in `kpis` is per day and per shift.
  // Card 9 was reading kpis.day.hftpy, which never existed — hence the 0.0%.
  //
  // It is also not a yield average: it counts PRODUCTS. Of the unit products with
  // enough volume in the period to judge (>= min_tested first attempts), what
  // share met their own target. 4 of 6 qualifying = 66.67%.
  const [hftpyBlock, setHftpyBlock] = useState<any>(null);
  const [rawProcessPerformance, setRawProcessPerformance] = useState<any>(null);
  const [attentionCenterAlerts, setAttentionCenterAlerts] = useState<any[]>([]);
  // Alerts arrive over SSE, so "no alerts" and "stream never connected" look
  // identical in the data. Track the feed separately to tell them apart.
  const [alertsFeedState, setAlertsFeedState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [safetyAccident, setSafetyAccident] = useState(0);
  const [safetyNearMiss, setSafetyNearMiss] = useState(0);
  const [accidentPoints, setAccidentPoints] = useState<number[]>([]);
  // Safety targets are both 0 — the goal is no incidents at all. Read from the
  // payload rather than assumed so a revised target needs no code change.
  const [safetyTargets, setSafetyTargets] = useState({
    incident: 0,
    nearMiss: 0,
  });
  const [nearMissPoints, setNearMissPoints] = useState<number[]>([]);
  const [yieldRecommendations, setYieldRecommendations] = useState<
    Record<string, any>
  >({});
  // Which fiscal period the recommendations answer for, and whether its plan
  // sheet exists at all. Drives the column header label and the empty state.
  const [yieldPlanStatus, setYieldPlanStatus] = useState<{
    month: string | null;
    available: boolean;
  }>({ month: null, available: true });
  // True while the recommendation request is in flight. The cell shows a loading
  // note rather than the raw JSON: the generated prose takes a few seconds on a
  // cold cache, and a screen full of field dumps that then rewrites itself reads
  // as a fault. Starts true so the first paint is the loading state, never JSON.
  const [yieldRecsLoading, setYieldRecsLoading] = useState(true);
  const [safetyXTicks, setSafetyXTicks] = useState<string[]>(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const month = d.toLocaleString("en-US", { month: "short" });
      const day = d.getDate().toString().padStart(2, "0");
      return `${month} ${day}`;
    }),
  );
  const [co2Points, setCo2Points] = useState<number[]>([]);
  // CO2 carries its OWN period labels. It used to borrow safetyXTicks, which is
  // built from the safety mart's periods — a different series with its own period
  // count, so the labels silently drifted out of step with the points whenever the
  // two disagreed (safety had P01..P08 loaded, CO2 only P01..P07).
  const [co2Labels, setCo2Labels] = useState<string[]>([]);
  // Four ticks spanning the reported range, rounded out to a readable step, so the
  // whole series is inside the plot whatever the tonnage happens to be this year.
  const co2YTicks = useMemo(() => {
    const values = co2Points.filter(isNum);
    if (!values.length) return [1600, 1400, 1200, 1000];
    const step = Math.max(
      50,
      Math.ceil((Math.max(...values) - Math.min(...values)) / 3 / 50) * 50,
    );
    const floor = Math.floor(Math.min(...values) / step) * step;
    // Descending: SafetyChart renders the first tick at the top.
    return [3, 2, 1, 0].map((i) => floor + i * step);
  }, [co2Points]);
  const [greenEnergyPct, setGreenEnergyPct] = useState(0);
  const [co2Emission, setCo2Emission] = useState(0);
  const [customerComplaintsCount, setCustomerComplaintsCount] = useState(0);
  const [customerComplaintsPoints, setCustomerComplaintsPoints] = useState<
    number[]
  >([]);
  const [complaintsXTicks, setComplaintsXTicks] = useState<string[]>([]);
  const [customerEri, setCustomerEri] = useState(0);
  const [eriData, setEriData] = useState<EriData | null>(null);
  // CI card. Every figure here comes from the GimtoolExport sheet via the API —
  // nothing about this card is a literal in the markup, including the targets and
  // the gauge range, which is why they are state and not JSX text.
  const [ciMonthLabel] = useState("");
  const [ciLeanSavings, setCiLeanSavings] =
    useState<CiMetricView>(EMPTY_CI_METRIC);
  const [ciKaizen, setCiKaizen] = useState<CiMetricView>(EMPTY_CI_METRIC);
  // Month-by-month CI figures, January to the newest completed month. Drives the
  // savings line chart that replaced the two semi-circle gauges.
  const [ciMonths, setCiMonths] = useState<
    {
      label: string;
      // ISO first-of-month from mart_ci.period_month. Carried so the x-axis can
      // be labelled by fiscal period rather than by month name.
      period_month?: string | null;
      lean_savings?: number | null;
      kaizen?: number | null;
    }[]
  >([]);
  const [twinZones, setTwinZones] = useState<ZoneDef[]>(ZONES);
  const [shopFloorConditions, setShopFloorConditions] = useState<{
    temp: number | null;
    humidity: number | null;
  }>({ temp: null, humidity: null });
  // Which hour the headline BMS reading came from, so the header can say WHEN it
  // was measured. The workbook is published a month ahead and contains rows for
  // dates that have not happened, so a temperature with no timestamp is
  // indistinguishable from a stale one.
  const [shopFloorHour, setShopFloorHour] = useState<number | null>(null);

  const currentYieldData = React.useMemo(() => {
    if (!productSort.key) return productYield;
    return [...productYield].sort((a, b) => {
      const key = productSort.key!;
      const order = productSort.order;

      if (key === "name") {
        const valA = (a.name || "").toString().toLowerCase();
        const valB = (b.name || "").toString().toLowerCase();
        return order === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        const parseNum = (val: any) => {
          if (val === null || val === undefined) return 0;
          const clean = val.toString().replace(/,/g, "");
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        };
        const valA = parseNum(a[key]);
        const valB = parseNum(b[key]);
        return order === "asc" ? valA - valB : valB - valA;
      }
    });
  }, [productYield, productSort]);

  const visibleAlerts = React.useMemo(
    () =>
      attentionCenterAlerts.filter(
        (alert) => activeAlertTab === "All" || alert.level === activeAlertTab,
      ),
    [attentionCenterAlerts, activeAlertTab],
  );

  useEffect(() => {
    if (!isAlertsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsAlertsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAlertsModalOpen]);

  // The panel shows only the newest few; the rest live behind "View All Alerts",
  // which opens the modal. Without the cap the panel scrolled to an unbounded
  // length and the cards were the only thing on screen worth reading.
  const previewAlerts = visibleAlerts.slice(0, ALERT_PREVIEW_LIMIT);

  // Per-tab counts. These are on the tab labels because the feed arrives
  // severity-first: the leading cards are all Critical, so switching All ->
  // Critical often leaves the capped preview list byte-identical and the tab
  // looks broken. The counts are what tell you the filter actually applied.
  const alertTabCounts = React.useMemo(
    () => ({
      All: attentionCenterAlerts.length,
      Critical: attentionCenterAlerts.filter((a) => a.level === "Critical")
        .length,
      Risk: attentionCenterAlerts.filter((a) => a.level === "Risk").length,
    }),
    [attentionCenterAlerts],
  );

  const totalYieldPages =
    Math.ceil(currentYieldData.length / ITEMS_PER_PAGE) || 1;
  const paginatedYieldData = currentYieldData.slice(
    (yieldPage - 1) * ITEMS_PER_PAGE,
    yieldPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setYieldPage(1);
  }, [activeYieldTab]);

  // Yield-target recommendation, keyed by product name.
  //
  // These are PERIOD targets from the HFTPY plan — a different commitment from
  // the TARGET YIELD % column, which is the DAY target from the Target sheet.
  // The two differ on purpose, so the column header carries the period label to
  // stop them being read as the same number.
  useEffect(() => {
    const fetchYieldRecommendation = async () => {
      // Only announce loading when there is nothing to show yet. A background
      // refresh must not blank prose that is already on screen and still valid.
      setYieldRecsLoading((prev) => prev || false);
      try {
        const res = await fetch(apiUrl("/yield-recommendation/current-day"));
        if (!res.ok) throw new Error("yield recommendation unavailable");
        const data = await res.json();
        const byProduct: Record<string, any> = {};
        for (const p of data.products ?? []) byProduct[p.product] = p;
        setYieldRecommendations(byProduct);
        // An empty products list has two very different causes — the plan sheet
        // for this period does not exist yet, or nothing planned is running.
        // Keep them apart so the column can explain itself instead of just
        // going quiet.
        setYieldPlanStatus({
          month: data.plan_month ?? null,
          available: data.plan_available !== false,
        });
      } catch (err) {
        // Advisory panel: a failure here must not disturb the yield table.
        console.error("Error fetching yield recommendation:", err);
        setYieldRecommendations({});
        setYieldPlanStatus({ month: null, available: true });
      } finally {
        // finally, not the try block: a failed fetch must clear the loading state
        // too, or the column says "loading" forever.
        setYieldRecsLoading(false);
      }
    };

    fetchYieldRecommendation();
    const id = setInterval(fetchYieldRecommendation, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch product yield from REST API every 5 minutes and when shift or tab changes
  useEffect(() => {
    const fetchYieldData = async () => {
      const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
      const targetShift = shiftMatch ? shiftMatch[1].toUpperCase() : "D";
      const targetLevel = activeYieldTab === "UNITS" ? "UNIT" : activeYieldTab;

      try {
        const url = apiUrl(
          `/dashboard/product-yield?shift=${targetShift}&level=${targetLevel}`,
        );
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch product yield");
        const data = await res.json();
        if (data && Array.isArray(data.rows)) {
          const mappedRows = data.rows.map((row: any) => ({
            id: row.id,
            name: row.product,
            tested: fmtCount(row.tested, "—"),
            failed: isNum(row.failed) ? row.failed.toString() : "—",
            fpy: row.fpy,
            spy: row.spy,
            target: row.target_yield,
            // The mart emits healthy | warning | critical | no_target, and the
            // table shows only two verdicts: on target or not.
            //
            // 'warning' (the mart's "within 5 points below target") is folded into
            // Critical — being under the agreed yield is a miss whether it is by
            // half a point or five, and the amber middle state made a genuine
            // shortfall read as acceptable.
            //
            // 'no_target' stays its own neutral state. It is not a breach: no
            // target has been filed for that product, which is a data gap to fix
            // in the target sheet rather than a yield problem on the line.
            status:
              row.status === "healthy"
                ? "Healthy"
                : row.status === "no_target"
                  ? "No Target"
                  : "Critical",
            rec: row.ai_recommendation,
            shift: row.shift,
            sub_module: row.sub_module,
          }));
          setProductYield(mappedRows);
        } else {
          // 200 with no rows payload is still an empty result, not a failure.
          setProductYield([]);
        }
        setYieldFetchState("ready");
      } catch (err) {
        console.error("Error fetching product yield:", err);
        setProductYield([]);
        setYieldFetchState("error");
      }
    };

    // Only reset on shift/tab change — the 5-min poll must not flash "Loading"
    // over rows that are already on screen.
    setYieldFetchState("loading");
    fetchYieldData();
    const interval = setInterval(fetchYieldData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [activeShift, activeYieldTab]);

  // Fetch safety data from REST API
  useEffect(() => {
    const fetchSafetyData = async () => {
      try {
        const url = apiUrl("/dashboard/safety");
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch safety data");
        const data = await res.json();
        if (data) {
          if (data.current) {
            setSafetyAccident(data.current.incident ?? 0);
            setSafetyNearMiss(data.current.near_miss ?? 0);
            // Targets, so the colour is judged against the agreed figure rather
            // than a literal zero hardcoded here. Both are 0 today, but reading
            // them keeps this consistent with every other card and means a
            // revised target takes effect without a code change.
            setSafetyTargets({
              incident: data.current.incident_target ?? 0,
              nearMiss: data.current.near_miss_target ?? 0,
            });
          }
          if (data.periods && Array.isArray(data.periods)) {
            const sortedPeriods = [...data.periods].sort((a: any, b: any) =>
              a.period.localeCompare(b.period),
            );
            setAccidentPoints(sortedPeriods.map((p: any) => p.incident ?? 0));
            setNearMissPoints(sortedPeriods.map((p: any) => p.near_miss ?? 0));
            setSafetyXTicks(
              sortedPeriods.map((p: any) => p.period_code ?? p.period),
            );
          }
        }
      } catch (err) {
        console.error("Error fetching safety data:", err);
      }
    };

    fetchSafetyData();
    const interval = setInterval(fetchSafetyData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Fetch ERI data from REST API
  useEffect(() => {
    const fetchEriData = async () => {
      try {
        const url = apiUrl("/dashboard/eri");
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch ERI data");
        const data = await res.json();
        if (data) {
          if (data.eri) {
            setEriData(data.eri);
            if (data.eri.eri_pct !== undefined && data.eri.eri_pct !== null) {
              setCustomerEri(data.eri.eri_pct);
            }
          }
          // Parse customer complaints if available from the API response
          if (data.customer_complaints) {
            const cc = data.customer_complaints;
            // latest.count, NOT total: the label above this figure says "This
            // Month". `total` is the year-to-date sum, which read as 12 complaints
            // in August when the month had 1.
            setCustomerComplaintsCount(cc.latest?.count ?? 0);
            if (Array.isArray(cc.months)) {
              setCustomerComplaintsPoints(
                cc.months.map((m: any) => m.count ?? 0),
              );
              setComplaintsXTicks(cc.months.map(monthPeriodLabel));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching ERI data:", err);
      }
    };

    fetchEriData();
    const interval = setInterval(fetchEriData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // SSE stream integration
  useEffect(() => {
    // Resolved in core/api/config.ts — derived from the REST base unless
    // VITE_DASHBOARD_SSE_URL overrides it.
    const es = new EventSource(DASHBOARD_SSE_URL);

    // mapStatus helper removed: the factory-twin zone block that used it is
    // currently disabled (commented out). Re-add if that block is re-enabled.

    const handleData = (data: any) => {
      if (!data) return;

      // A payload reached us, so the feed is alive: any empty alert list from
      // here on is a real "no alerts", not a dead stream.
      setAlertsFeedState("ready");

      // 1. Shift & Connection Status
      if (data.meta) {
        if (data.meta.shift) {
          const s = data.meta.shift;
          if (s.name && s.start && s.end) {
            setActiveShift(`${s.name} (${s.start} - ${s.end})`);
          } else if (s.name) {
            setActiveShift(s.name);
          }
        }
        const incomingStatus =
          data.meta.status ||
          data.meta.connection_status ||
          data.meta.connection;
        if (incomingStatus) {
          setLiveStatus(incomingStatus);
        }
      }

      // 2. KPIs
      if (data.kpis) {
        setRawKpiData(data.kpis);
      }

      // 2a. HFTPY — its own top-level block, on fiscal-period grain.
      // `!== undefined` rather than truthiness: the block is legitimately null
      // when the production day falls outside every loaded fiscal period, and
      // that must clear a stale value rather than leave the last one on screen.
      if (data.hftpy !== undefined) {
        setHftpyBlock(data.hftpy);
      }

      // 2b. Shop Floor Conditions — temperature and humidity from the BMS trend
      // workbook, hourly. `shop_floor` is the block the backend publishes;
      // `shop_floor_conditions` is a fallback for any older payload.
      //
      // `!== undefined`, and nulls are NOT coalesced to the previous value: the
      // block is null when the workbook has no reading for today, and the header
      // must then show N/A rather than yesterday's temperature as current.
      if (data.shop_floor !== undefined) {
        const sf = data.shop_floor;
        setShopFloorConditions({
          temp: isNum(sf?.temp_c) ? sf.temp_c : null,
          humidity: isNum(sf?.humidity_pct) ? sf.humidity_pct : null,
        });
        setShopFloorHour(isNum(sf?.hour_of_day) ? sf.hour_of_day : null);
      } else if (data.shop_floor_conditions) {
        const sfc = data.shop_floor_conditions;
        setShopFloorConditions((prev) => ({
          temp: sfc.temp ?? sfc.temperature ?? prev.temp,
          humidity: sfc.humidity ?? prev.humidity,
        }));
      }

      // 3. Process Performance
      if (data.process_performance) {
        setRawProcessPerformance(data.process_performance);
      }

      // 4. Factory Quality Twin — DISABLED: zones are hardcoded to "healthy"
      //    in zones.ts until live API data is verified. Re-enable by uncommenting.
      /*
      if (data.factory_twin && Array.isArray(data.factory_twin.zones)) {
        setTwinZones((prev) => {
          return prev.map((zone) => {
            const incoming = data.factory_twin.zones.find((z: any) => {
              const zStation = z.station
                .replace(/[^a-zA-Z]/g, "")
                .toUpperCase();
              const zoneId = zone.id.replace(/[^a-zA-Z]/g, "").toUpperCase();
              return zStation === zoneId;
            });
            if (incoming) {
              const dayData = incoming.day || {};
              const yieldPct = dayData.yield_pct;
              const expected = incoming.inputs_expected ?? 0;
              const present = incoming.inputs_present ?? 0;
              const baseDesc =
                zone.id === "smt" ? "SMT placement lines 1–4"
                : zone.id === "mft" ? "Module function test"
                : zone.id === "thermalgel" ? "Thermal gel dispense"
                : zone.id === "rfm" ? "RF module calibration"
                : zone.id === "testing" ? "Functional test"
                : zone.id === "packaging" ? "Final pack & label"
                : "";
              const detailStr = `${baseDesc} · Yield: ${yieldPct != null ? `${yieldPct.toFixed(1)}%` : "N/A"} · Inputs: ${present}/${expected} steps`;
              return {
                ...zone,
                status: mapStatus(dayData.status ?? incoming.status),
                score: yieldPct != null ? Math.round(yieldPct) : 0,
                detail: detailStr,
              };
            }
            return zone;
          });
        });
      }
      */

      // 5. Product Yield - Handled by separate REST API polling now

      // 6. Attention Center Alerts
      //
      // The service publishes this as `attention`. `attention_center` was the
      // earlier key and is still read so the panel keeps rendering against a
      // backend that has not been redeployed.
      const attention = data.attention ?? data.attention_center;
      if (attention) {
        if (Array.isArray(attention.alerts)) {
          // entity_ref is not unique: the feed can carry two alerts for the same
          // product+station (different rules firing on it). That made two cards
          // share a React key, and React then kept stale cards across a tab
          // change — the Critical filter looked like it did nothing. Repeats get
          // an occurrence suffix, which stays stable while ordering is stable.
          const idSeen = new Map<string, number>();
          const mappedAlerts = attention.alerts.map((a: any, i: number) => {
            // Rows carry no `id`. entity_ref ("475767A.104|UNIT_PRESSURE_TEST_IN04")
            // is the stable identity of what the alert is about, so it survives
            // reordering between snapshots in a way an array index would not.
            // Undefined keys made React reuse the wrong card on every refresh.
            const baseId = a.id ?? a.entity_ref ?? `alert-${i}`;
            const seen = idSeen.get(baseId) ?? 0;
            idSeen.set(baseId, seen + 1);
            const id = seen === 0 ? baseId : `${baseId}#${seen}`;
            const unit = a.unit ?? a.value_unit ?? "";
            return {
              id,
              title: a.title,
              time: fmtAlertAge(a.age_minutes),
              current: fmtAlertValue(a.current_value ?? a.current, unit),
              target: fmtAlertValue(a.target_value ?? a.target, unit),
              dev: isNum(a.deviation)
                ? `${a.deviation >= 0 ? "+" : ""}${fmtAlertValue(a.deviation, unit)}`
                : "—",
              // The panel has two verdicts and the payload has three severities.
              // 'info' folds into Risk rather than being dropped — an alert the
              // backend raised must stay visible under some tab. Matched
              // case-insensitively: a payload sending "Critical" instead of
              // "critical" would otherwise file every alert under Risk and leave
              // the Critical tab permanently empty.
              level:
                String(a.severity).toLowerCase() === "critical"
                  ? "Critical"
                  : "Risk",
              // Guarded: a null impact used to throw inside this handler, which
              // aborted the whole snapshot — KPIs and process performance went
              // stale too, with nothing on screen to say why.
              impact:
                typeof a.impact === "string" && a.impact
                  ? a.impact.charAt(0).toUpperCase() + a.impact.slice(1)
                  : "—",
              rec: a.ai_recommendation,
            };
          });
          setAttentionCenterAlerts(mappedAlerts);
        } else {
          setAttentionCenterAlerts([]);
        }
        // `attention.counts` ({ critical, risk, info }) is deliberately not read.
        // It is the uncapped server-side tally, while the list it ships with is
        // capped (`truncated`) — so the two disagree. Every count now on screen
        // is derived from the alerts actually loaded, so it always matches the
        // rows you can open. Read counts again only if the UI needs to state a
        // plant-wide total it cannot enumerate.
      }

      // 7. Safety
      if (data.safety) {
        if (data.safety.accident !== undefined) {
          setSafetyAccident(data.safety.accident.value);
          setAccidentPoints((prev) => {
            if (prev.length === 3) {
              const next = [...prev];
              next[2] = data.safety.accident.value;
              return next;
            }
            return data.safety.accident.trend || prev;
          });
        }
        if (data.safety.near_miss !== undefined) {
          setSafetyNearMiss(data.safety.near_miss.value);
          setNearMissPoints((prev) => {
            if (prev.length === 3) {
              const next = [...prev];
              next[2] = data.safety.near_miss.value;
              return next;
            }
            return data.safety.near_miss.trend || prev;
          });
        }
      }

      // 8. Sustainability
      if (data.sustainability) {
        if (data.sustainability.green_energy_pct !== undefined)
          setGreenEnergyPct(data.sustainability.green_energy_pct.value);
        if (data.sustainability.co2_emission_tco2 !== undefined) {
          const co2 = data.sustainability.co2_emission_tco2;
          // Rounded to whole tonnes for display: the workbook carries four
          // decimals (1133.2099) which is false precision on a card this size.
          setCo2Emission(isNum(co2.value) ? Math.round(co2.value) : 0);
          // Nulls survive into the series on purpose — an unreported period must
          // read as a gap, not as zero emissions.
          if (co2.trend) setCo2Points(co2.trend);
          if (co2.trend_labels) setCo2Labels(co2.trend_labels);
        }
      }

      // 9. Customer Reflection / Complaints
      if (data.customer_complaints) {
        const cc = data.customer_complaints;
        setCustomerComplaintsCount(cc.total ?? cc.latest?.count ?? 0);
        if (Array.isArray(cc.months)) {
          setCustomerComplaintsPoints(cc.months.map((m: any) => m.count ?? 0));
          setComplaintsXTicks(cc.months.map(monthPeriodLabel));
        }
      } else if (data.customer_reflection) {
        if (data.customer_reflection.incidents !== undefined) {
          setCustomerComplaintsCount(data.customer_reflection.incidents.value);
          if (Array.isArray(data.customer_reflection.incidents.trend)) {
            setCustomerComplaintsPoints(
              data.customer_reflection.incidents.trend,
            );
          } else {
            setCustomerComplaintsPoints((prev) => {
              const val = data.customer_reflection.incidents.value;
              if (prev.length === 0) return [val, val, val];
              const next = [...prev];
              next[next.length - 1] = val;
              return next;
            });
          }
        }
        if (data.customer_reflection.eri_pct !== undefined)
          setCustomerEri(data.customer_reflection.eri_pct.value);
      }
      if (data.eri) {
        setEriData(data.eri);
        if (data.eri.eri_pct !== undefined && data.eri.eri_pct !== null) {
          setCustomerEri(data.eri.eri_pct);
        }
      }

      // 10. CI — Lean Savings + No. of Kaizen for the last completed month.
      // Both gauges plot the absolute figure on a 0..best-month arc rather than a
      // percentage: no target for either metric exists in any Nokia workbook, so
      // there is nothing to take a percentage of. The moment targets are agreed
      // and set in the backend env, `target` arrives non-null and targetLabel
      // starts rendering — no change needed here.
      if (data.ci) {
        const metrics = data.ci.metrics || data.ci;
        // if (data.ci.month_label) setCiMonthLabel(data.ci.month_label);
        if (metrics.lean_savings) {
          setCiLeanSavings(
            toCiMetric(
              metrics.lean_savings,
              metrics.lean_savings.currency === "EUR" ? "€" : "",
            ),
          );
        }
        if (metrics.kaizen) {
          setCiKaizen(toCiMetric(metrics.kaizen, ""));
        }
        // Month-by-month series for the savings line chart.
        if (Array.isArray(data.ci.months)) {
          setCiMonths(data.ci.months);
        }
      }
    };

    es.addEventListener("snapshot", (e) => {
      try {
        const parsed = JSON.parse(e.data);
        handleData(parsed);
      } catch (err) {
        console.error("Error parsing snapshot event", err);
      }
    });

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        // `attention` is listed too: an alerts-only delta carries neither kpis
        // nor meta, and was being discarded here before it reached handleData.
        if (
          parsed.kpis ||
          parsed.meta ||
          parsed.attention ||
          parsed.attention_center
        ) {
          handleData(parsed);
        }
      } catch (err) {
        // ignore
      }
    };

    es.onopen = () => {
      setLiveStatus("ONLINE");
    };

    es.onerror = (err) => {
      console.error("SSE connection error", err);
      setLiveStatus("OFFLINE");
      // Only surfaced when the alert list is empty; EventSource retries on its
      // own, and a later snapshot flips this back to "ready".
      setAlertsFeedState("error");
    };

    return () => {
      es.close();
    };
  }, []);

  // Update KPI cards when active shift or raw KPI data changes
  useEffect(() => {
    if (!rawKpiData) return;

    setKpiCards((prev) => {
      return prev.map((card) => {
        // HFTPY is handled first and separately: it is the only card with TWO
        // headline numbers (actual and projection), it comes from its own
        // top-level block rather than from `kpis`, and it is on fiscal-period
        // grain so the shift selector must not touch it.
        if (card.id === 9) {
          if (!hftpyBlock) return card;
          const actual = hftpyBlock.actual_pct;
          const projection = hftpyBlock.projection_pct;
          return {
            ...card,
            // A period with no qualifying products yields a null actual. Shown as
            // an em dash rather than 0.0%, which would read as "every product
            // missed" instead of "not enough volume to judge yet".
            value: isNum(actual) ? `${actual.toFixed(1)}%` : "—",
            projectedValue: isNum(projection)
              ? `${projection.toFixed(1)}%`
              : "—",
            // Against the projection, not against yesterday: HFTPY is a
            // period-to-date figure and there is no meaningful day-over-day move.
            change: isNum(hftpyBlock.delta_vs_projection)
              ? `${hftpyBlock.delta_vs_projection > 0 ? "+" : ""}${hftpyBlock.delta_vs_projection.toFixed(1)}% vs proj`
              : "",
            delta_vs_yesterday: hftpyBlock.delta_vs_projection ?? 0,
            // `points` is left alone: card 9 renders no sparkline
            // (`card.id !== 9 && renderFullSparkline(...)`), and the block carries
            // no period series to plot even if it did.
          };
        }

        const keyMap: Record<number, string> = {
          1: "fpy_unit",
          2: "spy_unit",
          3: "fpy_module",
          4: "spy_module",
          5: "customer_audit",
        };
        const sseKey = keyMap[card.id];
        if (!sseKey) return card;

        let val: number | null = null;
        let delta: number = 0;
        let trend: (number | null)[] | null = null;
        let yesterdayPoints: (number | null)[] | null = null;

        // Parse active shift name (e.g., "Shift A (06:15 AM - 02:15 PM)" -> "A")
        const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
        const shiftLetter = shiftMatch ? shiftMatch[1].toUpperCase() : null;

        const isShiftSpecificKpi = [
          "fpy_unit",
          "spy_unit",
          "fpy_module",
          "spy_module",
        ].includes(sseKey);

        // Resolve delta and trend from parent if available
        if (
          rawKpiData.delta_vs_yesterday &&
          rawKpiData.delta_vs_yesterday[sseKey] !== undefined
        ) {
          delta = rawKpiData.delta_vs_yesterday[sseKey] ?? 0;
        }

        if (rawKpiData.trend && Array.isArray(rawKpiData.trend.buckets)) {
          trend = rawKpiData.trend.buckets.map(
            (b: any) => b.today?.[sseKey] ?? null,
          );
          yesterdayPoints = rawKpiData.trend.buckets.map(
            (b: any) => b.yesterday?.[sseKey] ?? null,
          );
        }

        if (isShiftSpecificKpi && rawKpiData.by_shift && shiftLetter) {
          // New format with by_shift array
          const shiftData = rawKpiData.by_shift.find(
            (s: any) => s.shift && s.shift.toUpperCase() === shiftLetter,
          );
          if (
            shiftData &&
            shiftData[sseKey] !== undefined &&
            shiftData[sseKey] !== null
          ) {
            val = shiftData[sseKey];
            if (
              shiftData.delta_vs_yesterday !== undefined &&
              shiftData.delta_vs_yesterday !== null
            ) {
              delta = shiftData.delta_vs_yesterday;
            }
          } else {
            // Shift C or missing shift has no data -> set to 0
            val = 0;
            delta = 0;
            trend = null;
            yesterdayPoints = null;
          }
        }

        // Fall back to day-level KPIs if KPI is not shift-specific or shift-specific was not resolved
        if (val === null) {
          if (rawKpiData.day) {
            const dayItem = rawKpiData.day[sseKey];
            if (dayItem !== undefined && dayItem !== null) {
              val = typeof dayItem === "object" ? dayItem.value : dayItem;
              if (
                rawKpiData.delta_vs_yesterday &&
                rawKpiData.delta_vs_yesterday[sseKey] !== undefined
              ) {
                delta = rawKpiData.delta_vs_yesterday[sseKey] ?? 0;
              } else {
                delta =
                  typeof dayItem === "object" ? dayItem.delta_vs_yesterday : 0;
              }
              if (typeof dayItem === "object" && dayItem.trend) {
                trend = dayItem.trend;
              }
            }
          } else if (Array.isArray(rawKpiData)) {
            // Support legacy array format
            const incoming = rawKpiData.find((k: any) => k && k.key === sseKey);
            if (incoming) {
              val = typeof incoming === "object" ? incoming.value : incoming;
              delta =
                typeof incoming === "object" ? incoming.delta_vs_yesterday : 0;
              trend = typeof incoming === "object" ? incoming.trend : null;
            }
          } else if (typeof rawKpiData === "object") {
            // Support flat object format
            const incoming = rawKpiData[sseKey];
            if (incoming !== undefined && incoming !== null) {
              val = typeof incoming === "object" ? incoming.value : incoming;
              delta =
                typeof incoming === "object" ? incoming.delta_vs_yesterday : 0;
              trend = typeof incoming === "object" ? incoming.trend : null;
            }
          }
        }

        if (isNum(val)) {
          const deltaSign = delta >= 0 ? "▲" : "▼";
          const changeStr =
            typeof delta === "number"
              ? `${deltaSign} ${Math.abs(delta).toFixed(1)}% vs Yesterday`
              : card.change;

          return {
            ...card,
            value: `${val.toFixed(1)}%`,
            change: changeStr,
            points: trend || card.points,
            yesterdayPoints: yesterdayPoints || card.yesterdayPoints,
            delta_vs_yesterday: delta,
          };
        }

        return card;
      });
    });
    // hftpyBlock is a dependency because card 9 reads it. Without it the card
    // would only refresh when some OTHER kpi changed, which is the kind of stale
    // cell that gets blamed on the backend.
  }, [activeShift, rawKpiData, hftpyBlock]);

  // Update process performance cards when active shift or raw process performance data changes
  useEffect(() => {
    if (!rawProcessPerformance) return;

    // Parse active shift name (e.g., "Shift A (06:15 AM - 02:15 PM)" -> "A")
    const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
    const shiftLetter = shiftMatch ? shiftMatch[1].toUpperCase() : null;

    setProcessPerformance((prev) => {
      return prev.map((prevItem) => {
        const apiKey =
          API_KEY_BY_TILE[prevItem.name] ?? prevItem.name.replace(/\s+/g, "_");
        const incoming = rawProcessPerformance[apiKey];
        // Attach the hourly series once, here, so every branch below inherits it
        // through its `...item` spread. Set to null when the API sends no trend
        // (SPI has no hourly source) so the sparkline draws nothing rather than
        // falling back to the seeded placeholder points.
        //
        // DPMOI's series is keyed `dpmo`, not `yield_pct` — it is an index, not a
        // rate. getProcessTrendData reads trend.metric to pick the key, so no
        // special case is needed here, but the y-axis is defects-per-million and
        // lower is better, the opposite of every other card on the row.
        const item = { ...prevItem, trend: incoming?.trend ?? null };
        if (incoming) {
          const target = incoming.target !== undefined ? incoming.target : null;
          const targetUnit = incoming.target_unit || null;
          const targetDirection = incoming.target_direction || null;

          // The step is configured but produced nothing for this business day —
          // burn-in is a sample test that only runs in bursts, so an empty day is
          // normal. Show a dash, NOT "0.00%": nothing was tested, so a zero would
          // read as total failure and colour the tile red for no reason.
          if (incoming.no_data) {
            return {
              ...item,
              data:
                item.type === "yield"
                  ? { done: "0", ok: "0", yield: "—" }
                  : item.type === "dpmo"
                    ? { defects: "0", opportunities: "0", index: "—" }
                    : { failure: "—" },
              status: "Not Run",
              color: "#0091ff",
              target,
              targetUnit,
              targetDirection,
            };
          }

          if (item.name === "DPMOI") {
            const actual = incoming.index;
            let meets = null;
            if (target !== null && targetDirection && isNum(actual)) {
              meets =
                targetDirection === "lower"
                  ? actual <= target
                  : actual >= target;
            }

            // Binary, as on every other Process Performance card: DPMOI either
            // sits at or under its target index or it does not. The old amber
            // band (missed the target but still under 10) is what made 2.04
            // against a target of 2 look like a warning instead of a miss.
            const passing =
              meets !== null ? meets : isNum(actual) && actual <= 10;
            const statusMapped = passing ? "Healthy" : "Critical";
            const colorMapped = passing ? "#22c55e" : "#ff4c4c";

            return {
              ...item,
              data: {
                defects: fmtCount(incoming.defects),
                opportunities: fmtCount(incoming.opportunities),
                index: fmtFixed(incoming.index, 2),
              },
              status: statusMapped,
              color: colorMapped,
              target,
              targetUnit,
              targetDirection,
            };
          }

          // Fetch the active shift data if shiftLetter is set, else use daily rollup
          let targetData = null;

          if (shiftLetter) {
            if (incoming.by_shift) {
              targetData = incoming.by_shift.find(
                (s: any) => s.shift && s.shift.toUpperCase() === shiftLetter,
              );
            }
          } else {
            targetData = incoming.day;
          }

          if (targetData) {
            const actual = isNum(targetData.yield_pct)
              ? targetData.yield_pct
              : isNum(targetData.failure_pct)
                ? targetData.failure_pct
                : null;

            let meets = null;
            if (target !== null && targetDirection && isNum(actual)) {
              if (targetDirection === "higher") {
                meets = actual >= target;
              } else if (targetDirection === "lower") {
                meets = actual <= target;
              }
            }

            // Binary: the target is either held or missed. The amber "At Risk"
            // middle state is gone — it was applied when a card missed its target
            // but the gold thresholds happened to call it at_risk, which made a
            // genuine miss (DPMOI 2.04 against a target of 2, AUTO OGI 96.86
            // against 100) read as a warning rather than a failure.
            //
            // Cards with no agreed target (SPI, AXI, Manual OGI) have nothing to
            // breach, so they fall back to the gold status — and that too is
            // collapsed to pass/fail rather than carrying its own amber.
            const passing =
              meets !== null ? meets : targetData.status === "healthy";
            const statusMapped = passing ? "Healthy" : "Critical";
            const colorMapped = passing ? "#22c55e" : "#ff4c4c";

            if (isNum(targetData.failure_pct)) {
              return {
                ...item,
                data: { failure: `${targetData.failure_pct.toFixed(1)}%` },
                // The unformatted figure, kept alongside the display string so a
                // consumer needing a number does not parse "4.2%" back apart.
                actual,
                status: statusMapped,
                color: colorMapped,
                target,
                targetUnit,
                targetDirection,
              };
            } else {
              return {
                ...item,
                data: {
                  done: fmtCount(targetData.done),
                  ok: fmtCount(targetData.ok),
                  yield: isNum(targetData.yield_pct)
                    ? `${targetData.yield_pct.toFixed(2)}%`
                    : "...",
                },
                actual,
                status: statusMapped,
                color: colorMapped,
                target,
                targetUnit,
                targetDirection,
              };
            }
          } else {
            // Default empty state for shifts with no data recorded
            return {
              ...item,
              data:
                item.type === "yield"
                  ? { done: "0", ok: "0", yield: "0.00%" }
                  : { failure: "0.0%" },
              status: "N/A",
              color: "#0091ff",
              target,
              targetUnit,
              targetDirection,
            };
          }
        } else {
          // Default empty state when key is completely missing from API
          return {
            ...item,
            data:
              item.type === "yield"
                ? { done: "...", ok: "...", yield: "..." }
                : item.type === "dpmo"
                  ? { defects: "...", opportunities: "...", index: "..." }
                  : { failure: "..." },
            status: "N/A",
            color: "#0091ff",
          };
        }
        return item;
      });
    });
  }, [activeShift, rawProcessPerformance]);

  // Derive heat-map zone statuses from live process-performance / KPI cards.
  //
  // Three zones are graded on DISTANCE FROM TARGET (gradeAgainstTarget): each
  // card is green when it holds its target, amber when it misses by less than
  // its band, red beyond that — and the zone takes its worst card, so one bad
  // step is enough to turn it red.
  //
  //   smt        ← processPerformance: SPI, DPMOI, AXI - S, SMT DEFECTS @ MFT
  //   mft        ← kpiCards: FPY - MODULE (%), SPY - MODULE (%)
  //   thermalgel ← processPerformance: THERMAL AVI (UI label "THERMAL GEL AVI")
  //   rfm        ← processPerformance: every card whose section is "RFM"
  //   packaging  ← kpiCards: CUSTOMER QUALITY AUDIT (%)
  //
  // One still counts how many cards failed outright, with no regard for the size
  // of the miss:
  //
  //   testing    ← kpiCards: FPY UNIT + SPY UNIT
  //     0 red → healthy | 1 red → warning | both red → critical
  //
  // Ungradeable cards — no target agreed, or nothing ran this shift — are
  // skipped rather than counted as passes. A zone with nothing left to grade
  // reports "unknown" (grey) instead of an unearned green.
  useEffect(() => {
    // The old pass/fail helpers that read each card's `status` string are gone.
    // Every process-performance zone now grades on distance from target, which
    // needs the raw actual and target rather than the binary verdict the status
    // string had already collapsed them into. The KPI-driven zones that still
    // count reds keep their own helper below.

    // ── kpiCards helper ─────────────────────────────────────────────────────
    // Mirrors the same red/green decision the card renderer makes:
    // if a target exists → red when actual < target; otherwise → red when
    // delta_vs_yesterday < 0 (trending down).
    const isKpiRed = (label: string): boolean => {
      const card = kpiCards.find((k) => k.label === label);
      if (!card) return false;
      const target = (card as any).target as number | null | undefined;
      const actual = Number.parseFloat(
        String(card.value).replace(/[^\d.-]/g, ""),
      );
      if (isNum(target) && Number.isFinite(actual)) {
        return actual < target; // below target → red
      }
      return (card.delta_vs_yesterday ?? 0) < 0; // trending down → red
    };

    // ── SMT zone — 4 process-performance cards ──────────────────────────────
    // Graded by distance from target (see gradeAgainstTarget), not by counting
    // how many cards failed: a single card more than its band below target puts
    // the zone red on its own. The other zones still use the count rule below.
    const SMT_CARD_NAMES = ["SPI", "DPMOI", "AXI - S", "SMT DEFECTS @ MFT"];
    const smtCards = processPerformance.filter((p) =>
      SMT_CARD_NAMES.includes(p.name),
    );
    const smtZoneStatus = bandedZoneStatus(smtCards);

    // ── Thermal Gel zone — 1 process-performance card ───────────────────────
    // Same grading as SMT and MFT. A single card, so its own grade is the zone's
    // — which means this zone can now show amber, where the old rule only ever
    // gave it green or red. THERMAL AVI is a higher-is-better yield, so it uses
    // the 5-point band.
    const thermalCard = processPerformance.filter(
      (p) => p.name === "THERMAL AVI",
    );
    const thermalZoneStatus = bandedZoneStatus(thermalCard);

    // ── Testing zone — 2 KPI cards (FPY UNIT + SPY UNIT) ───────────────────
    const testingRedCount = [
      isKpiRed("FPY - UNIT (%)"),
      isKpiRed("SPY - UNIT (%)"),
    ].filter(Boolean).length;
    const testingZoneStatus: "healthy" | "warning" | "critical" =
      testingRedCount === 0
        ? "healthy"
        : testingRedCount === 1
          ? "warning"
          : "critical";

    // ── MFT zone — 2 KPI cards (FPY MODULE + SPY MODULE) ────────────────────
    // Same distance-from-target grading as SMT, replacing the red-count rule.
    // Both are higher-is-better yields with real targets (90 and 96), so these
    // are the cards the 5-point band actually applies to:
    //   FPY MODULE  ≥90 green · 85–89 yellow · ≤84 red
    //   SPY MODULE  ≥96 green · 91–95 yellow · ≤90 red
    const mftZoneStatus = zoneStatusFromGrades(
      ["FPY - MODULE (%)", "SPY - MODULE (%)"].map((label) =>
        kpiCardGrade(kpiCards.find((k) => k.label === label)),
      ),
    );

    // ── RFM zone — every process-performance card the payload files under RFM ─
    // This zone was previously never assigned a status at all: it fell through
    // the map below untouched and kept the seed "healthy" from zones.ts, so it
    // showed green however the RF steps were actually running.
    //
    // Membership is read from each card's own `section` rather than a name list,
    // so a card added to the RFM section starts counting without a change here.
    // That includes THERMAL AVI, which also drives the thermalgel zone — the
    // data files it under RFM and the strip's RFM span opens on it, so it is
    // deliberately counted in both rather than carved out.
    const rfmCards = processPerformance.filter((p) => p.section === "RFM");
    const rfmZoneStatus = bandedZoneStatus(rfmCards);

    // ── Packaging zone — 1 KPI card (CUSTOMER QUALITY AUDIT) ───────────────
    // Same grading as the zones above. Note the target here is 100, so the band
    // sits entirely below a clean audit:
    //   100 green · 95–99 yellow · ≤94 red
    // Under the old rule any shortfall at all went straight to red; a single
    // failed unit out of a hundred now reads as a warning instead.
    const packagingZoneStatus = zoneStatusFromGrades([
      kpiCardGrade(
        kpiCards.find((k) => k.label === "CUSTOMER QUALITY AUDIT (%)"),
      ),
    ]);

    setTwinZones((prev) =>
      prev.map((zone) => {
        if (zone.id === "smt") return { ...zone, status: smtZoneStatus };
        if (zone.id === "thermalgel")
          return { ...zone, status: thermalZoneStatus };
        if (zone.id === "testing")
          return { ...zone, status: testingZoneStatus };
        if (zone.id === "mft") return { ...zone, status: mftZoneStatus };
        if (zone.id === "rfm") return { ...zone, status: rfmZoneStatus };
        if (zone.id === "packaging")
          return { ...zone, status: packagingZoneStatus };
        return zone;
      }),
    );
  }, [processPerformance, kpiCards]);

  // Keep clock running
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString("en-US", { hour12: false }));
      setDateStr(
        d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navigateToHome = () => navigate("/");

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const renderFullSparkline = (
    points: (number | null)[],
    yesterdayPoints: (number | null)[] | undefined,
    strokeColor: string,
    target?: number | null,
  ) => {
    const width = 160;
    const height = 16;
    const padding = 2;
    const chartHeight = height - padding * 2;

    const allValids = [...points, ...(yesterdayPoints || [])].filter(
      (v): v is number => typeof v === "number",
    );
    if (allValids.length === 0) return null;

    // With a target, the axis is a FIXED BAND CENTRED ON THE TARGET rather than a
    // fit to the data, so the gap between the line and the dashed target line is
    // proportional to the size of the miss — and comparable between cards. Fitting
    // to min/max stretched whatever spread existed to the full height, which made
    // a 0.1-point miss look identical to a 5-point one.
    //
    // The band is a tenth of the target, widened to hold any outlier (plus 15%
    // headroom) so a bad hour is never clipped flat against the edge.
    let min: number;
    let max: number;
    if (isNum(target)) {
      const worstMiss = Math.max(...allValids.map((v) => Math.abs(v - target)));
      const band = Math.max(
        Math.abs(target) * 0.1,
        worstMiss * 1.15,
        Math.abs(target) * 0.01 || 0.01,
      );
      min = target - band;
      max = target + band;
    } else {
      max = Math.max(...allValids);
      min = Math.min(...allValids);
    }
    const range = max - min || 1;

    const yFor = (p: number) =>
      height - padding - ((p - min) / range) * (chartHeight * 0.95);

    const getSvgPoints = (arr: (number | null)[]) => {
      return arr
        .map((p, i) => {
          if (p === null || p === undefined) return null;
          const x = (i / (arr.length - 1)) * width;
          // Scale to 95% of the sparkline height to make changes sharp and clear
          return `${x},${yFor(p)}`;
        })
        .filter((val) => val !== null)
        .join(" ");
    };

    const targetY = isNum(target) ? yFor(target) : null;

    const todayPointsStr = getSvgPoints(points);
    const yesterdayPointsStr = yesterdayPoints
      ? getSvgPoints(yesterdayPoints)
      : "";

    // Find the last valid point to place the blinking/glowing indicator
    let lastIdx = -1;
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i] !== null && points[i] !== undefined) {
        lastIdx = i;
        break;
      }
    }
    const lastVal = lastIdx !== -1 ? points[lastIdx] : null;
    let lastPointCoord = null;
    if (lastIdx !== -1 && lastVal !== null) {
      const x = (lastIdx / (points.length - 1)) * width;
      lastPointCoord = { x, y: yFor(lastVal) };
    }

    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <style>
          {`
            @keyframes drawSparkline {
              0% { stroke-dasharray: 0 500; opacity: 0; }
              20% { opacity: 1; }
              100% { stroke-dasharray: 500 500; opacity: 1; }
            }
            .animate-sparkline {
              animation: drawSparkline 1.5s ease-out forwards;
            }
            @keyframes pulseGlow {
              0% {
                transform: scale(0.9);
                opacity: 0.45;
              }
              50% {
                transform: scale(1.25);
                opacity: 0.9;
              }
              100% {
                transform: scale(0.9);
                opacity: 0.45;
              }
            }
            .animate-pulse-glow {
              animation: pulseGlow 1.5s infinite ease-in-out;
            }
          `}
        </style>

        {/* Target line — the grey dashed horizontal reference. This REPLACES the
            old dashed yesterday-trend line, which was the same grey and was being
            read as the target. Nothing is lost: the vs-Yesterday comparison is
            already stated in words under the value, and in a 16px-tall chart three
            overlaid lines were unreadable anyway. */}
        {targetY !== null && Number.isFinite(targetY) && (
          <line
            x1="0"
            y1={targetY}
            x2={width}
            y2={targetY}
            stroke="#8fa0b5"
            strokeWidth="0.4"
            strokeDasharray="3 2"
            className="opacity-70"
          />
        )}
        {/* Yesterday's trend, only when there is no target to anchor to — so a
            targetless card still has something to compare against. */}
        {targetY === null && yesterdayPointsStr && (
          <polyline
            fill="none"
            stroke="#63788f"
            strokeWidth="0.4"
            strokeDasharray="2 2"
            points={yesterdayPointsStr}
            className="opacity-45 animate-sparkline"
          />
        )}
        {/* Today's trend background glow line */}
        {todayPointsStr && (
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.0"
            points={todayPointsStr}
            className="opacity-15 animate-sparkline"
            style={{
              filter: `drop-shadow(0 0 1.5px ${strokeColor})`,
            }}
          />
        )}
        {/* Today's trend (solid, colored) */}
        {todayPointsStr && (
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.5"
            points={todayPointsStr}
            className="opacity-95 animate-sparkline"
          />
        )}
        {/* Blinking glowing dot at the end of today's trend */}
        {lastPointCoord && (
          <>
            {/* Outer glowing pulsing circle */}
            <circle
              cx={lastPointCoord.x}
              cy={lastPointCoord.y}
              r="1.2"
              fill={strokeColor}
              className="animate-pulse-glow"
              style={{
                transformOrigin: `${lastPointCoord.x}px ${lastPointCoord.y}px`,
                filter: `drop-shadow(0 0 0.8px ${strokeColor})`,
              }}
            />
            {/* Inner solid core dot */}
            <circle
              cx={lastPointCoord.x}
              cy={lastPointCoord.y}
              r="0.6"
              fill="#ffffff"
              stroke={strokeColor}
              strokeWidth="0.4"
            />
          </>
        )}
      </svg>
    );
  };

  const getKpiIcon = (id: number, color: string, size = 18) => {
    const props = { size, className: "flex-shrink-0", style: { color } };
    switch (id) {
      case 1: // FPY - UNIT
        return <CheckCircle2 {...props} />;
      case 2: // SPY - UNIT
        return <ShieldCheck {...props} />;
      case 3: // FPY - MODULE
        return <CheckCircle2 {...props} />;
      case 4: // SPY - MODULE
        return <Zap {...props} />;
      case 5: // CUSTOMER AUDIT
        return <UserCheck {...props} />;
      case 6:
        return <ClipboardList {...props} />;
      case 7:
        return <RotateCcw {...props} />;
      case 8:
        return <Brain {...props} />;
      case 9: // HFTPY
        return <Target {...props} />;
      default:
        return null;
    }
  };

  // How far into the selected window production has actually reached, measured
  // from the DATA rather than the clock: the highest bucket any real card has a
  // value for, plus one.
  //
  // Deliberately not `new Date()`. That would need the 06:15 IST day anchor
  // replicated in the browser's timezone, and it would keep drawing through an
  // hour in which the plant produced nothing. Reading it off the cards that do
  // have a source means the placeholder stops exactly where the measured lines
  // stop, which is the only way the two can look consistent side by side.
  const elapsedBucketCount = React.useMemo(() => {
    let last = -1;
    for (const card of processPerformance) {
      const { points } = getProcessTrendData((card as any).trend, activeShift);
      for (let i = points.length - 1; i >= 0; i--) {
        if (isNum(points[i])) {
          if (i > last) last = i;
          break;
        }
      }
    }
    return last + 1;
  }, [processPerformance, activeShift]);

  const renderRedesignedCard = (metricName: string, customTitle?: string) => {
    const procItem = processPerformance.find(
      (p) =>
        p.name === metricName ||
        (metricName === "AXI" && p.name === "AXI - S") ||
        (metricName === "THERMAL GEL AVI" && p.name === "THERMAL AVI") ||
        (metricName === "SCREW DEFECT" && p.name === "SCREW DEFECTS") ||
        (metricName === "BURN-IN" && p.name === "BURN-IN - S") ||
        (metricName === "LBTS" && p.name === "LBTS - S"),
    );

    if (procItem) {
      const displayTitle = customTitle || metricName;
      // Green / amber / red on distance from target — the same grading the heat
      // map uses, so a tile and its zone always agree. `red` is the hard fail
      // that pulses; amber is a miss inside the band and stays still.
      const { color: cardColor, red: cardIsRed } = cardVerdict(procItem);
      const { points } = getProcessTrendData(procItem.trend, activeShift);

      // SPI ONLY. Its payload carries the 24-bucket scaffold but no values,
      // because there is no hourly source behind it — so this is the one card on
      // the strip with an empty plot area. Fill it with an illustrative line
      // centred on the real day figure the API sent.
      //
      // Gated on there being fewer than two real points, so the moment a genuine
      // hourly series appears for SPI the measured line wins automatically and
      // this stops running without anyone having to remember to remove it.
      const useSample =
        procItem.name === "SPI" &&
        points.filter((v) => isNum(v)).length < 2 &&
        isNum((procItem as any).actual);
      const plotPoints = useSample
        ? synthesiseSampleTrend(
            (procItem as any).actual as number,
            points.length || 24,
            elapsedBucketCount,
          )
        : points;

      // The step produced nothing in the selected window. Two ways that happens,
      // and both are normal rather than a fault:
      //
      //   "Not Run" — the API sent no_data for the whole day. Burn-in and OTA are
      //               sample tests that run in bursts, so an empty day is expected.
      //   "N/A"     — the day has rows but this SHIFT has none yet.
      //
      // Worth distinguishing from a real zero, because the two placeholders these
      // states used to render both misinformed: a dash reads as a broken feed, and
      // "0.00%" reads as total failure and colours the tile red for a step that
      // simply did not run.
      const hasNoProduction =
        procItem.status === "Not Run" || procItem.status === "N/A";

      // Mart step for this tile, resolved through the SAME map the payload lookup
      // uses. Deriving it from the label instead would send "SMT_DEFECTS_@_MFT"
      // and "BURN-IN" to the endpoint — the exact mistake API_KEY_BY_TILE exists
      // to prevent, and here it would 404 rather than render "..." forever.
      const drillStep =
        API_KEY_BY_TILE[procItem.name] ??
        procItem.name.replace(/\s+/g, "_");
      // A step with no per-product breakdown, or one that produced nothing, is
      // left inert: opening a modal onto "No production" is a dead end, and a
      // pointer cursor on a tile that does nothing is worse than no affordance.
      const canDrill =
        Boolean(DRILLDOWN_STEPS[drillStep]) && !hasNoProduction;
      const openDrilldown = () =>
        setDrilldownCard({ step: drillStep, title: displayTitle });

      return (
        <div
          className={`relative border rounded-lg p-1 2xl:p-2 pb-1 flex flex-col h-[112px] 2xl:h-[131px] transition-all duration-300 flex-1 min-w-0 ${
            cardIsRed ? "animate-border-pulse-critical" : ""
          } ${
            canDrill
              ? "cursor-pointer hover:brightness-125 focus-visible:outline-2 focus-visible:outline-[#3b82f6]"
              : ""
          }`}
          onClick={canDrill ? openDrilldown : undefined}
          // Keyboard parity with the mouse: the strip is on a wall display driven
          // by a keyboard as often as a mouse, and a div with onClick alone is
          // unreachable without one.
          role={canDrill ? "button" : undefined}
          tabIndex={canDrill ? 0 : undefined}
          aria-label={
            canDrill ? `${displayTitle} — view yield by product` : undefined
          }
          onKeyDown={
            canDrill
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDrilldown();
                  }
                }
              : undefined
          }
          style={{
            background: `linear-gradient(180deg, ${cardColor}1f 0%, ${cardColor}0a 100%), #101c2b`,
            borderColor: cardIsRed ? undefined : `${cardColor}40`,
            boxShadow: cardIsRed ? undefined : `0 4px 12px ${cardColor}15`,
          }}
        >
          <div className="flex items-start gap-1 mb-0.5 2xl:mb-1.5 flex-shrink-0">
            <procItem.icon
              size={10}
              className="text-white flex-shrink-0 mt-[1px] 2xl:size-[12px]"
            />
            <span
              className={`text-white font-bold uppercase leading-tight tracking-wider whitespace-nowrap ${
                displayTitle.length > 15
                  ? "text-[7.5px] 2xl:text-[10px]"
                  : "text-[9.5px] 2xl:text-[12px]"
              }`}
            >
              {displayTitle}
            </span>
          </div>

          <div className="flex-grow flex flex-col justify-center items-center min-h-0 -mt-1.5 2xl:-mt-2">
            {/* The unit caption is suppressed when nothing ran: announcing
                "Yield %" above "No production" stacks two greys and states a
                unit for a figure that does not exist. */}
            {!hasNoProduction && (
              <span className="text-[#8fa0b5] text-[9px] 2xl:text-[11px] leading-none uppercase">
                {procItem.type === "yield" && "Yield %"}
                {procItem.type === "dpmo" && "Index"}
                {procItem.type === "failure" && "Failure %"}
              </span>
            )}
            {hasNoProduction ? (
              <span className="text-[#8fa0b5] text-[10px] 2xl:text-[12px] font-bold leading-tight text-center">
                No production
              </span>
            ) : (
              <span
                className="text-[16px] 2xl:text-[20px] font-black mt-1.5 2xl:mt-2 font-mono leading-none"
                style={{
                  color: cardColor,
                  textShadow: `0 0 8px ${cardColor}30`,
                }}
              >
                {procItem.type === "yield" && procItem.data.yield}
                {procItem.type === "dpmo" && procItem.data.index}
                {procItem.type === "failure" && procItem.data.failure}
              </span>
            )}
          </div>

          <div className="h-[22px] 2xl:h-[28px] w-full flex-shrink-0 mt-auto mb-1 2xl:mb-1.5 overflow-visible relative">
            <Sparkline
              points={plotPoints}
              type={procItem.type}
              color={cardColor}
              target={procItem.target}
              targetDirection={procItem.targetDirection}
              synthetic={useSample}
            />
          </div>

          {isNum(procItem.target) && (
            <span className="absolute bottom-1 right-1.5 2xl:right-2 text-[#63788f] text-[7.5px] 2xl:text-[9px] font-bold leading-none pointer-events-none">
              Tgt {procItem.target}
              {procItem.targetUnit === "percent" ? "%" : ""}
            </span>
          )}
        </div>
      );
    }

    const kpiItem = kpiCards.find(
      (k) =>
        k.label === metricName ||
        (metricName === "FPY MODULE" && k.label === "FPY - MODULE (%)") ||
        (metricName === "SPY MODULE" && k.label === "SPY - MODULE (%)") ||
        (metricName === "FPY UNIT" && k.label === "FPY - UNIT (%)") ||
        (metricName === "SPY UNIT" && k.label === "SPY - UNIT (%)") ||
        (metricName === "CUSTOMER" &&
          k.label === "CUSTOMER QUALITY AUDIT (%)") ||
        (metricName === "UNITHFTPY" && k.label === "UNIT-HFTPY (%)"),
    );

    if (kpiItem) {
      const displayTitle = customTitle || metricName;
      // Still needed below for the sparkline's target line and the "Tgt" caption.
      const target = (kpiItem as any).target as number | null | undefined;

      // Same green / amber / red band as the process cards, and the same call the
      // heat map makes for this card — FPY MODULE next to SPI is not scored on a
      // different rule just because its figure arrives from kpiCards, and the tile
      // cannot end up a different colour from the zone it feeds.
      const kpiGrade = kpiCardGrade(kpiItem);
      const trendColor =
        kpiGrade === "unknown"
          ? kpiItem.color || "#8fa0b5"
          : GRADE_CSS[kpiGrade];

      const deltaColor = "#8fa0b5";

      return (
        <div
          key={kpiItem.id}
          className="relative border rounded-lg p-1 2xl:p-2 pb-1 flex flex-col h-[112px] 2xl:h-[131px] transition-all duration-300 flex-1 min-w-0"
          style={{
            background: `linear-gradient(180deg, ${trendColor}1f 0%, ${trendColor}0a 100%), #101c2b`,
            borderColor: `${trendColor}40`,
            boxShadow: `0 4px 12px ${trendColor}15`,
          }}
        >
          <div className="flex items-start gap-1 mb-0.5 2xl:mb-1.5 flex-shrink-0">
            {getKpiIcon(kpiItem.id, trendColor, 10)}
            <span className="text-white text-[9.5px] 2xl:text-[12px] uppercase font-bold tracking-wider leading-tight">
              {displayTitle}
            </span>
          </div>

          <div className="flex-grow flex flex-col justify-center items-center min-h-0 -mt-1.5 2xl:-mt-2">
            <span className="text-[#8fa0b5] text-[9px] 2xl:text-[11px] leading-none uppercase">
              Yield %
            </span>
            <span
              className="text-[16px] 2xl:text-[20px] font-black mt-1 font-mono leading-none"
              style={{
                color: trendColor,
                textShadow: `0 0 8px ${trendColor}40`,
              }}
            >
              {kpiItem.value}
            </span>
            <span
              className="text-[7.5px] 2xl:text-[9.5px] font-bold mt-1 leading-none"
              style={{ color: deltaColor }}
            >
              {kpiItem.change}
            </span>
          </div>

          <div className="h-[22px] 2xl:h-[28px] w-full flex-shrink-0 mt-auto mb-1 2xl:mb-1.5 overflow-hidden relative">
            {kpiItem.id !== 9 &&
              renderFullSparkline(
                kpiItem.points,
                kpiItem.yesterdayPoints,
                trendColor,
                target,
              )}
          </div>

          {isNum(target) && (
            <span className="absolute bottom-1 right-1.5 2xl:right-2 text-[#63788f] text-[7.5px] 2xl:text-[9px] font-bold leading-none pointer-events-none">
              Tgt {target}%
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  const renderLargeKpiCard = (metricName: string, customTitle?: string) => {
    const kpiItem = kpiCards.find(
      (k) =>
        k.label === metricName ||
        (metricName === "CUSTOMER" &&
          k.label === "CUSTOMER QUALITY AUDIT (%)") ||
        (metricName === "UNITHFTPY" && k.label === "UNIT-HFTPY (%)"),
    );

    if (!kpiItem) return null;

    const displayTitle = customTitle || metricName;
    // Still needed for the "Tgt" caption at the foot of the card.
    const target = (kpiItem as any).target as number | null | undefined;

    // The same green / amber / red band every other tile is scored on, via the
    // same helper the medium KPI cards and the heat map use: target met is green,
    // missed but within 5 points is amber, missed by more is red.
    //
    // This card was the last one still on a bare pass-fail, which is why HFTPY at
    // 66.7 against a target of 71 painted the same red as a card at 40 would —
    // a 4.3-point near miss reading as an outright failure. Routed through
    // kpiCardGrade rather than banded here so UNIT-HFTPY cannot end up a
    // different colour from the identical figure shown elsewhere.
    const kpiGrade = kpiCardGrade(kpiItem);
    const trendColor =
      kpiGrade === "unknown" ? kpiItem.color || "#8fa0b5" : GRADE_CSS[kpiGrade];

    const deltaColor = "#8fa0b5";

    return (
      <div
        key={kpiItem.id}
        className="flex-1 bg-[#0b131e] border rounded-xl p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
        style={{
          boxShadow: `0 4px 12px ${trendColor}10`,
          borderColor: `${trendColor}30`,
        }}
      >
        <div className="flex items-center gap-2 z-10">
          {getKpiIcon(kpiItem.id, trendColor, 15)}
          <span className="text-white text-[11px] 2xl:text-[13px] uppercase font-black tracking-wider leading-tight">
            {displayTitle}
          </span>
        </div>

        <div className="flex-grow flex flex-col justify-center mt-2 z-10 mb-4">
          {kpiItem.id === 9 ? (
            <div className="flex items-baseline gap-2 justify-between">
              <span
                className="text-[26px] 2xl:text-[32px] font-black font-mono leading-none"
                style={{
                  color: trendColor,
                  textShadow: `0 0 8px ${trendColor}40`,
                }}
              >
                {kpiItem.value}
              </span>
              <span className="text-[#8fa0b5] text-[9.5px] font-bold uppercase leading-none">
                Cur
              </span>
              <span
                className="text-[#3fd3c6] text-[18px] 2xl:text-[22px] font-black font-mono ml-auto leading-none"
                style={{ textShadow: `0 0 6px rgba(63,211,198,0.3)` }}
                title={
                  hftpyBlock?.projection_is_hardcoded
                    ? "Projection is a fixed constant, not a computed forecast"
                    : undefined
                }
              >
                {kpiItem.projectedValue || "—"}
              </span>
              <span className="text-[#8fa0b5] text-[9.5px] font-bold uppercase leading-none">
                Proj
              </span>
            </div>
          ) : (
            <span
              className="text-[30px] 2xl:text-[36px] font-black font-mono leading-none"
              style={{
                color: trendColor,
                textShadow: `0 0 8px ${trendColor}40`,
              }}
            >
              {kpiItem.value}
            </span>
          )}

          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span
              className="text-[11px] 2xl:text-[12.5px] font-bold"
              style={{ color: deltaColor }}
            >
              {kpiItem.change}
            </span>
            {isNum(target) && (
              <span className="text-[#63788f] text-[9.5px] 2xl:text-[11px] font-bold ml-auto whitespace-nowrap">
                Tgt {target}%
              </span>
            )}
          </div>
        </div>

        <div className="absolute bottom-[2px] left-0 right-0 h-[22px] pointer-events-none opacity-85">
          {kpiItem.id !== 9 &&
            renderFullSparkline(
              kpiItem.points,
              kpiItem.yesterdayPoints,
              trendColor,
              target,
            )}
        </div>
      </div>
    );
  };

  const isStatusLive = ["LIVE", "ONLINE", "CONNECTED", "ACTIVE"].includes(
    liveStatus.toUpperCase(),
  );

  const getYTicks = (points: number[], defaultMax: number) => {
    const max = Math.max(defaultMax, ...points);
    const ticks = [];
    for (let i = 4; i >= 0; i--) {
      ticks.push(Math.round((max / 4) * i));
    }
    return Array.from(new Set(ticks));
  };
  const incidentYTicks = getYTicks(accidentPoints, 4);
  // Savings plotted in THOUSANDS of euros. SafetyChart labels its y-axis with
  // String(tick), so raw euros would render "2360000" and the label column would
  // eat the plot area. The axis caption says K€ so the unit is not implied.
  const ciSavingsPoints = React.useMemo(
    () =>
      ciMonths.map((m) => (isNum(m.lean_savings) ? m.lean_savings / 1000 : 0)),
    [ciMonths],
  );
  // Four descending ticks (SafetyChart wants max first), rounded out to a
  // readable step so the peak month sits inside the plot rather than on its edge.
  const ciSavingsYTicks = React.useMemo(() => {
    const max = Math.max(1, ...ciSavingsPoints);
    const step = Math.max(100, Math.ceil(max / 3 / 100) * 100);
    return [3, 2, 1, 0].map((i) => i * step);
  }, [ciSavingsPoints]);
  // Kaizen is a plain count, so it plots unscaled — no K/M division needed.
  // P01..P12 rather than Jan..Dec, matching every other month-wise axis on the
  // dashboard. Shared by the savings and Kaizen charts, so they can never
  // disagree about which period a point belongs to. See monthPeriodLabel for why
  // the label is nominal: the CI figures are calendar-month sums.
  const ciMonthTicks = React.useMemo(
    () => ciMonths.map(monthPeriodLabel),
    [ciMonths],
  );
  const ciKaizenPoints = React.useMemo(
    () => ciMonths.map((m) => (isNum(m.kaizen) ? m.kaizen : 0)),
    [ciMonths],
  );
  const ciKaizenYTicks = React.useMemo(() => {
    const max = Math.max(1, ...ciKaizenPoints);
    // Step of 50 rather than 100: the count sits in the low hundreds, so a
    // coarser step would flatten the whole series into the bottom third.
    const step = Math.max(50, Math.ceil(max / 3 / 50) * 50);
    return [3, 2, 1, 0].map((i) => i * step);
  }, [ciKaizenPoints]);
  // Green when at or under target, red when over. Safety was hardcoded red, so a
  // clean period rendered a red "0" and a red trend line — the card looked like
  // an alarm for the best possible result. The headline and its chart take the
  // same colour so the two can never disagree.
  const incidentColor =
    safetyAccident > safetyTargets.incident ? "#ff4c4c" : "#22c55e";
  const nearMissColor =
    safetyNearMiss > safetyTargets.nearMiss ? "#ff4c4c" : "#22c55e";
  const nearMissYTicks = getYTicks(nearMissPoints, 5);
  const customerComplaintsYTicks = getYTicks(customerComplaintsPoints, 4);

  return (
    <div className="w-full min-h-screen bg-[#030810] text-[#f8fafc] flex flex-col p-4 box-border gap-4 font-sans select-none">
      {/* Top Branding & SubHeader Row */}
      <header className="flex flex-col lg:flex-row justify-between items-center bg-[#101c2b] border border-[#1c3149] rounded-xl px-3.5 py-1.5 gap-3">
        {/* Left Side Branding.
            shrink-0: this is a fixed-width identity block, and without it the
            flex row squeezed it at laptop widths until the title wrapped. The
            telemetry side already carries flex-wrap, so that is what gives way
            when the header runs out of room — a widget dropping to a second line
            is far less jarring than the site name splitting in two. */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Nokia SVG Wordmark (White) */}
          <svg
            viewBox="0 0 238 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-[82px] h-auto cursor-pointer"
            onClick={navigateToHome}
          >
            <path
              d="M164.52 1.70304V54.2969H172.407V1.70304H164.52ZM80.2509 0.804622C64.8848 0.804553 52.9624 11.9886 52.9624 28C52.9624 44.7324 64.8848 55.1957 80.2509 55.1954C95.6171 55.1951 107.564 44.7324 107.539 28C107.517 12.8299 95.6171 0.804691 80.2509 0.804622ZM99.6661 28C99.6661 39.8532 90.9737 47.7084 80.2509 47.7084C69.5282 47.7084 60.8357 39.8532 60.8357 28C60.8357 16.3618 69.5282 8.29171 80.2509 8.29171C90.9737 8.29171 99.6661 16.3618 99.6661 28ZM0 4.74601e-06V54.2969H8.04989V18.4143L49.8817 56V44.7427L0 4.74601e-06ZM113.472 28L142.745 54.297H154.483L125.165 28L154.483 1.70302H142.745L113.472 28ZM238 54.2969H229.323L222.978 42.6502H194.239L187.893 54.2969H179.215L189.724 34.8846H218.851L204.327 7.90705L208.608 0L238 54.2969Z"
              fill="#ffffff"
            />
          </svg>

          {/* Vertical Separator Line */}
          <div className="h-8 w-[1px] bg-[#26405a] mx-1.5 self-center" />

          {/* One line, two weights. 'CHENNAI FACTORY' keeps the cyan the second
              line used to carry, so the site still reads as distinct from the
              product name without costing a row of header height.

              NO flex-wrap, and whitespace-nowrap on both: this is one title and
              it must never break. It was wrapping on 1366px laptops, which put
              'CHENNAI FACTORY' on its own line and reintroduced exactly the
              two-row header the single line was meant to replace.

              Sizes step down below xl so the whole thing fits a 1366px viewport
              without relying on the wrap it no longer has. */}
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] xl:text-[17px] font-black text-white leading-none tracking-wide whitespace-nowrap">
              QUALITY EXCELLENCE CENTER
            </span>
            <span className="text-[11px] xl:text-[12.5px] font-bold text-[#06b6d4] leading-none tracking-wider whitespace-nowrap">
              CHENNAI FACTORY
            </span>
          </div>
        </div>

        {/* Right Side Widgets / Telemetry.
            min-w-0 + justify-end: this is the side that absorbs a narrow header.
            Without min-w-0 a flex child refuses to shrink below its content, so
            the pressure went back onto the branding block and the title wrapped
            anyway despite its shrink-0. */}
        {/* flex-NOWRAP, not flex-wrap. Wrapping is what put the shift selector on
            a second row: the header is one strip and it must stay one strip, so
            width is reclaimed by hiding the least valuable items rather than by
            spilling onto a new line.

            What gets hidden, in order of what is least missed:
              * temp and humidity below 2xl — they are DUPLICATES of the SHOP
                FLOOR CONDITIONS card in the KPI row directly below, so nothing is
                actually lost;
              * the date below xl — the time stays, and nobody checks the year
                mid-shift.
            Each separator carries the same breakpoint as the item beside it, or
            it would leave a stray divider behind. */}
        <div className="flex items-center justify-end gap-2 xl:gap-3.5 flex-nowrap min-w-0 text-[#8fa0b5] font-mono text-[13px] xl:text-[14px]">
          <span className="hidden xl:inline text-[#63788f] whitespace-nowrap">
            {dateStr}
          </span>
          <span className="hidden xl:inline h-3.5 w-[1px] bg-[#1c3149]" />
          <span className="text-white font-bold whitespace-nowrap">
            {timeStr}
          </span>
          <span className="hidden 2xl:inline h-3.5 w-[1px] bg-[#1c3149]" />
          <div className="hidden 2xl:flex items-center gap-1 text-[#06b6d4]">
            <Thermometer size={14} className="text-[#06b6d4]" />
            <span
              className="text-white font-bold"
              title={
                shopFloorHour !== null
                  ? `Shop-floor temperature at ${String(shopFloorHour).padStart(2, "0")}:00 (BMS)`
                  : "No BMS reading available for today"
              }
            >
              {shopFloorConditions.temp !== null
                ? `${shopFloorConditions.temp.toFixed(1)}°C`
                : "N/A"}
            </span>
          </div>
          <span className="hidden 2xl:inline h-3.5 w-[1px] bg-[#1c3149]" />
          <div className="hidden 2xl:flex items-center gap-1 text-[#06b6d4]">
            <Droplets size={14} className="text-[#06b6d4]" />
            <span
              className="text-white font-bold"
              title={
                shopFloorHour !== null
                  ? `Shop-floor relative humidity at ${String(shopFloorHour).padStart(2, "0")}:00 (BMS)`
                  : "No BMS reading available for today"
              }
            >
              {shopFloorConditions.humidity !== null
                ? `${shopFloorConditions.humidity.toFixed(1)}%`
                : "N/A"}
            </span>
          </div>
          <span className="h-3.5 w-[1px] bg-[#1c3149]" />

          <div
            className={`flex items-center gap-1.5 border px-2.5 py-0.5 rounded text-[13px] font-black shrink-0 whitespace-nowrap ${
              isStatusLive
                ? "border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e]"
                : "border-[#ff4c4c]/30 bg-[#ff4c4c]/5 text-[#ff4c4c]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isStatusLive ? "bg-[#22c55e]" : "bg-[#ff4c4c]"}`}
            />
            {liveStatus}
          </div>

          <div className="relative">
            <div
              className="bg-[#101c2b] border border-[#26405a] rounded px-2.5 py-0.5 text-[13px] text-white font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#16253a] transition-colors shrink-0"
              onClick={() => setIsShiftDropdownOpen(!isShiftDropdownOpen)}
              title={activeShift}
            >
              {/* Two renderings of one value. Below xl only the name shows
                  ('Full Day'); the time window is the widest thing in this strip
                  at ~30 characters, and it is the same fixed window every day. The
                  full label stays in the tooltip and in the open dropdown. */}
              <span className="hidden xl:inline whitespace-nowrap">
                {activeShift}
              </span>
              <span className="xl:hidden whitespace-nowrap">
                {activeShift.split(" (")[0]}
              </span>
              <ChevronDown
                size={11}
                className={`text-[#63788f] transition-transform duration-200 ${isShiftDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>

            {isShiftDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsShiftDropdownOpen(false)}
                />
                <div className="absolute top-full right-0 mt-1 bg-[#101c2b] border border-[#26405a] rounded-lg shadow-xl shadow-black/50 overflow-hidden z-50 w-max">
                  {SHIFTS.map((shift) => (
                    <div
                      key={shift}
                      className={`px-3 py-2 text-[14px] cursor-pointer hover:bg-[#1e3a8a] hover:text-white transition-colors ${activeShift === shift ? "text-white bg-[#1c3149]" : "text-[#8fa0b5]"}`}
                      onClick={() => {
                        setActiveShift(shift);
                        setIsShiftDropdownOpen(false);
                      }}
                    >
                      {shift}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-[#16253a] rounded border border-[#26405a] cursor-pointer text-[#8fa0b5] outline-none"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </header>

      {/* Redesigned Process Performance & Overall Quality Row */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-3">
        {/* Left Section: 8x8 Box layout */}
        <div className="lg:col-span-3 bg-[#101c2b] border border-[#1c3149] rounded-xl p-4 flex flex-col">
          <div className="flex items-baseline gap-2 border-b border-[#1c3149]/50 pb-2 mb-3.5 flex-shrink-0">
            <span className="text-[12px] font-black tracking-widest text-[#8fa0b5] uppercase">
              PROCESS PERFORMANCE
            </span>
            <span className="text-[10px] font-bold tracking-wider text-[#63788f] normal-case">
              [Hourly]
            </span>
          </div>
          <div className="flex flex-col gap-3 flex-grow justify-between relative">
            {/* Bar + first 8 items kept in one wrapper so the outer column still
                has three children — it is justify-between, and a fourth child
                would redistribute the whole strip. */}
            <div className="flex flex-col gap-2">
              {/* Stage-group bar. Spans are in cards, and must add up to the
                  number of cards in the row below (4 + 2 + 2 = 8), or every cell
                  after the mismatch drifts out of alignment. */}
              <div
                className="flex items-center w-full flex-shrink-0 z-10"
                style={{ gap: PROCESS_CARD_GAP }}
              >
                <StageGroupBar span={4} label="SMT" />
                <StageGroupBar span={2} label="MFT" />
                {/* RFM opens here, above THERMAL GEL AVI and SCREW DEFECT, and
                    carries on into the band below — so this end stays open.
                    Labelled as well as the band, because a bare line sitting
                    beside a labelled MFT reads as an unnamed group rather than as
                    the start of the one named further down. */}
                <StageGroupBar span={2} label="RFM" endCap={false} />
              </div>

              <div
                className="flex items-center w-full z-10"
                style={{ gap: PROCESS_CARD_GAP }}
              >
                {renderRedesignedCard("SPI")}
                {renderRedesignedCard("DPMOI")}
                {renderRedesignedCard("AXI", "AXI")}
                {renderRedesignedCard("SMT DEFECTS @ MFT")}
                {renderRedesignedCard("FPY MODULE", "FPY MODULE")}
                {renderRedesignedCard("SPY MODULE", "SPY MODULE")}
                {renderRedesignedCard("THERMAL GEL AVI", "THERMAL GEL AVI")}
                {renderRedesignedCard("SCREW DEFECT", "SCREW DEFECT")}
              </div>
            </div>

            {/* RFM continues here and closes at AUTO OGI, the last card of row 2.
                span={8} is the full row, so this doubles as the divider the
                plain border used to draw. Its start stays open because the group
                already began above THERMAL GEL AVI. */}
            <div
              className="flex items-center w-full flex-shrink-0"
              style={{ gap: PROCESS_CARD_GAP }}
            >
              <StageGroupBar span={8} label="RFM" startCap={false} />
            </div>

            {/* Next 8 Items (Group 2) */}
            <div
              className="flex items-center w-full z-10"
              style={{ gap: PROCESS_CARD_GAP }}
            >
              {renderRedesignedCard("FPY UNIT", "FPY UNIT")}
              {renderRedesignedCard("SPY UNIT", "SPY UNIT")}
              {renderRedesignedCard("OTA")}
              {renderRedesignedCard("RTWP")}
              {renderRedesignedCard("BURN-IN", "BURN-IN")}
              {renderRedesignedCard("LBTS", "LBTS")}
              {renderRedesignedCard("IP")}
              {renderRedesignedCard("AUTO OGI")}
            </div>
          </div>
        </div>

        {/* Right Section: 1x1 Box layout */}
        <div className="lg:col-span-1 bg-[#101c2b] border border-[#1c3149] rounded-xl p-4 flex flex-col justify-between h-full min-h-[300px]">
          <span className="text-[12px] font-black tracking-widest text-[#8fa0b5] uppercase border-b border-[#1c3149]/50 pb-2 mb-3.5 flex-shrink-0">
            KEY PERFORMANCE INDICATOR
          </span>
          <div className="flex-grow flex flex-col gap-3.5">
            {renderLargeKpiCard("CUSTOMER", "CUSTOMER QUALITY AUDIT")}
            {renderLargeKpiCard("UNITHFTPY", "UNIT-HFTPY")}
          </div>
        </div>
      </section>

      {/* Row 3: Middle Analysis Hub */}
      <main className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.8fr)_minmax(0,5fr)_minmax(0,2.5fr)] gap-4">
        {/* Section 1: Factory Quality Twin */}
        <section className="bg-[#101c2b] border border-white/20 rounded-xl p-4 flex flex-col h-[380px]">
          <div className="flex items-center justify-between border-b border-[#1c3149]/50 pb-2 mb-3 flex-shrink-0">
            <span className="text-[12px] font-black tracking-widest text-[#8fa0b5]">
              QUALITY HEAT MAP
            </span>
            {/* Legend colors come from STATUS_CSS so the swatches always match
                the outlines drawn on the layout below. */}
            <div className="flex gap-3 text-[12px] font-bold">
              {(["healthy", "warning", "critical"] as const).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: STATUS_CSS[s],
                      boxShadow: `0 0 8px ${STATUS_CSS[s]}`,
                    }}
                  />{" "}
                  {STATUS_LABEL[s]}
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex-1 relative bg-[#030810] border border-white/15 rounded-lg overflow-hidden flex items-center justify-center group cursor-pointer"
            onClick={() => setIsTwinModalOpen(true)}
          >
            <FactoryLayoutOverlay
              zones={twinZones}
              variant="compact"
              className="transition-transform duration-500 ease-out group-hover:scale-105"
            />
            {/* Overlay Gradient / Glass effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#030810]/40 via-transparent to-transparent pointer-events-none" />

            {/* Hover overlay with explore button — commented out on request.
                The parent div keeps its onClick, so clicking the layout still
                opens the twin modal; only the hover prompt is hidden. */}
            {/* <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="bg-[#081119]/95 border border-[#06b6d4]/50 text-[#06b6d4] text-[11px] font-black tracking-widest px-3.5 py-2 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                <Maximize2 size={12} className="animate-pulse" />
                EXPLORE PLANT LAYOUT
              </div>
            </div> */}
          </div>
        </section>

        {/* Section 2: Product Yield */}
        <section className="bg-[#101c2b] border border-[#1c3149] rounded-xl p-4 flex flex-col h-[380px]">
          <span className="text-[12px] font-black tracking-widest text-[#8fa0b5] uppercase mb-1.5">
            PRODUCT YIELD
          </span>
          {/* Tabs */}
          <div className="flex gap-2 mb-1.5">
            <button
              onClick={() => setActiveYieldTab("UNITS")}
              className={`${activeYieldTab === "UNITS" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#030810] text-[#63788f] border-[#1c3149] hover:bg-[#1c3149]"} border text-[11px] font-bold px-4 py-1 rounded uppercase transition-colors`}
            >
              UNITS
            </button>
            <button
              onClick={() => setActiveYieldTab("TRX")}
              className={`${activeYieldTab === "TRX" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#030810] text-[#63788f] border-[#1c3149] hover:bg-[#1c3149]"} border text-[11px] font-bold px-4 py-1 rounded uppercase transition-colors`}
            >
              TRX
            </button>
            <button
              onClick={() => setActiveYieldTab("PA")}
              className={`${activeYieldTab === "PA" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#030810] text-[#63788f] border-[#1c3149] hover:bg-[#1c3149]"} border text-[11px] font-bold px-4 py-1 rounded uppercase transition-colors`}
            >
              PA
            </button>
          </div>

          {/* overflow-y-AUTO, not hidden. This container is flex-1 inside a fixed
              h-[400px] section, so with overflow-y-hidden any content taller than
              the box was silently clipped and unreachable — which is what happened
              once the AI Recommendation column started rendering a two-line JSON
              block and pushed the rows taller. */}
          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
            <table className="w-full min-w-[720px] text-left text-[12px] border-collapse relative">
              <thead>
                <tr className="text-[#63788f] font-bold text-[10px] uppercase">
                  <th className="pb-2 font-black pl-2 sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                    S.No
                  </th>
                  <th
                    onClick={() => {
                      setProductSort((prev) => {
                        if (prev.key !== "name")
                          return { key: "name", order: "asc" };
                        if (prev.order === "asc")
                          return { key: "name", order: "desc" };
                        return { key: null, order: "asc" };
                      });
                    }}
                    className="pb-2 font-black sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10 cursor-pointer select-none hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      PRODUCT NAME
                      <span
                        className={`text-[10px] font-black ${productSort.key === "name" ? "text-white" : "text-white/40"}`}
                      >
                        {productSort.key === "name" &&
                        productSort.order === "asc"
                          ? " ▲"
                          : productSort.key === "name" &&
                              productSort.order === "desc"
                            ? " ▼"
                            : " ↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      setProductSort((prev) => {
                        if (prev.key !== "tested")
                          return { key: "tested", order: "asc" };
                        if (prev.order === "asc")
                          return { key: "tested", order: "desc" };
                        return { key: null, order: "asc" };
                      });
                    }}
                    className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10 cursor-pointer select-none hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      TESTED
                      <span
                        className={`text-[10px] font-black ${productSort.key === "tested" ? "text-white" : "text-white/40"}`}
                      >
                        {productSort.key === "tested" &&
                        productSort.order === "asc"
                          ? " ▲"
                          : productSort.key === "tested" &&
                              productSort.order === "desc"
                            ? " ▼"
                            : " ↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      setProductSort((prev) => {
                        if (prev.key !== "failed")
                          return { key: "failed", order: "asc" };
                        if (prev.order === "asc")
                          return { key: "failed", order: "desc" };
                        return { key: null, order: "asc" };
                      });
                    }}
                    className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10 cursor-pointer select-none hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      FAILED COUNT
                      <span
                        className={`text-[10px] font-black ${productSort.key === "failed" ? "text-white" : "text-white/40"}`}
                      >
                        {productSort.key === "failed" &&
                        productSort.order === "asc"
                          ? " ▲"
                          : productSort.key === "failed" &&
                              productSort.order === "desc"
                            ? " ▼"
                            : " ↕"}
                      </span>
                    </div>
                  </th>
                  <th className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                    FPY %
                  </th>
                  {/* SPY % — hidden on request. Uncomment together with the
                      matching cell below (row.spy) and put the empty-state
                      colSpan back to 9. row.spy is still populated, so nothing
                      needs refetching to bring it back. */}
                  {/*
                  <th className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                    SPY %
                  </th>
                  */}
                  <th className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                    TARGET YIELD %
                  </th>
                  <th className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                    FPY STATUS
                  </th>
                  {/* Header stays plain. The period this column judges against
                      is carried by the cells themselves, which name it in the
                      empty state and in the tooltip. */}
                  {activeYieldTab === "UNITS" && (
                    <th className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                      AI RECOMMENDATION HFTPY
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c3149]/45 font-mono text-[11px]">
                {paginatedYieldData.length === 0 && (
                  <tr>
                    <td
                      colSpan={activeYieldTab === "UNITS" ? 8 : 7}
                      className="py-10 text-center font-sans text-[12px] font-bold tracking-wide"
                    >
                      {yieldFetchState === "loading" ? (
                        <span className="text-[#63788f]">Loading…</span>
                      ) : yieldFetchState === "error" ? (
                        <span className="text-[#eab308]">
                          Product yield unavailable — API unreachable
                        </span>
                      ) : (
                        <span className="text-[#63788f]">No records found</span>
                      )}
                    </td>
                  </tr>
                )}
                {paginatedYieldData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-[#101c2b]/40">
                    <td className="py-[2.5px] text-[#8fa0b5] pl-2">
                      {(yieldPage - 1) * ITEMS_PER_PAGE + idx + 1}.
                    </td>
                    <td className="py-[2.5px] text-white font-sans font-bold">
                      {row.name}
                    </td>
                    <td className="py-[2.5px] text-center text-white">
                      {row.tested}
                    </td>
                    <td className="py-[2.5px] text-center text-white">
                      {row.failed}
                    </td>
                    <td className="py-[2.5px] text-center font-bold">
                      <span
                        className={
                          // No target filed: neutral. Colouring it against a
                          // null target read as "below target" for every product
                          // whose target had not loaded.
                          // Green or red only — below target is a miss, not a
                          // warning. Amber made a product sitting under its agreed
                          // yield look tolerable.
                          !isNum(row.target)
                            ? "text-[#8fa0b5]"
                            : row.fpy >= row.target
                              ? "text-[#22c55e]"
                              : "text-[#ff4c4c]"
                        }
                      >
                        {row.fpy}%
                      </span>
                      {/* Sparkline icon next to it */}
                      <span className="ml-1 opacity-80 inline-block w-4 h-3 overflow-hidden align-middle mb-0.5">
                        <svg viewBox="0 0 20 10" className="w-full h-full">
                          <polyline
                            fill="none"
                            stroke={
                              !isNum(row.target)
                                ? "#8fa0b5"
                                : row.fpy >= row.target
                                  ? "#22c55e"
                                  : "#ff4c4c"
                            }
                            strokeWidth="1.5"
                            points={
                              // Flat when there is no target to compare against,
                              // rather than the falling shape a null comparison
                              // would otherwise select.
                              !isNum(row.target)
                                ? "0,6 5,6 10,6 15,6 20,6"
                                : row.fpy >= row.target
                                  ? "0,10 5,5 10,8 15,2 20,4"
                                  : "0,2 5,8 10,4 15,10 20,6"
                            }
                          />
                        </svg>
                      </span>
                    </td>
                    {/* SPY % — hidden, pairs with the commented header above. */}
                    {/*
                    <td className="py-[2.5px] text-center text-white font-bold">
                      {isNum(row.spy) ? `${row.spy.toFixed(1)}%` : "—"}
                    </td>
                    */}
                    <td className="py-[2.5px] text-center text-white">
                      {isNum(row.target) ? `${row.target}%` : "—"}
                    </td>
                    <td className="py-[2.5px] text-center">
                      <span
                        className={`text-[9.5px] font-black px-1.5 py-0.5 rounded border border-[#1c3149]/50 ${
                          row.status === "Healthy"
                            ? "bg-[#22c55e]/10 text-[#22c55e]"
                            : row.status === "No Target"
                              ? "bg-[#8fa0b5]/10 text-[#8fa0b5]"
                              : "bg-[#ff4c4c]/10 text-[#ff4c4c]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    {/* AI RECOMMENDATION HFTPY — UNITS tab only.
                        The recommendation is built from the HFTPY plan, which is
                        unit-level: TRX and PA take their target from Target
                        sheet.xlsx and have no planned quantity, so the column has
                        nothing to say about them. Hidden rather than deleted, and
                        the 262 lines below are untouched — flip the condition to
                        `true` to show it on every tab again. */}
                    {activeYieldTab === "UNITS" && (
                    <td className="py-[2.5px] text-center text-[#c8d6e4] font-sans text-[10px] leading-tight">
                      {(() => {
                        // Raw analysis JSON while the Azure OpenAI layer is
                        // unbuilt. Deliberately the exact fields the model will
                        // be handed, so the sentence it eventually returns can be
                        // checked against the numbers it was derived from.
                        //
                        // Only the yield-relevant fields are shown; product name
                        // and the echoed inputs are already columns in this table.
                        const yr = yieldRecommendations[row.name];
                        if (!yr) {
                          // Still fetching: a short note, not a field dump.
                          if (yieldRecsLoading) {
                            return (
                              <span className="text-[#63788f] italic animate-soft-pulse">
                                loading latest AI update…
                              </span>
                            );
                          }
                          // No period plan published. Only meaningful on the UNITS
                          // tab: TRX and PA take their target from Target
                          // sheet.xlsx and never needed the HFTPY plan, so telling
                          // a module row it is "awaiting P08 plan" would point at
                          // the wrong missing thing entirely.
                          if (
                            !yieldPlanStatus.available &&
                            activeYieldTab === "UNITS"
                          ) {
                            return (
                              <span
                                className="text-[#63788f] italic"
                                title={`No ${yieldPlanStatus.month ?? ""} sheet in HFTPY Plan.xlsx — add it to get period recommendations.`}
                              >
                                awaiting {yieldPlanStatus.month ?? "period"}{" "}
                                plan
                              </span>
                            );
                          }
                          // No recommendation for this product. The only remaining
                          // cause is that it has no target on file at any level.
                          //
                          // It used to print `row.rec` — the mart's own
                          // ai_recommendation column, which holds static seeded text.
                          // That put "Performance within expectations" beside
                          // SYS_ABIO_Mod.ASPE sitting at 0% yield. Stale placeholder
                          // prose reads exactly like a live judgement, so it is worse
                          // than an honest blank.
                          return (
                            <span
                              className="text-[#63788f] italic"
                              title={`No target on file for ${row.name}, so no recommendation can be computed. Add it to Target sheet.xlsx.`}
                            >
                              no target on file
                            </span>
                          );
                        }
                        // The raw-field `payload` object that used to live here is
                        // gone: it existed only to be JSON-dumped into a tooltip,
                        // and both tooltips now build a readable sentence from the
                        // same fields instead.

                        // TRX / PA take a different shape, because they have
                        // different data behind them. Target sheet.xlsx gives them a
                        // target percentage and NO planned quantity, so there is no
                        // remainder to divide by — required_future_yield,
                        // mathematical_status and achievability all come back null.
                        // Rendering the unit layout here would show four labels with
                        // three dashes.
                        //
                        // What they get instead needs no plan at all: how many
                        // consecutive passes would restore target, or how many more
                        // failures the current margin can absorb.
                        if (yr.product_level && yr.product_level !== "UNIT") {
                          const recover = yr.passes_to_recover;
                          const headroom = yr.failure_headroom;
                          const onTarget = isNum(headroom);
                          // A recovery larger than everything already built is
                          // arithmetically right and practically meaningless —
                          // AHEGHAPA Z needs 803 passes on 681 tested. Shown as a
                          // bound rather than a precise figure nobody will act on.
                          const hopeless =
                            isNum(recover) && recover > yr.tested_quantity;
                          const colour = onTarget ? "#22c55e" : "#ff4c4c";
                          return (
                            <div
                              className="flex flex-col gap-[1px] text-[9px] leading-[1.3] min-w-[110px]"
                              // Deterministic, built from the same fields the cell
                              // shows, so the two can never disagree. The generated
                              // prose used to sit here and claimed "No target yield
                              // available" beside a cell reading 95% — it was
                              // reporting the absent VERDICT as an absent TARGET.
                              title={
                                onTarget
                                  ? `${yr.product}: ${yr.tested_quantity.toLocaleString()} tested at ${isNum(yr.current_yield) ? (yr.current_yield * 100).toFixed(1) : "—"}%, above the ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% target. ${headroom.toLocaleString()} further failure(s) can be absorbed before it breaches.`
                                  : hopeless
                                    ? `${yr.product}: needs ${recover?.toLocaleString()} consecutive passes to reach the ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% target — more than the ${yr.tested_quantity.toLocaleString()} already built. Not recoverable this period.`
                                    : `${yr.product}: ${yr.tested_quantity.toLocaleString()} tested at ${isNum(yr.current_yield) ? (yr.current_yield * 100).toFixed(1) : "—"}%, below the ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% target. ${isNum(recover) ? recover.toLocaleString() : "—"} consecutive passes would restore it. No period plan exists for module products, so no feasibility verdict is given.`
                              }
                            >
                              <div className="flex justify-between gap-2">
                                <span className="text-[#63788f]">
                                  Yield / target
                                </span>
                                <span className="text-[#c8d6e4] font-bold tabular-nums">
                                  {isNum(yr.current_yield)
                                    ? `${(yr.current_yield * 100).toFixed(1)}%`
                                    : "—"}
                                  <span className="text-[#63788f]"> / </span>
                                  {isNum(yr.target_yield)
                                    ? `${(yr.target_yield * 100).toFixed(0)}%`
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-[#63788f]">Tested</span>
                                <span className="text-[#c8d6e4] font-bold tabular-nums">
                                  {yr.tested_quantity.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2 items-center mt-[1px]">
                                <span className="text-[#63788f]">
                                  {onTarget
                                    ? "Failures spare"
                                    : "Passes to recover"}
                                </span>
                                <span
                                  className="font-black px-1.5 py-[1px] rounded text-[8.5px] uppercase tracking-wide tabular-nums"
                                  style={{
                                    color: colour,
                                    backgroundColor: `${colour}1a`,
                                    border: `1px solid ${colour}55`,
                                  }}
                                  title={
                                    hopeless
                                      ? `Needs ${recover?.toLocaleString()} consecutive passes — more than the ${yr.tested_quantity.toLocaleString()} already built. Not recoverable this period.`
                                      : undefined
                                  }
                                >
                                  {onTarget
                                    ? headroom.toLocaleString()
                                    : hopeless
                                      ? `>${yr.tested_quantity.toLocaleString()}`
                                      : isNum(recover)
                                        ? recover.toLocaleString()
                                        : "n/a"}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        // Four labelled figures, not a paragraph. This column is
                        // read at a glance by people on the floor; a 50-word
                        // sentence is slower to parse than a number with a label
                        // beside it, however well written.
                        //
                        // Every value here is deterministic — planned and
                        // remaining come from the plan, expected yield and the
                        // verdict from the calculator — so nothing on screen waits
                        // on Azure. The generated prose is kept on the tooltip for
                        // whoever wants the reasoning behind the verdict.
                        // `achievability` is computed server-side and is NOT the
                        // same as `mathematical_status`. The status only answers
                        // "is this impossible?", and rendering that as a green
                        // ACHIEVABLE claimed far more than it proved: AHEC showed
                        // green while needing 92.5% from a product whose best full
                        // period on record is 88.1%, directly contradicting the
                        // figure printed above it.
                        //
                        // UNLIKELY is that case — arithmetically open, historically
                        // unprecedented — and it belongs on the red side.
                        const verdictLabel =
                          {
                            ACHIEVED: "Achieved",
                            ACHIEVABLE: "Achievable",
                            UNLIKELY: "Unlikely",
                            NOT_ACHIEVABLE: "Not achievable",
                          }[yr.achievability as string] ?? "—";
                        const achievable =
                          yr.achievability === "ACHIEVED" ||
                          yr.achievability === "ACHIEVABLE";
                        const verdictColor = achievable ? "#22c55e" : "#ff4c4c";
                        const unprecedented = yr.achievability === "UNLIKELY";

                        return (
                          <div
                            className="flex flex-col gap-[1px] text-[9px] leading-[1.3] min-w-[110px]"
                            // Deterministic, so it cannot contradict the cell. The
                            // generated prose is off (see AZURE_OPENAI_API_VERSION
                            // in .env) and a raw JSON dump was never a tooltip
                            // anyone could read. `recommendation` is still honoured
                            // first, so re-enabling the AI layer needs no change
                            // here.
                            title={
                              yr.recommendation ||
                              [
                                `${yr.product}: ${yr.tested_quantity.toLocaleString()} of ${isNum(yr.planned_quantity) ? yr.planned_quantity.toLocaleString() : "—"} planned units built at ${isNum(yr.current_yield) ? (yr.current_yield * 100).toFixed(1) : "—"}%, against a ${isNum(yr.target_yield) ? (yr.target_yield * 100).toFixed(0) : "—"}% period target.`,
                                isNum(yr.remaining_quantity) &&
                                isNum(yr.required_future_yield)
                                  ? `The remaining ${yr.remaining_quantity.toLocaleString()} units must average ${(yr.required_future_yield * 100).toFixed(1)}%.`
                                  : "No remaining quantity is known, so no required yield can be computed.",
                                unprecedented && isNum(yr.best_historical_yield)
                                  ? `That is above the best full period on record (${(yr.best_historical_yield * 100).toFixed(1)}%) — unprecedented for this product.`
                                  : isNum(yr.best_historical_yield)
                                    ? `Within the best full period on record (${(yr.best_historical_yield * 100).toFixed(1)}%).`
                                    : "No completed periods on record to compare against.",
                                `Maths: ${yr.mathematical_status ?? "n/a"} · History: ${yr.historical_status ?? "n/a"} · Verdict: ${yr.achievability ?? "n/a"}`,
                              ].join("\n")
                            }
                          >
                            {/* <div className="flex justify-between gap-2">
                              <span className="text-[#63788f]">
                                Total planned
                              </span>
                              <span className="text-[#c8d6e4] font-bold tabular-nums">
                                {isNum(yr.planned_quantity)
                                  ? yr.planned_quantity.toLocaleString()
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-[#63788f]">Remaining</span>
                              <span className="text-[#c8d6e4] font-bold tabular-nums">
                                {isNum(yr.remaining_quantity)
                                  ? yr.remaining_quantity.toLocaleString()
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-[#63788f]">
                                Expected yield
                              </span>
                              <span className="font-bold tabular-nums text-[#c8d6e4]">
                                {isNum(yr.required_future_yield)
                                  ? `${(yr.required_future_yield * 100).toFixed(1)}%`
                                  : "—"}
                                {unprecedented && (
                                  <span
                                    className="ml-0.5 text-[#ff4c4c]"
                                    title="Higher than this product's best full period on record"
                                  >
                                    *
                                  </span>
                                )}
                              </span>
                            </div> */}
                            <div className="flex items-center justify-center mt-[1px]">
                              <span
                                className="font-black px-1.5 py-[1px] rounded text-[8.5px] uppercase tracking-wide"
                                style={{
                                  color: verdictColor,
                                  backgroundColor: `${verdictColor}1a`,
                                  border: `1px solid ${verdictColor}55`,
                                }}
                              >
                                {verdictLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-end items-center gap-3 mt-1.5 pt-2 text-[11px] text-white border-t border-[#1c3149]">
            <span className="text-[#8fa0b5] font-bold">
              {Math.min(
                (yieldPage - 1) * ITEMS_PER_PAGE + 1,
                currentYieldData.length,
              )}{" "}
              - {Math.min(yieldPage * ITEMS_PER_PAGE, currentYieldData.length)}{" "}
              of {currentYieldData.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setYieldPage(1)}
                disabled={yieldPage === 1}
                className={`p-1 transition-colors ${yieldPage === 1 ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                onClick={() => setYieldPage(Math.max(1, yieldPage - 1))}
                disabled={yieldPage === 1}
                className={`p-1 transition-colors ${yieldPage === 1 ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
              >
                <ChevronLeft size={13} />
              </button>
              <button className="bg-[#1c3149] text-white font-bold w-4.5 h-4.5 rounded flex items-center justify-center text-[10px]">
                {yieldPage}
              </button>
              <button
                onClick={() =>
                  setYieldPage(Math.min(totalYieldPages, yieldPage + 1))
                }
                disabled={yieldPage === totalYieldPages}
                className={`p-1 transition-colors ${yieldPage === totalYieldPages ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setYieldPage(totalYieldPages)}
                disabled={yieldPage === totalYieldPages}
                className={`p-1 transition-colors ${yieldPage === totalYieldPages ? "text-[#63788f]/50 cursor-not-allowed" : "text-[#63788f] hover:text-white"}`}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Attention Center Alerts */}
        <section className="bg-[#101c2b] border border-[#1c3149] rounded-xl p-4 flex flex-col h-[380px]">
          <div className="flex items-center justify-between border-b border-[#1c3149]/50 pb-2 mb-2 flex-shrink-0">
            {/* No count badges here — the tab row directly below carries the
                same numbers per severity, so the badges were saying it twice. */}
            <span className="text-[12px] font-black tracking-widest text-[#8fa0b5] uppercase">
              ATTENTION CENTER
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-2 flex-shrink-0">
            {(["All", "Critical", "Risk"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveAlertTab(tab)}
                aria-pressed={activeAlertTab === tab}
                className={`${activeAlertTab === tab ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#030810] text-[#63788f] border-[#1c3149] hover:bg-[#1c3149] hover:text-[#8fa0b5]"} border text-[11px] font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5`}
              >
                {tab}
                <span
                  className={`${activeAlertTab === tab ? "bg-[#3b82f6]/30 text-white" : "bg-[#1c3149]/70 text-[#63788f]"} rounded px-1 font-mono text-[10px] leading-tight`}
                >
                  {alertTabCounts[tab]}
                </span>
              </button>
            ))}
          </div>

          {/* min-h-0 lets flex-1 actually bound this box so it scrolls; without
              it the cards would push the section taller instead. */}
          <div
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2"
            onScroll={() => recTip && setRecTip(null)}
          >
            {visibleAlerts.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-10 text-center text-[12px] font-bold tracking-wide">
                {alertsFeedState === "loading" ? (
                  <span className="text-[#63788f]">Loading…</span>
                ) : alertsFeedState === "error" ? (
                  <span className="text-[#eab308]">
                    Alerts unavailable — live feed disconnected
                  </span>
                ) : (
                  <span className="text-[#63788f]">No records found</span>
                )}
              </div>
            )}
            {previewAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`group flex-shrink-0 bg-gradient-to-b from-[#0b1520] to-[#070f17] border ${alert.level === "Critical" ? "animate-border-pulse-critical" : "border-[#eab308]/25 hover:border-[#eab308]/45"} rounded-lg pl-3 pr-2.5 py-2.5 relative flex flex-col gap-2 overflow-hidden transition-all duration-300`}
                style={{
                  boxShadow:
                    alert.level === "Critical"
                      ? undefined
                      : "0 0 15px rgba(234, 179, 8, 0.05)",
                }}
              >
                {/* Severity accent stripe */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{
                    background:
                      alert.level === "Critical"
                        ? "linear-gradient(180deg,#ff4c4c,rgba(255,76,76,0.15))"
                        : "linear-gradient(180deg,#eab308,rgba(234,179,8,0.15))",
                  }}
                />

                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Bell
                      size={13}
                      className={`mt-[2px] flex-shrink-0 ${
                        alert.level === "Critical"
                          ? "text-[#ff4c4c]"
                          : "text-[#eab308]"
                      }`}
                      fill={alert.level === "Critical" ? "#ff4c4c" : "#eab308"}
                      style={{
                        filter:
                          alert.level === "Critical"
                            ? "drop-shadow(0 0 8px #ff4c4c)"
                            : "drop-shadow(0 0 8px #eab308)",
                      }}
                    />
                    <span className="text-[12px] font-semibold leading-snug text-[#e8eef5]">
                      {alert.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] text-[#63788f] font-bold whitespace-nowrap flex-shrink-0 group-hover:text-[#8fa0b5] transition-colors">
                    {alert.time}
                    <ChevronRight size={11} />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[#5b6f87] text-[9px] uppercase tracking-wider font-bold">
                    Impact
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-[1px] rounded border ${
                      alert.level === "Critical"
                        ? "text-[#ff8080] border-[#ff4c4c]/30 bg-[#ff4c4c]/10"
                        : "text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10"
                    }`}
                  >
                    {alert.impact}
                  </span>
                </div>

                {/* The recommendation is clamped to two lines so every card is
                    the same height; the full text is on hover, in the portal
                    tooltip rendered at the end of this component. */}
                <div
                  className="mt-auto bg-[#4338ca]/[0.08] hover:bg-[#4338ca]/[0.14] border border-[#4338ca]/25 hover:border-[#4338ca]/45 rounded-md p-1.5 flex items-start gap-2 transition-colors cursor-default"
                  onMouseEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setRecTip({
                      text: alert.rec,
                      x: r.left + r.width / 2,
                      y: r.top,
                    });
                  }}
                  onMouseLeave={() => setRecTip(null)}
                >
                  <div className="bg-[#4f46e5] w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]">
                    <Bot size={11} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className="text-[#818cf8] text-[9px] font-black uppercase tracking-wider"
                      style={{ textShadow: "0 0 10px rgba(99,102,241,0.35)" }}
                    >
                      AI Recommendation
                    </span>
                    <span className="text-[#dfe5f0] text-[10.5px] font-semibold leading-snug mt-0.5 line-clamp-2">
                      {alert.rec}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Counted off the loaded alerts, not the server's `counts` tally: that
              tally is uncapped while the list it ships with is not, so it can
              promise more rows than the modal can actually show. */}
          <div className="flex justify-between items-center pt-2.5 mt-1 flex-shrink-0 border-t border-[#1c3149]/50">
            <span className="text-[10px] font-bold text-[#63788f]">
              {visibleAlerts.length > ALERT_PREVIEW_LIMIT
                ? `Showing ${ALERT_PREVIEW_LIMIT} of ${visibleAlerts.length}`
                : `Showing ${visibleAlerts.length}`}
            </span>
            <button
              onClick={() => setIsAlertsModalOpen(true)}
              disabled={visibleAlerts.length === 0}
              className="flex items-center gap-1 text-[10px] font-bold text-[#3b82f6] hover:text-white disabled:text-[#3b5069] disabled:cursor-not-allowed transition-colors"
            >
              View All Alerts
              <span className="bg-[#1e3a8a]/60 border border-[#3b82f6]/40 rounded px-1.5 py-[1px] font-mono">
                {visibleAlerts.length}
              </span>
              <ChevronRight size={11} />
            </button>
          </div>
        </section>
      </main>

      {/* Row 4: Bottom Operational KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4 mt-1.5">
        {/* Card 1: Safety */}
        <div className="bg-[#101c2b] border border-[#1c3149] rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-[#1c3149]/50 pb-1.5 flex-shrink-0">
            <Shield size={15} className="text-[#22c55e]" />
            <span className="text-[#8fa0b5] text-[12px] font-black uppercase tracking-wider">
              SAFETY
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 items-center min-h-0 pt-2">
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  INCIDENT
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span
                    className="text-[24px] font-black leading-none font-mono"
                    style={{ color: incidentColor }}
                  >
                    {safetyAccident}
                  </span>
                  <span className="text-[#63788f] text-[10px] font-bold">
                    This Month
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <SafetyChart
                  points={accidentPoints}
                  yTicks={incidentYTicks}
                  xTicks={safetyXTicks}
                  color={incidentColor}
                />
              </div>
            </div>

            <div className="flex flex-col h-full justify-between border-l border-[#1c3149]/30 pl-3">
              <div className="flex flex-col">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  NEAR MISS
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span
                    className="text-[24px] font-black leading-none font-mono"
                    style={{ color: nearMissColor }}
                  >
                    {safetyNearMiss}
                  </span>
                  <span className="text-[#63788f] text-[10px] font-bold">
                    This Month
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <SafetyChart
                  points={nearMissPoints}
                  yTicks={nearMissYTicks}
                  xTicks={safetyXTicks}
                  color={nearMissColor}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Sustainability */}
        <div className="bg-[#101c2b] border border-[#1c3149] rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          {/* Header */}
          <div className="flex items-center gap-1.5 border-b border-[#1c3149]/50 pb-1.5 flex-shrink-0">
            <Leaf size={15} className="text-[#22c55e]" />
            <span className="text-[#8fa0b5] text-[12px] font-black uppercase tracking-wider">
              SUSTAINABILITY
            </span>
          </div>

          {/* Body */}
          <div className="grid grid-cols-2 flex-1 min-h-0 pt-1.5">
            {/* Left */}
            <div className="flex flex-col pr-3 min-h-0">
              <div className="mb-1.5 -mt-1.5">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  GREEN ENERGY (%)
                </span>

                <div className="text-[#22c55e] text-[24px] font-black font-mono mt-1 leading-none">
                  {greenEnergyPct}%
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center min-h-0">
                <SemiCircleGauge
                  value={greenEnergyPct}
                  min={0}
                  max={100}
                  labelMin="0%"
                  labelMax="100%"
                  color="#22c55e"
                  icon={CustomSymmetricalLeafIcon}
                  showValueInCenter={false}
                />
              </div>
            </div>

            {/* Right */}
            <div className="flex flex-col border-l border-[#1c3149]/40 pl-3 min-h-0">
              <div className="mb-1.5 -mt-1.5">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  CO₂ EMISSION (tCO₂)
                </span>

                <div className="mt-1 flex items-baseline leading-none">
                  <span className="text-[#22c55e] text-[21px] font-black font-mono">
                    {co2Emission.toLocaleString()}
                  </span>
                  <span className="ml-1 text-[11px] text-[#8fa0b5]">tCO₂</span>
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-[55px] flex items-center">
                <div className="w-full h-full">
                  {/* y-ticks derived from the data, not hardcoded. The fixed
                      1000-1600 scale put the floor above P01 (747 tCO2) and P02
                      (835), so the two lowest periods sat off the bottom of the
                      chart and the line appeared to start mid-year. */}
                  <SafetyChart
                    points={co2Points}
                    yTicks={co2YTicks}
                    xTicks={co2Labels.length ? co2Labels : safetyXTicks}
                    color="#22c55e"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Customer Reflection */}
        <div className="bg-[#101c2b] border border-[#1c3149] rounded-xl pt-3 px-3 pb-[17px] flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-[#1c3149]/50 pb-1.5 flex-shrink-0">
            <Target size={15} className="text-[#22c55e]" />
            <span className="text-[#8fa0b5] text-[12px] font-black uppercase tracking-wider">
              CUSTOMER REFLECTION
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 items-center min-h-0 pt-2">
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  COMPLAINTS
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[#22c55e] text-[24px] font-black leading-none font-mono">
                    {customerComplaintsCount}
                  </span>
                  {/* "Overall", not "This Month". The figure is the payload's
                      `total` — the year-to-date sum across every reported month
                      (Jan-Aug = 12) — while this month is 1. The old label named
                      a different window from the number beside it. */}
                  <span className="text-[#63788f] text-[10px] font-bold font-sans">
                    Overall
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end pb-1.5">
                <SafetyChart
                  points={customerComplaintsPoints}
                  yTicks={customerComplaintsYTicks}
                  xTicks={
                    complaintsXTicks.length > 0
                      ? complaintsXTicks
                      : safetyXTicks
                  }
                  color="#22c55e"
                />
              </div>
            </div>

            <div className="flex flex-col h-full justify-between border-l border-[#1c3149]/30 pl-3">
              <div className="flex flex-col">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                    ERI (%)
                  </span>
                  {eriData && (
                    <span className="text-[#63788f] text-[9.5px] font-bold font-sans">
                      Target {eriData.target_pct}%
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span
                    className="text-[24px] font-black leading-none font-mono"
                    style={{
                      color:
                        eriData?.status === "healthy"
                          ? "#22c55e"
                          : eriData?.status === "critical"
                            ? "#ff4c4c"
                            : "#a855f7",
                    }}
                  >
                    {customerEri}%
                  </span>
                  {eriData && (
                    <span
                      className="text-[#63788f] text-[9px] font-bold font-sans truncate max-w-[50px]"
                      title={eriData.period}
                    >
                      {eriData.period_code || eriData.period}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center w-full mt-1 relative">
                <SemiCircleGauge
                  value={customerEri}
                  min={0}
                  max={Math.max(5, (eriData?.target_pct || 0) * 1.5)}
                  labelMin="0%"
                  labelMax={`${Math.max(5, (eriData?.target_pct || 0) * 1.5).toFixed(0)}%`}
                  color={
                    eriData?.status === "healthy"
                      ? "#22c55e"
                      : eriData?.status === "critical"
                        ? "#ff4c4c"
                        : "#a855f7"
                  }
                  icon={CustomEriIcon}
                  showValueInCenter={false}
                />
              </div>
              {eriData && (
                <div className="flex justify-between text-[9px] text-[#63788f] font-bold mt-0.5 pb-1.5 mb-3">
                  <span>Returns</span>
                  <span className="text-white font-mono">
                    {eriData.returns} / {eriData.deliveries}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: CI */}
        <div className="bg-[#101c2b] border border-[#1c3149] rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-[#1c3149]/50 pb-1.5 flex-shrink-0">
            <Trophy size={15} className="text-[#22c55e]" />
            <span className="text-[#8fa0b5] text-[12px] font-black uppercase tracking-wider">
              CI
            </span>
            {/* Which month the two figures describe — the card reports the last
                completed month, so leaving it unlabelled reads as "today". */}
            {ciMonthLabel && (
              <span className="text-[#63788f] text-[10px] font-bold ml-auto">
                {ciMonthLabel}
              </span>
            )}
          </div>
          {/* Two month-wise lines, one per metric — replacing the semi-circle
              gauges. A gauge needs a scale maximum, and with no agreed target in
              any workbook that maximum was the trailing year's best month, so the
              arc answered "this month against our best month" — a question nobody
              asked. The lines show the same figures without inventing a reference
              point, which is also why neither carries a target line.

              Value-over-caption layout matches the Safety card, so the two read
              the same way. "Last Month" rather than Safety's "This Month" because
              CI genuinely reports the last COMPLETED month: ideas are marked
              implemented throughout a month, so the running one would collapse to
              near-zero every 1st. */}
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 pt-2">
            <div className="flex flex-col h-full min-h-0">
              <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                Lean savings
                <span className="text-[#63788f] ml-1 normal-case">
                  (K&euro;)
                </span>
              </span>
              <div className="flex items-baseline gap-1.5 mt-1 mb-3">
                <span className="text-[#22c55e] text-[24px] font-black leading-none font-mono">
                  {fmtCompact(ciLeanSavings.value, "—")}
                </span>
                <span className="text-[#63788f] text-[10px] font-bold">
                  Last Month
                </span>
              </div>
              <div className="flex-1 min-h-[44px] flex items-center justify-center mt-1">
                <div className="w-full h-full">
                  <SafetyChart
                    points={ciSavingsPoints}
                    yTicks={ciSavingsYTicks}
                    xTicks={ciMonthTicks}
                    color="#22c55e"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col h-full min-h-0 border-l border-[#1c3149]/30 pl-3">
              <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                No. of Kaizen
              </span>
              <div className="flex items-baseline gap-1.5 mt-1 mb-3">
                <span className="text-[#22c55e] text-[24px] font-black leading-none font-mono">
                  {ciKaizen.achievedLabel}
                </span>
                <span className="text-[#63788f] text-[10px] font-bold">
                  Last Month
                </span>
              </div>
              <div className="flex-1 min-h-[44px] flex items-center justify-center mt-1">
                <div className="w-full h-full">
                  <SafetyChart
                    points={ciKaizenPoints}
                    yTicks={ciKaizenYTicks}
                    xTicks={ciMonthTicks}
                    color="#22c55e"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Per-product breakdown for a clicked Process Performance tile.
          Shift comes from the dashboard's own selector, so the modal opens on the
          same window the tile is reporting — "Full Day" maps to no shift filter,
          which is the whole production day. */}
      {drilldownCard && (
        <ProcessProductsModal
          step={drilldownCard.step}
          title={drilldownCard.title}
          shift={activeShift.match(/Shift\s+([A-C])/i)?.[1].toUpperCase() ?? null}
          onClose={() => setDrilldownCard(null)}
        />
      )}

      {/* 3D Digital Twin Fullscreen Modal */}
      {isTwinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 lg:p-8 transition-all duration-300">
          <div className="relative w-full h-full max-w-[95vw] max-h-[90vh] bg-[#101c2b] border border-[#1c3149] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-[#101c2b]/90 px-6 py-4 border-b border-[#1c3149] z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] animate-pulse" />
                <span className="text-[16px] font-black text-white uppercase tracking-wider">
                  Quality Plant Floor Layout
                </span>
                <div className="flex gap-3 text-[12px] font-bold text-[#8fa0b5] ml-4">
                  {(["healthy", "warning", "critical"] as const).map((s) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: STATUS_CSS[s],
                          boxShadow: `0 0 8px ${STATUS_CSS[s]}`,
                        }}
                      />
                      {STATUS_LABEL[s]}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setIsTwinModalOpen(false)}
                className="bg-[#16253a] hover:bg-[#ff4c4c] text-[#8fa0b5] hover:text-white border border-[#26405a] rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
              >
                ✕ Close view
              </button>
            </div>

            {/* Model Viewport */}
            <div className="flex-1 relative min-h-0 bg-[#030810] flex items-center justify-center p-4">
              <FactoryLayoutOverlay zones={twinZones} variant="full" />
            </div>
          </div>
        </div>
      )}

      {/* All alerts. The panel shows ALERT_PREVIEW_LIMIT compact cards; this is
          the full set as a table, which scans far better at this row count and
          fits each alert on a single row. */}
      {isAlertsModalOpen && (
        // Frosted glass, matching the Process Performance drill-down. The old
        // bg-black/85 blacked the dashboard out and read as a dark slab; a light
        // tint over a small blur keeps the strip visible behind as context. The
        // panel below gains the brighter border and deeper shadow that the heavy
        // dim used to provide.
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030810]/30 backdrop-blur-sm p-4 lg:p-8"
          onClick={() => setIsAlertsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-[1200px] max-h-[85vh] bg-[#101c2b]/95 border border-[#3a5a7d] rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-[#101c2b]/90 px-6 py-4 border-b border-[#1c3149] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff4c4c] animate-pulse" />
                <span className="text-[16px] font-black text-white uppercase tracking-wider">
                  Attention Center
                </span>
              </div>
              <button
                onClick={() => setIsAlertsModalOpen(false)}
                className="bg-[#16253a] hover:bg-[#ff4c4c] text-[#8fa0b5] hover:text-white border border-[#26405a] rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
              >
                ✕ Close
              </button>
            </div>

            {/* Filter row — shares activeAlertTab with the panel, so the tab you
                pick here is still applied when the modal closes. */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#1c3149]/60 flex-shrink-0">
              <div className="flex gap-2">
                {(["All", "Critical", "Risk"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveAlertTab(tab)}
                    aria-pressed={activeAlertTab === tab}
                    className={`${activeAlertTab === tab ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#030810] text-[#63788f] border-[#1c3149] hover:bg-[#1c3149] hover:text-[#8fa0b5]"} border text-[11px] font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5`}
                  >
                    {tab}
                    <span
                      className={`${activeAlertTab === tab ? "bg-[#3b82f6]/30 text-white" : "bg-[#1c3149]/70 text-[#63788f]"} rounded px-1 font-mono text-[10px] leading-tight`}
                    >
                      {alertTabCounts[tab]}
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-bold text-[#63788f]">
                {visibleAlerts.length}{" "}
                {visibleAlerts.length === 1 ? "alert" : "alerts"}
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-6 py-3">
              {visibleAlerts.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-[12px] font-bold text-[#63788f]">
                  No records found
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="text-[10px] text-[#63788f] uppercase tracking-wider">
                    <tr>
                      <th className="pb-2 font-black sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                        Severity
                      </th>
                      <th className="pb-2 font-black sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                        Alert
                      </th>
                      <th className="pb-2 font-black text-center sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                        Impact
                      </th>
                      <th className="pb-2 font-black text-right sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                        Age
                      </th>
                      <th className="pb-2 font-black sticky top-0 bg-[#101c2b] border-b border-[#1c3149] z-10">
                        AI Recommendation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c3149]/45">
                    {visibleAlerts.map((alert) => {
                      const isCritical = alert.level === "Critical";
                      const tone = isCritical ? "#ff4c4c" : "#eab308";
                      return (
                        <tr
                          key={alert.id}
                          className="hover:bg-[#16253a]/40 transition-colors align-top"
                        >
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            <span
                              className="text-[9.5px] font-black uppercase tracking-wider px-1.5 py-[2px] rounded border inline-flex items-center gap-1.5"
                              style={{
                                color: tone,
                                borderColor: `${tone}4d`,
                                backgroundColor: `${tone}1a`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor: tone,
                                  boxShadow: `0 0 6px ${tone}`,
                                }}
                              />
                              {alert.level}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-[11.5px] font-semibold text-[#e8eef5] leading-snug min-w-[220px]">
                            {alert.title}
                          </td>
                          <td className="py-2.5 pr-3 text-center text-[10px] font-bold text-[#8fa0b5] whitespace-nowrap">
                            {alert.impact}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-[10px] font-bold text-[#63788f] whitespace-nowrap font-mono">
                            {alert.time}
                          </td>
                          <td className="py-2.5 text-[11px] text-[#c3cdda] font-medium leading-snug min-w-[280px]">
                            <div className="flex items-start gap-1.5">
                              <Bot
                                size={11}
                                className="text-[#818cf8] mt-[2px] flex-shrink-0"
                              />
                              <span>{alert.rec}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full AI recommendation for the hovered alert. Portalled to <body> and
          fixed-positioned so neither the alert card (overflow-hidden) nor the
          scrolling alert list can clip it. */}
      {recTip &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[9999] pointer-events-none w-[300px] max-w-[90vw] -translate-x-1/2 -translate-y-full bg-[#0b1220] border border-[#4338ca]/50 rounded-md p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
            style={{
              left: Math.min(
                Math.max(recTip.x, 160),
                window.innerWidth - 160,
              ),
              top: recTip.y - 8,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Bot size={11} className="text-[#818cf8]" />
              <span className="text-[#818cf8] text-[9px] font-black uppercase tracking-wider">
                AI Recommendation
              </span>
            </div>
            <p className="text-[#dfe5f0] text-[11px] font-medium leading-relaxed">
              {recTip.text}
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default QualityLayout;
