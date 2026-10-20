import React, { useState, useEffect, useMemo, useRef } from "react";
import brandLogo from "../../assets/tvsnext-logo.png";
import {
  ChevronDown,
  Maximize2,
  Search,
  Camera,
  Scan,
  Thermometer,
  Droplets,
  Cpu,
  Shield,
  Leaf,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import qualityData from "../../data/qualityData.json";
import { apiUrl, DASHBOARD_STREAM_URLS } from "../../core/api/config";
import { filterYieldRows } from "../quality/productYieldFilter";
import {
  EMPTY_RANGE,
  LEVEL_PARAM,
  comparisonLabel,
  isFilteredScope,
  isRangeActive,
  type DateRange,
} from "../quality/dashboardFilters";
import {
  useProcessFilterOptions,
  useProductOptions,
  useRangeKpis,
  useRangeProcessPerformance,
  useRangeProductYield,
} from "../quality/useDashboardFilters";
import DateRangeFilter from "../quality/DateRangeFilter";
import ProductFilter from "../quality/ProductFilter";
import LineFilter from "../quality/LineFilter";
import { ZONES, ZoneDef, STATUS_CSS, STATUS_LABEL } from "../factory/zones";
import FactoryLayoutOverlay from "../factory/FactoryLayoutOverlay";
import { palette } from "../../theme/palette";
import {
  fmtAlertAge,
  fmtAlertValue,
  fmtCompact,
  fmtCount,
  fmtFixed,
  isNum,
  monthPeriodLabel,
} from "../../core/format";
import ProcessMetricCard from "../quality/ProcessMetricCard";
import KpiMetricCard from "../quality/KpiMetricCard";
import LargeKpiCard from "../quality/LargeKpiCard";
import ProductYieldPanel from "../quality/ProductYieldPanel";
import type { YieldStepRequest } from "../quality/yieldTabs";
import AttentionCenterPanel from "../quality/AttentionCenterPanel";
import AlertsModal from "../quality/AlertsModal";
import {
  API_KEY_BY_TILE,
  bandedZoneStatus,
  eriStatusColor,
  kpiCardGrade,
  zoneStatusFromGrades,
} from "../quality/metrics";

interface QualityLayoutProps {
  header?: React.ReactNode;
}

// Shape of the /dashboard/eri response.
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

// Inline SVG icons for the few tiles lucide-react has no equivalent for.
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
    <path d="M6 3h12v3H6z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 3v3" />
    <path d="M9 6h6v12a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3V6z" />
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
    <path d="M12 2C12 2 5 9 5 14C5 17.5 8 20.5 12 21C16 20.5 19 17.5 19 14C19 9 12 2 12 2Z" />
    <line x1="12" y1="2" x2="12" y2="21" />
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
    <circle cx="12" cy="7.5" r="2.5" />
    <path d="M6 16.5a6 6 0 0 1 12 0" />
    <circle cx="6" cy="15.5" r="1.8" />
    <path d="M2 20a4 4 0 0 1 6.5-3.3" />
    <circle cx="18" cy="15.5" r="1.8" />
    <path d="M15.5 16.7A4 4 0 0 1 22 20" />
  </svg>
);

// Line chart with its own axes, used by the Safety and CI panels.
const SafetyChart = ({
  points,
  yTicks,
  xTicks,
  color = palette.critical,
}: {
  points: number[];
  yTicks: number[];
  xTicks: string[];
  color?: string;
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 200;
  const height = 55;
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

  const visibleTicks = (() => {
    const keep = new Set<number>();
    if (xTicks.length === 0) return keep;
    if (xTicks.length === 1) return new Set([0]);

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

        {yTicks.map((tick, i) => {
          const y =
            paddingTop + chartHeight - ((tick - minVal) / range) * chartHeight;
          return (
            <g key={i} className="opacity-65">
              <text
                x={paddingLeft - 4}
                y={y + 2}
                fill={palette.inkMuted}
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
                stroke={palette.line}
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </g>
          );
        })}

        {hasPoints && <polygon points={areaPoints} fill={`url(#${gradId})`} />}

        {hasPoints && (
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="1"
            points={svgPoints}
          />
        )}

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
                stroke={isHovered ? palette.white : "#050b12"}
                strokeWidth="0.4"
                style={{
                  transition: "all 0.1s ease-in-out",
                }}
              />
            );
          })}

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

              const ty = 2;

              const clearsCursor = y > ty + tooltipHeight + 2;
              let tx: number;
              if (clearsCursor) {
                tx = x - tooltipWidth / 2;
              } else {
                const gap = 5;
                tx = x + gap;
                if (tx + tooltipWidth > width - 2) tx = x - tooltipWidth - gap;
              }

              if (tx < 2) tx = 2;
              if (tx + tooltipWidth > width - 2) tx = width - tooltipWidth - 2;

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
                  <text
                    x={tx + tooltipWidth / 2}
                    y={ty + 6.5}
                    fill={palette.inkMuted}
                    fontSize="5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {xTicks[hoveredIdx]}
                  </text>
                  <text
                    x={tx + tooltipWidth / 2}
                    y={ty + 14}
                    fill={palette.white}
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
              fill={palette.inkMuted}
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

// Half-circle progress gauge, used by the KPI and CI panels.
const SemiCircleGauge = ({
  value,
  min = 0,
  max = 100,
  labelMin,
  labelMax,
  color = palette.tabBorder,
  icon: Icon,
  showValueInCenter = false,
  centerLabel,
}: any) => {
  const radius = 32;
  const strokeWidth = 6;
  const cx = 60;
  const cy = 38;

  const circumference = Math.PI * radius;
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
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={palette.panel}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />

        <text
          x={cx - radius}
          y={cy + 12}
          fill={palette.inkDim}
          fontSize="9.5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {labelMin}
        </text>

        <text
          x={cx + radius}
          y={cy + 12}
          fill={palette.inkDim}
          fontSize="9.5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {labelMax}
        </text>

        {showValueInCenter && (
          <text
            x={cx}
            y={cy - 1}
            fill={palette.white}
            fontSize="11"
            fontWeight="900"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {centerLabel ?? `${value}%`}
          </text>
        )}

        {!showValueInCenter && Icon && (
          <g
            transform={`translate(${cx - 10}, ${iconY - 10})`}
            className="text-ink-muted opacity-90"
          >
            <Icon size={20} />
          </g>
        )}
      </svg>
    </div>
  );
};

// Tile label -> the name the same metric goes by in each feed. Data, not
// control flow: these used to be `||` chains inside the render function.
const PROCESS_NAME_ALIASES: Record<string, string> = {
  AXI: "AXI - S",
  "THERMAL GEL AVI": "THERMAL AVI",
  "SCREW DEFECT": "SCREW DEFECTS",
  "BURN-IN": "BURN-IN - S",
  LBTS: "LBTS - S",
};

// TEMPORARY, for the 2026-09-24 demo: stand-in shop-floor readings.
//
// The BMS workbook only covers 2026-08-01..08-31, so `shop_floor` arrives null
// on the feed and both figures render "N/A". These are plausible rather than
// invented — the real August data averages 23.7 °C (21.2-24.5) and 52.1 % RH
// (49.0-54.8), and these sit inside both.
//
// A FALLBACK, not an override: a real reading always wins, so this disappears on
// its own the moment the BMS sheet is refreshed. The tooltip says the figure is
// a placeholder, so nobody reads it as a measurement. To remove, delete this
// constant and the two `?? DEMO_SHOP_FLOOR.*` in the header.
const DEMO_SHOP_FLOOR = { temp: 23.5, humidity: 52.0 };

const LARGE_KPI_LABEL_ALIASES: Record<string, string> = {
  CUSTOMER: "CUSTOMER QUALITY AUDIT (%)",
  UNITHFTPY: "UNIT-HFTPY (%)",
};

const KPI_LABEL_ALIASES: Record<string, string> = {
  "FPY MODULE": "FPY - MODULE (%)",
  "SPY MODULE": "SPY - MODULE (%)",
  "FPY UNIT": "FPY - UNIT (%)",
  "SPY UNIT": "SPY - UNIT (%)",
};

// The 13 Process Performance tiles, in display order.
const processPerformanceData = [
  {
    name: "SPI",
    icon: Search,
    section: "SMT",
    type: "yield",
    data: { done: "12,450", ok: "12,221", yield: "98.16%" },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "DPMOI",
    icon: Camera,
    section: "SMT",
    type: "dpmo",
    data: { defects: "...", opportunities: "...", index: "..." },
    status: "...",
    color: palette.raised,
  },
  {
    name: "AXI - S",
    icon: Scan,
    section: "SMT",
    type: "yield",
    data: { done: "11,180", ok: "11,001", yield: "98.40%" },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "SMT DEFECTS @ MFT",
    icon: Cpu,
    section: "SMT",
    type: "failure",
    data: { failure: "..." },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "THERMAL AVI",
    icon: Thermometer,
    section: "RFM",
    type: "yield",
    data: { done: "980", ok: "955", yield: "97.45%" },
    status: "At Risk",
    color: palette.warning,
  },
  {
    name: "SCREW DEFECTS",
    icon: ScrewIcon,
    section: "RFM",
    type: "failure",
    data: { failure: "1.6%" },
    status: "Critical",
    color: palette.critical,
  },
  {
    name: "OTA",
    icon: Cpu,
    section: "RFM",
    type: "yield",
    data: { done: "540", ok: "531", yield: "98.33%" },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "RTWP",
    icon: Zap,
    section: "RFM",
    type: "yield",
    data: { done: "520", ok: "512", yield: "98.46%" },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "BURN-IN - S",
    icon: Thermometer,
    section: "RFM",
    type: "yield",
    data: { done: "6", ok: "6", yield: "100.00%" },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "LBTS - S",
    icon: Zap,
    section: "RFM",
    type: "yield",
    data: { done: "610", ok: "602", yield: "98.69%" },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "IP",
    icon: Scan,
    section: "RFM",
    type: "yield",
    data: { done: "510", ok: "502", yield: "98.43%" },
    status: "Healthy",
    color: palette.healthy,
  },
  {
    name: "AUTO OGI",
    icon: Search,
    section: "RFM",
    type: "yield",
    data: { done: "840", ok: "832", yield: "98.05%" },
    status: "Healthy",
    color: palette.healthy,
  },
];

// Options in the header's shift selector. Factory day starts at 06:15.
const SHIFTS = [
  "Shift A (06:15 AM - 02:15 PM)",
  "Shift B (02:15 PM - 10:15 PM)",
  "Shift C (10:15 PM - 06:15 AM)",
  "Full Day (06:15 AM - 06:15 AM)",
];

// Gap between process cards, in px. Shared with the group rails above them so
// a rail ends exactly where its last card does.
const PROCESS_CARD_GAP = 10;

// How long after an SSE push a filtered view refetches. Long enough to fold the
// three streams' near-simultaneous pushes into one request.
const SSE_REFRESH_DEBOUNCE_MS = 3000;

const STAGE_GROUP_COLOR = palette.accentRail;

// The SMT / MFT / RFM rail drawn above a run of process cards.
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

// Quality Excellence Center dashboard.
//
// Data comes from two places: three REST endpoints polled every 5 minutes
// (current-day yield, safety, ERI), and an SSE stream for live process and
// alert updates. qualityData.json only seeds the KPI cards' initial state, so
// the layout renders before the first response arrives.
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
  const [activeShift, setActiveShift] = useState(
    "Full Day (06:15 AM - 06:15 AM)",
  );
  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const [activeYieldTab, setActiveYieldTab] = useState<"UNITS" | "TRX" | "PA">(
    "UNITS",
  );
  // Both null on open, on purpose: with no date parameters the dashboard reads
  // the live SSE snapshot, which is the fast path for first paint. Setting
  // either date moves every panel below onto the database instead.
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  // Item codes. Empty selects every product, matching an absent ?product=.
  // ONE selection shared by the KPI cards, the process cards, the yield table
  // and its step tabs — the header pill and the yield panel's pill both edit it.
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  // Line names. Only the four line cards read it (process-filter-options'
  // `line_steps`); every other card ignores it.
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  // Bumped (debounced) by SSE pushes while a filter is on. The streams only
  // carry the unfiltered current day, so under a filter a push is a "data
  // changed" signal: the filtered queries refetch on it instead of the push
  // being rendered.
  const [refreshTick, setRefreshTick] = useState(0);
  // Read inside the SSE handler, which is mounted once and cannot see the
  // current state. See the guard in handleData.
  const rangeActiveRef = useRef(false);
  const filteredActiveRef = useRef(false);
  // Last Process Performance tile click, forwarded to the Product Yield panel
  // so it can select the matching step tab. Nonce, not just step: see
  // YieldStepRequest.
  const [yieldStepRequest, setYieldStepRequest] =
    useState<YieldStepRequest | null>(null);

  const [processPerformance, setProcessPerformance] = useState<any[]>(
    processPerformanceData.map((item) => ({
      ...item,
      data:
        item.type === "yield"
          ? { done: "...", ok: "...", yield: "..." }
          : { failure: "..." },
      status: "...",
      color: palette.raised,
    })),
  );
  const [rawProductYield, setRawProductYield] = useState<any[]>([]);
  const [yieldFetchState, setYieldFetchState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [rawKpiData, setRawKpiData] = useState<any>(null);
  const [hftpyBlock, setHftpyBlock] = useState<any>(null);
  const [rawProcessPerformance, setRawProcessPerformance] = useState<any>(null);
  const [attentionCenterAlerts, setAttentionCenterAlerts] = useState<any[]>([]);
  const [alertsFeedState, setAlertsFeedState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [safetyAccident, setSafetyAccident] = useState(0);
  const [safetyNearMiss, setSafetyNearMiss] = useState(0);
  const [accidentPoints, setAccidentPoints] = useState<number[]>([]);
  const [safetyTargets, setSafetyTargets] = useState({
    incident: 0,
    nearMiss: 0,
  });
  const [nearMissPoints, setNearMissPoints] = useState<number[]>([]);
  const [yieldRecommendations, setYieldRecommendations] = useState<
    Record<string, any>
  >({});
  const [yieldPlanStatus, setYieldPlanStatus] = useState<{
    month: string | null;
    available: boolean;
  }>({ month: null, available: true });
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
  const [co2Labels, setCo2Labels] = useState<string[]>([]);
  const co2YTicks = useMemo(() => {
    const values = co2Points.filter(isNum);
    if (!values.length) return [1600, 1400, 1200, 1000];
    const step = Math.max(
      50,
      Math.ceil((Math.max(...values) - Math.min(...values)) / 3 / 50) * 50,
    );
    const floor = Math.floor(Math.min(...values) / step) * step;
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
  const [ciMonthLabel] = useState("");
  const [ciMonths, setCiMonths] = useState<
    {
      label: string;
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
  const [shopFloorHour, setShopFloorHour] = useState<number | null>(null);

  const visibleAlerts = React.useMemo(
    () =>
      attentionCenterAlerts.filter(
        (alert) => activeAlertTab === "All" || alert.level === activeAlertTab,
      ),
    [attentionCenterAlerts, activeAlertTab],
  );

  const alertTabCounts = React.useMemo(
    () => ({
      All: attentionCenterAlerts.length,
      Critical: attentionCenterAlerts.filter((a) => a.level === "Critical")
        .length,
      Risk: attentionCenterAlerts.filter((a) => a.level === "Risk").length,
    }),
    [attentionCenterAlerts],
  );

  useEffect(() => {
    const fetchYieldRecommendation = async () => {
      setYieldRecsLoading((prev) => prev || false);
      try {
        const res = await fetch(apiUrl("/yield-recommendation/current-day"));
        if (!res.ok) throw new Error("yield recommendation unavailable");
        const data = await res.json();
        const byProduct: Record<string, any> = {};
        for (const p of data.products ?? []) byProduct[p.product] = p;
        setYieldRecommendations(byProduct);
        setYieldPlanStatus({
          month: data.plan_month ?? null,
          available: data.plan_available !== false,
        });
      } catch (err) {
        console.error("Error fetching yield recommendation:", err);
        setYieldRecommendations({});
        setYieldPlanStatus({ month: null, available: true });
      } finally {
        setYieldRecsLoading(false);
      }
    };

    fetchYieldRecommendation();
    const id = setInterval(fetchYieldRecommendation, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // "A" | "B" | "C", or null for the whole production day. Derived once here
  // rather than re-parsed at each consumer: it is now a request parameter on
  // three endpoints as well as a client-side filter, and a fourth copy of the
  // regex is a fourth place for the two to disagree.
  const shiftLetter = React.useMemo<"A" | "B" | "C" | null>(() => {
    const match = activeShift.match(/Shift\s+([A-C])/i);
    return match ? (match[1].toUpperCase() as "A" | "B" | "C") : null;
  }, [activeShift]);

  const rangeActive = isRangeActive(dateRange);
  rangeActiveRef.current = rangeActive;
  // Which panels read REST instead of the snapshot. Lines reach only the
  // process strip, so a line alone leaves the KPI cards and the yield table on
  // the live feed, where they are still exactly right.
  const kpiFiltered = isFilteredScope({
    range: dateRange,
    products: selectedProducts,
  });
  const processFiltered = isFilteredScope({
    range: dateRange,
    products: selectedProducts,
    lines: selectedLines,
  });
  filteredActiveRef.current = processFiltered;

  // The filter-aware queries. Each is inert until its panel is filtered, at
  // which point it takes over from the snapshot; see useDashboardFilters.ts.
  const rangedYield = useRangeProductYield({
    range: dateRange,
    shift: shiftLetter,
    level: LEVEL_PARAM[activeYieldTab],
    products: selectedProducts,
    active: kpiFiltered,
    refreshTick,
  });
  const rangedKpis = useRangeKpis({
    range: dateRange,
    shift: shiftLetter,
    products: selectedProducts,
    active: kpiFiltered,
    refreshTick,
  });
  const rangedProcess = useRangeProcessPerformance({
    range: dateRange,
    products: selectedProducts,
    lines: selectedLines,
    active: processFiltered,
    refreshTick,
  });
  const productOptions = useProductOptions(dateRange);
  const filterOptions = useProcessFilterOptions(dateRange);
  // The cards a line reaches. The filtered response is the authority; the
  // options call covers the moment before the first filtered response lands.
  const lineSteps = rangedProcess.lineSteps ?? filterOptions.lineSteps;
  const linesActive = selectedLines.length > 0;

  // Product-yield rows come from one of two sources with an identical row
  // shape: the SSE snapshot for the unfiltered current day, or
  // /dashboard/product-yield once a range or product is set. One mapper serves
  // both.
  //
  // The snapshot arrives unfiltered — every shift and level at once — so shift
  // and level filtering is local, which is why switching a tab costs no request.
  // Re-running the same filter over the REST rows is intentional and cheap: the
  // endpoint has already applied it, and passing both through one path means
  // the two sources cannot drift into rendering differently.
  //
  // Products are never filtered here any more: a product selection moves the
  // table onto REST, which filters server-side.
  const productYield = React.useMemo(() => {
    const targetShift = shiftLetter;
    const sourceRows = kpiFiltered
      ? (rangedYield.rows ?? [])
      : rawProductYield;

    return filterYieldRows(sourceRows, activeYieldTab, targetShift).map(
      (row: any) => ({
        id: row.id,
        name: row.product,
        // Item code, needed to open the UNIT_TEST drill-down from a UNITS row.
        // The table shows `name`; the endpoint takes the code.
        item: row.item,
        tested: fmtCount(row.tested, "—"),
        failed: isNum(row.failed) ? row.failed.toString() : "—",
        // The same number unformatted. The table colours the cell on it, and
        // "—" cannot be told apart from a genuine zero once it is a string.
        failedCount: isNum(row.failed) ? row.failed : null,
        fpy: row.fpy,
        spy: row.spy,
        target: row.target_yield,
        status:
          row.status === "healthy"
            ? "Healthy"
            : row.status === "warning"
              ? "Warning"
              : row.status === "no_target"
                ? "No Target"
                : "Critical",
        rec: row.ai_recommendation,
        shift: row.shift,
        sub_module: row.sub_module,
        // Range source only: how many days of the range THIS product ran, which
        // is not the length of the range. Two days inside a fortnight is a much
        // weaker signal than fifteen, so the table surfaces it rather than
        // letting a thin yield read as a solid one.
        days: isNum(row.days) ? row.days : null,
      }),
    );
  }, [
    rawProductYield,
    rangedYield.rows,
    kpiFiltered,
    shiftLetter,
    activeYieldTab,
  ]);

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
          if (data.customer_complaints) {
            const cc = data.customer_complaints;
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

  useEffect(() => {
    // Under a filter the snapshot cannot be shown, but it still says the
    // pipeline wrote something new. Collapse a burst of pushes (three streams
    // can fire together) into one refetch of the filtered scope, a few seconds
    // later.
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        setRefreshTick((t) => t + 1);
      }, SSE_REFRESH_DEBOUNCE_MS);
    };

    const handleData = (data: any) => {
      if (!data) return;

      setAlertsFeedState("ready");

      if (
        filteredActiveRef.current &&
        (data.kpis || data.product_yield || data.process_performance)
      ) {
        scheduleRefresh();
      }

      if (data.meta) {
        // The feed reports which shift is live and normally moves the selector
        // with it, which is right for the always-on current-day view.
        //
        // It must not do that while a date range is applied. The range query
        // takes the shift as a parameter, so a push at a shift boundary would
        // silently refetch a historical window for a different shift than the
        // one the user picked — the numbers would change with nothing on screen
        // having been touched.
        if (data.meta.shift && !rangeActiveRef.current) {
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

      if (data.kpis) {
        setRawKpiData(data.kpis);
      }

      // Sent unfiltered by /stream/product-yield; the shift and level filter
      // that the REST endpoint used to apply now happens in the panel.
      if (Array.isArray(data.product_yield?.rows)) {
        setRawProductYield(data.product_yield.rows);
        setYieldFetchState("ready");
      }

      if (data.hftpy !== undefined) {
        setHftpyBlock(data.hftpy);
      }

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

      if (data.process_performance) {
        setRawProcessPerformance(data.process_performance);
      }

      const attention = data.attention ?? data.attention_center;
      if (attention) {
        if (Array.isArray(attention.alerts)) {
          const idSeen = new Map<string, number>();
          const mappedAlerts = attention.alerts.map((a: any, i: number) => {
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
              level:
                String(a.severity).toLowerCase() === "critical"
                  ? "Critical"
                  : "Risk",
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
      }

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

      if (data.sustainability) {
        if (data.sustainability.green_energy_pct !== undefined)
          setGreenEnergyPct(data.sustainability.green_energy_pct.value);
        if (data.sustainability.co2_emission_tco2 !== undefined) {
          const co2 = data.sustainability.co2_emission_tco2;

          setCo2Emission(isNum(co2.value) ? Math.round(co2.value) : 0);

          if (co2.trend) setCo2Points(co2.trend);
          if (co2.trend_labels) setCo2Labels(co2.trend_labels);
        }
      }

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

      if (data.ci && Array.isArray(data.ci.months)) {
        setCiMonths(data.ci.months);
      }
    };

    // Three streams instead of one. Each carries a slice of the snapshot and
    // stays quiet until that slice changes, so an idle dashboard costs almost
    // nothing. handleData already guards every section, so a payload holding one
    // section simply skips the rest.
    //
    // OFFLINE is only reported once ALL of them are down: one stream dropping
    // stales part of the dashboard, but the rest is still live and saying
    // OFFLINE would be a lie.
    const sources = Object.values(DASHBOARD_STREAM_URLS).map((url) => {
      const es = new EventSource(url);

      const consume = (raw: string) => {
        try {
          handleData(JSON.parse(raw));
        } catch (err) {
          console.error(`Error parsing snapshot from ${url}`, err);
        }
      };

      es.addEventListener("snapshot", (e) => consume((e as MessageEvent).data));
      // The streams name their events, but an unnamed message is still handled
      // so a proxy that strips event names cannot blank the dashboard.
      es.onmessage = (e) => e.data && consume(e.data);

      es.onopen = () => setLiveStatus("ONLINE");
      es.onerror = () => {
        const allDown = sources.every(
          (src) => src.readyState === EventSource.CLOSED,
        );
        if (allDown) {
          console.error("All dashboard streams are down");
          setLiveStatus("OFFLINE");
          setAlertsFeedState("error");
        }
      };

      return es;
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      sources.forEach((es) => es.close());
    };
  }, []);

  useEffect(() => {
    // The snapshot feed only ever describes the unfiltered current production
    // day, so it must not write over cards that a date range or product now
    // owns. Clearing the filter re-runs this effect and hands them straight back.
    if (kpiFiltered || !rawKpiData) return;

    setKpiCards((prev) => {
      return prev.map((card) => {
        if (card.id === 9) {
          if (!hftpyBlock) return card;
          const actual = hftpyBlock.actual_pct;
          const projection = hftpyBlock.projection_pct;
          return {
            ...card,
            value: isNum(actual) ? `${actual.toFixed(1)}%` : "—",
            projectedValue: isNum(projection)
              ? `${projection.toFixed(1)}%`
              : "—",
            change: isNum(hftpyBlock.delta_vs_projection)
              ? `${hftpyBlock.delta_vs_projection > 0 ? "+" : ""}${hftpyBlock.delta_vs_projection.toFixed(1)}% vs proj`
              : "",
            delta_vs_yesterday: hftpyBlock.delta_vs_projection ?? 0,
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

        const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
        const shiftLetter = shiftMatch ? shiftMatch[1].toUpperCase() : null;

        const isShiftSpecificKpi = [
          "fpy_unit",
          "spy_unit",
          "fpy_module",
          "spy_module",
        ].includes(sseKey);

        if (
          rawKpiData.delta_vs_yesterday &&
          rawKpiData.delta_vs_yesterday[sseKey] !== undefined
        ) {
          delta = rawKpiData.delta_vs_yesterday[sseKey] ?? 0;
        }

        if (rawKpiData.trend && Array.isArray(rawKpiData.trend.buckets)) {
          // Slice the buckets to the selected shift for the four KPIs that ARE
          // per-shift, so the line under the number covers the same hours the
          // number does. Before this the value followed the shift selector and
          // the sparkline stayed on the whole day, which made the two disagree
          // on the same card.
          //
          // Gated on isShiftSpecificKpi: the customer-audit KPI is a daily
          // figure with no shift dimension, and cutting its trend to a third of
          // the day would misreport it rather than narrow it.
          const buckets: any[] =
            isShiftSpecificKpi && shiftLetter
              ? rawKpiData.trend.buckets.filter(
                  (b: any) => (b.shift || "").toUpperCase() === shiftLetter,
                )
              : rawKpiData.trend.buckets;
          trend = buckets.map((b: any) => b.today?.[sseKey] ?? null);
          yesterdayPoints = buckets.map(
            (b: any) => b.yesterday?.[sseKey] ?? null,
          );
        }

        if (isShiftSpecificKpi && rawKpiData.by_shift && shiftLetter) {
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
            val = 0;
            delta = 0;
            trend = null;
            yesterdayPoints = null;
          }
        }

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
            const incoming = rawKpiData.find((k: any) => k && k.key === sseKey);
            if (incoming) {
              val = typeof incoming === "object" ? incoming.value : incoming;
              delta =
                typeof incoming === "object" ? incoming.delta_vs_yesterday : 0;
              trend = typeof incoming === "object" ? incoming.trend : null;
            }
          } else if (typeof rawKpiData === "object") {
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
  }, [activeShift, rawKpiData, hftpyBlock, kpiFiltered]);

  // The same five cards, over a date range, from /dashboard/kpis.
  //
  // A separate effect rather than a branch inside the one above because almost
  // nothing is shared: the range response has no trend buckets, no per-shift
  // fallback chain and a comparison window that moves, so the only common step
  // is writing a formatted string onto the card.
  useEffect(() => {
    if (!kpiFiltered) return;
    const kpis = rangedKpis.data;
    if (!kpis) return;

    const productActive = selectedProducts.length > 0;

    // days_with_data: 0 means nothing ran in the window. Rendering the zeroed
    // totals here would read as a catastrophic yield rather than no production,
    // so the cards go blank and say so instead.
    const nothingRan = kpis.range.days_with_data === 0;
    const label = comparisonLabel(kpis.previous);

    setKpiCards((prev) =>
      prev.map((card) => {
        // UNIT-HFTPY is projection-against-plan for the whole plant on the
        // current day; this endpoint has neither a range nor a per-product
        // equivalent. Blanking it is the honest option: leaving the snapshot
        // figure in place would put a plant number under a product chip, or a
        // today number under a historical range.
        if (card.id === 9) {
          return {
            ...card,
            value: "—",
            projectedValue: "—",
            change: rangeActive ? "Current day only" : "n/a for a product",
            delta_vs_yesterday: 0,
          };
        }

        const keyMap: Record<
          number,
          "fpy_unit" | "spy_unit" | "fpy_module" | "spy_module" | "customer_audit"
        > = {
          1: "fpy_unit",
          2: "spy_unit",
          3: "fpy_module",
          4: "spy_module",
          5: "customer_audit",
        };
        const key = keyMap[card.id];
        if (!key) return card;

        if (nothingRan) {
          return {
            ...card,
            value: "—",
            change: rangeActive
              ? "No production in range"
              : "No production for selection",
            points: card.points.map(() => null),
            yesterdayPoints: card.yesterdayPoints?.map(() => null),
            delta_vs_yesterday: 0,
          };
        }

        // Never averaged from by_date: a range figure is the raw board counts
        // added up with the percentage taken once at the end, so a day that
        // tested nine times as many boards carries nine times the weight.
        // `totals` is already that arithmetic — re-deriving it from the daily
        // percentages would disagree with the backend exactly on the weeks where
        // volume swung.
        const value = kpis.totals[key];

        // Customer Audit is signed off the day after the shift it covers, so
        // the newest day in a range is normally unaudited and days that were
        // never audited are left out of the average rather than scored zero.
        // A null score means nothing in the range was audited at all.
        //
        // Under a product filter it is null for a different reason: the audit
        // is a plant score with no product. Say that, not "0" or "Not audited".
        if (key === "customer_audit" && !isNum(value)) {
          return {
            ...card,
            value: "—",
            change: productActive ? "n/a for a product" : "Not audited",
            delta_vs_yesterday: 0,
          };
        }

        if (!isNum(value)) {
          return { ...card, value: "—", change: label, delta_vs_yesterday: 0 };
        }

        const delta = kpis.delta_vs_previous?.[key];
        // Daily percentages are fine for the sparkline's SHAPE, which is all
        // they are used for here — the headline figure above comes from totals.
        const points = kpis.by_date?.length
          ? kpis.by_date.map((d) => (isNum(d[key]) ? (d[key] as number) : null))
          : card.points;

        return {
          ...card,
          value: `${value.toFixed(1)}%`,
          change: isNum(delta)
            ? `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}% ${label}`
            : label,
          points,
          // No equivalent series on the range source, and leaving the
          // current-day comparison line in place would plot yesterday against a
          // fortnight.
          yesterdayPoints: card.yesterdayPoints?.map(() => null),
          delta_vs_yesterday: isNum(delta) ? delta : 0,
        };
      }),
    );
  }, [kpiFiltered, rangeActive, rangedKpis.data, selectedProducts.length]);

  useEffect(() => {
    // One mapping, two sources. The ranged endpoint returns the same per-step
    // shape the snapshot publishes precisely so this stays a single code path —
    // a second mapping is a second place for the two to disagree about what a
    // card means.
    const processSource = processFiltered
      ? rangedProcess.data
      : rawProcessPerformance;
    if (!processSource) return;

    const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
    const shiftLetter = shiftMatch ? shiftMatch[1].toUpperCase() : null;

    setProcessPerformance((prev) => {
      return prev.map((prevItem) => {
        const apiKey =
          API_KEY_BY_TILE[prevItem.name] ?? prevItem.name.replace(/\s+/g, "_");
        const incoming = processSource[apiKey];

        /**
         * The line under the number.
         *
         * Live, that is the snapshot's hourly buckets and it arrives ready to
         * use. Over a RANGE there is no hourly series — the equivalent grain is
         * a day — so one is built here from the `by_date` the ranged endpoint
         * attaches to whichever block is being shown. That is the same thing the
         * ranged KPI cards already do with `kpis.by_date`, which is why FPY and
         * SPY have had a working line under a range while these did not.
         *
         * Each point is tagged with the SELECTED shift so getProcessTrendData's
         * filter passes it through: the series is already for that shift, and
         * the tag is what stops the filter discarding it. With no shift selected
         * the points carry none and the filter does not run.
         *
         * The whole-day fallback to `incoming` is for DPMOI, which comes from a
         * different mart and so publishes its day figures at the top level
         * rather than under `day`. Same shape underneath, one level up.
         */
        const rangeBlock = processFiltered
          ? shiftLetter
            ? (incoming?.by_shift ?? []).find(
                (b: any) => (b.shift || "").toUpperCase() === shiftLetter,
              )
            : (incoming?.day ?? incoming)
          : null;
        const rangeTrend = rangeBlock?.by_date?.length
          ? {
              metric: "value",
              buckets: rangeBlock.by_date.map((d: any, i: number) => ({
                index: i,
                label: d.business_date,
                shift: shiftLetter ?? undefined,
                value: d.value,
              })),
            }
          : null;

        const item = {
          ...prevItem,
          trend: processFiltered ? rangeTrend : (incoming?.trend ?? null),
          // Set while a line is selected and this tile is not a line card. The
          // tile then greys out and says so (ProcessMetricCard) instead of
          // showing a figure the line did not narrow.
          lineFiltered: linesActive && !lineSteps.includes(apiKey),
          emptyLabel: undefined as string | undefined,
        };
        // Under a filter a missing step means the selection matched nothing.
        // Render the empty state — never the unfiltered figure, and never the
        // "..." that reads as still loading.
        if (!incoming && processFiltered && !item.lineFiltered) {
          return {
            ...item,
            data:
              item.type === "yield"
                ? { done: "0", ok: "0", yield: "—" }
                : item.type === "dpmo"
                  ? { defects: "0", opportunities: "0", index: "—" }
                  : { failure: "—" },
            status: "Not Run",
            emptyLabel: "No data for selection",
            color: palette.accentRail,
            target: null,
          };
        }
        if (incoming) {
          const target = incoming.target !== undefined ? incoming.target : null;
          const targetUnit = incoming.target_unit || null;
          const targetDirection = incoming.target_direction || null;

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
              color: palette.accentRail,
              target,
              targetUnit,
              targetDirection,
            };
          }

          if (item.name === "DPMOI") {
            /**
             * DPMOI publishes its whole-day figures at the top level, with the
             * shifts alongside in `by_shift` — so unlike the yield tiles there
             * is no `day` block to choose between. Picked here rather than
             * read straight off `incoming` so the number agrees with the line,
             * which is already the selected shift's series.
             *
             * The fallback is what the LIVE path takes: the snapshot carries no
             * `by_shift` for DPMOI, so with a shift selected this lands on the
             * whole-day figures exactly as it did before.
             */
            const dpmoBlock =
              (shiftLetter
                ? (incoming.by_shift ?? []).find(
                    (b: any) => (b.shift || "").toUpperCase() === shiftLetter,
                  )
                : null) ?? incoming;

            const actual = dpmoBlock.index;
            let meets = null;
            if (target !== null && targetDirection && isNum(actual)) {
              meets =
                targetDirection === "lower"
                  ? actual <= target
                  : actual >= target;
            }

            const passing =
              meets !== null ? meets : isNum(actual) && actual <= 10;
            const statusMapped = passing ? "Healthy" : "Critical";
            const colorMapped = passing ? palette.healthy : palette.critical;

            return {
              ...item,
              data: {
                defects: fmtCount(dpmoBlock.defects),
                opportunities: fmtCount(dpmoBlock.opportunities),
                index: fmtFixed(dpmoBlock.index, 2),
              },
              status: statusMapped,
              color: colorMapped,
              target,
              targetUnit,
              targetDirection,
            };
          }

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

            const passing =
              meets !== null ? meets : targetData.status === "healthy";
            const statusMapped = passing ? "Healthy" : "Critical";
            const colorMapped = passing ? palette.healthy : palette.critical;

            if (isNum(targetData.failure_pct)) {
              return {
                ...item,
                data: { failure: `${targetData.failure_pct.toFixed(1)}%` },
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
            return {
              ...item,
              data:
                item.type === "yield"
                  ? { done: "0", ok: "0", yield: "0.00%" }
                  : { failure: "0.0%" },
              status: "N/A",
              color: palette.accentRail,
              target,
              targetUnit,
              targetDirection,
            };
          }
        } else {
          return {
            ...item,
            data:
              item.type === "yield"
                ? { done: "...", ok: "...", yield: "..." }
                : item.type === "dpmo"
                  ? { defects: "...", opportunities: "...", index: "..." }
                  : { failure: "..." },
            status: "N/A",
            color: palette.accentRail,
          };
        }
        return item;
      });
    });
  }, [
    activeShift,
    rawProcessPerformance,
    processFiltered,
    rangedProcess.data,
    linesActive,
    lineSteps,
  ]);

  useEffect(() => {
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

    // AXI - S is deliberately NOT here. It still renders as its own tile in the
    // SMT strip; it just does not vote on the heat map, so an amber or red AXI
    // cannot turn the SMT zone. The zone is driven by SPI, DPMOI and SMT
    // DEFECTS @ MFT alone.
    //
    // Names are the FEED's, not the display labels -- the dashboard renames a
    // few tiles on screen, so "AXI - S" keeps its spaces here even though the
    // strip shows "AXI-S". Adding a tile to the SMT zone means adding it to this
    // list; RFM works the other way and takes everything with section "RFM".
    const SMT_CARD_NAMES = ["SPI", "DPMOI", "SMT DEFECTS @ MFT"];
    const smtCards = processPerformance.filter((p) =>
      SMT_CARD_NAMES.includes(p.name),
    );
    const smtZoneStatus = bandedZoneStatus(smtCards);

    const thermalCard = processPerformance.filter(
      (p) => p.name === "THERMAL AVI",
    );
    const thermalZoneStatus = bandedZoneStatus(thermalCard);

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

    const mftZoneStatus = zoneStatusFromGrades(
      ["FPY - MODULE (%)", "SPY - MODULE (%)"].map((label) =>
        kpiCardGrade(kpiCards.find((k) => k.label === label)),
      ),
    );

    // Tiles that sit in the RFM strip but do not vote on the heat map. They keep
    // their own colour; they just cannot turn the zone.
    //
    // An EXCLUDE list rather than an include list, because RFM is selected by
    // section: membership follows the tile config, so a new RFM tile joins the
    // zone automatically and only the deliberate opt-outs are named here. SMT
    // above works the opposite way, off an explicit list of names.
    //
    // Feed names, not display labels -- the strip shows "BURN-IN-S" and
    // "LBTS-S", but the card carries the spaced form.
    const RFM_EXCLUDED_FROM_ZONE = ["BURN-IN - S", "LBTS - S"];
    const rfmCards = processPerformance.filter(
      (p) => p.section === "RFM" && !RFM_EXCLUDED_FROM_ZONE.includes(p.name),
    );
    const rfmZoneStatus = bandedZoneStatus(rfmCards);

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

  const renderRedesignedCard = (metricName: string, customTitle?: string) => {
    const title = customTitle || metricName;

    const procItem = processPerformance.find(
      (p) =>
        p.name === metricName || PROCESS_NAME_ALIASES[metricName] === p.name,
    );
    if (procItem) {
      return (
        <ProcessMetricCard
          item={procItem}
          title={title}
          activeShift={activeShift}
          // One point is an hour live and a production day once filtered.
          bucketLabel={processFiltered ? "day" : "hr"}
          lineFiltered={Boolean(procItem.lineFiltered)}
          onDrill={({ step }) =>
            setYieldStepRequest({ step, nonce: Date.now() })
          }
        />
      );
    }

    const kpiItem = kpiCards.find(
      (k) =>
        k.label === metricName || KPI_LABEL_ALIASES[metricName] === k.label,
    );
    if (kpiItem) {
      return (
        <KpiMetricCard
          item={kpiItem}
          title={title}
          bucketLabel={kpiFiltered ? "day" : "hr"}
          lineFiltered={linesActive}
        />
      );
    }

    return null;
  };

  const renderLargeKpiCard = (metricName: string, customTitle?: string) => {
    const kpiItem = kpiCards.find(
      (k) =>
        k.label === metricName ||
        LARGE_KPI_LABEL_ALIASES[metricName] === k.label,
    );
    if (!kpiItem) return null;

    return (
      <LargeKpiCard
        item={kpiItem}
        title={customTitle || metricName}
        projectionIsHardcoded={hftpyBlock?.projection_is_hardcoded}
      />
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

  const ciSavingsPoints = React.useMemo(
    () =>
      ciMonths.map((m) => (isNum(m.lean_savings) ? m.lean_savings / 1000 : 0)),
    [ciMonths],
  );

  const ciSavingsYTicks = React.useMemo(() => {
    const max = Math.max(1, ...ciSavingsPoints);
    const step = Math.max(100, Math.ceil(max / 3 / 100) * 100);
    return [3, 2, 1, 0].map((i) => i * step);
  }, [ciSavingsPoints]);

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
    const step = Math.max(50, Math.ceil(max / 3 / 50) * 50);
    return [3, 2, 1, 0].map((i) => i * step);
  }, [ciKaizenPoints]);

  const ciTotals = React.useMemo(() => {
    const total = (key: "lean_savings" | "kaizen") => {
      const vals = ciMonths
        .map((m) => m[key])
        .filter((v): v is number => isNum(v));
      return vals.length ? vals.reduce((t, v) => t + v, 0) : null;
    };
    return { leanSavings: total("lean_savings"), kaizen: total("kaizen") };
  }, [ciMonths]);

  const incidentColor =
    safetyAccident > safetyTargets.incident
      ? palette.critical
      : palette.healthy;
  const nearMissColor =
    safetyNearMiss > safetyTargets.nearMiss
      ? palette.critical
      : palette.healthy;
  const nearMissYTicks = getYTicks(nearMissPoints, 5);
  const customerComplaintsYTicks = getYTicks(customerComplaintsPoints, 4);

  return (
    <div className="w-full min-h-screen bg-page text-ink flex flex-col px-4 pt-4 pb-2 box-border gap-3 font-sans select-none">
      <header className="flex flex-col lg:flex-row justify-between items-center bg-panel border border-line rounded-xl px-3.5 py-1.5 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={brandLogo}
            alt="TVSnext"
            className="w-[78px] h-auto cursor-pointer rounded bg-white/95 px-1.5 py-1"
            onClick={navigateToHome}
          />

          <div className="h-8 w-[1px] bg-line-strong mx-1.5 self-center" />
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] xl:text-[17px] font-black text-white leading-none tracking-wide whitespace-nowrap">
              QUALITY EXCELLENCE CENTER
            </span>
            <span className="text-[11px] xl:text-[12.5px] font-bold text-info leading-none tracking-wider whitespace-nowrap">
              ASSEMBLY PLANT
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 xl:gap-3.5 flex-nowrap min-w-0 text-ink-muted font-mono text-[13px] xl:text-[14px]">
          <span className="hidden xl:inline text-ink-dim whitespace-nowrap">
            {dateStr}
          </span>
          <span className="hidden xl:inline h-3.5 w-[1px] bg-line" />
          <span className="text-white font-bold whitespace-nowrap">
            {timeStr}
          </span>
          <span className="hidden 2xl:inline h-3.5 w-[1px] bg-line" />
          <div className="hidden 2xl:flex items-center gap-1 text-info">
            <Thermometer size={14} className="text-info" />
            <span
              className="text-white font-bold"
              title={
                shopFloorHour !== null
                  ? `Shop-floor temperature at ${String(shopFloorHour).padStart(2, "0")}:00 (BMS)`
                  : "Placeholder for the demo — no BMS reading available for today"
              }
            >
              {(shopFloorConditions.temp ?? DEMO_SHOP_FLOOR.temp).toFixed(1)}°C
            </span>
          </div>
          <span className="hidden 2xl:inline h-3.5 w-[1px] bg-line" />
          <div className="hidden 2xl:flex items-center gap-1 text-info">
            <Droplets size={14} className="text-info" />
            <span
              className="text-white font-bold"
              title={
                shopFloorHour !== null
                  ? `Shop-floor relative humidity at ${String(shopFloorHour).padStart(2, "0")}:00 (BMS)`
                  : "Placeholder for the demo — no BMS reading available for today"
              }
            >
              {(
                shopFloorConditions.humidity ?? DEMO_SHOP_FLOOR.humidity
              ).toFixed(1)}
              %
            </span>
          </div>
          <span className="h-3.5 w-[1px] bg-line" />

          <div
            className={`flex items-center gap-1.5 border px-2.5 py-0.5 rounded text-[13px] font-black shrink-0 whitespace-nowrap ${
              isStatusLive
                ? "border-healthy/30 bg-healthy/5 text-healthy"
                : "border-critical/30 bg-critical/5 text-critical"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isStatusLive ? "bg-healthy" : "bg-critical"}`}
            />
            {liveStatus}
          </div>

          {/* Dashboard-wide, because a range moves the KPI strip, the process
              cards and the yield table together. */}
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            appliedLabel={
              rangedKpis.error
                ? rangedKpis.error
                : rangedKpis.data
                  ? `${rangedKpis.data.range.from} – ${rangedKpis.data.range.to} · ${rangedKpis.data.range.days_with_data} of ${rangedKpis.data.range.days} days with data`
                  : null
            }
          />

          {/* The ONE product selection: KPI cards, process cards, the yield
              table and its step tabs all read it. Options are every product
              that ran on any card in the window, so this instance is the one
              that prunes stale selections. */}
          <ProductFilter
            options={filterOptions.products}
            optionsState={filterOptions.state}
            value={selectedProducts}
            onChange={setSelectedProducts}
            variant="header"
          />

          <div className="relative">
            <div
              className="bg-panel border border-line-strong rounded px-2.5 py-0.5 text-[13px] text-white font-bold flex items-center gap-1.5 cursor-pointer hover:bg-raised transition-colors shrink-0"
              onClick={() => setIsShiftDropdownOpen(!isShiftDropdownOpen)}
              title={activeShift}
            >
              <span className="hidden xl:inline whitespace-nowrap">
                {activeShift}
              </span>
              <span className="xl:hidden whitespace-nowrap">
                {activeShift.split(" (")[0]}
              </span>
              <ChevronDown
                size={11}
                className={`text-ink-dim transition-transform duration-200 ${isShiftDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>

            {isShiftDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsShiftDropdownOpen(false)}
                />
                <div className="absolute top-full right-0 mt-1 bg-panel border border-line-strong rounded-lg shadow-xl shadow-black/50 overflow-hidden z-50 w-max">
                  {SHIFTS.map((shift) => (
                    <div
                      key={shift}
                      className={`px-3 py-2 text-[14px] cursor-pointer hover:bg-tab-active hover:text-white transition-colors ${activeShift === shift ? "text-white bg-line" : "text-ink-muted"}`}
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
            className="p-1.5 hover:bg-raised rounded border border-line-strong cursor-pointer text-ink-muted outline-none"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-1.5">
        <div className="lg:col-span-3 bg-panel border border-line rounded-xl p-4 flex flex-col">
          <div className="flex items-center gap-2 border-b border-line/50 pb-2 mb-3.5 flex-shrink-0">
            <span className="text-[12px] font-black tracking-widest text-ink-muted uppercase">
              PROCESS PERFORMANCE
            </span>
            <span className="text-[10px] font-bold tracking-wider text-ink-dim normal-case">
              {/* The grain of the tiles' trend lines, which changes with the
                  source: hourly buckets for the live day, one point per
                  production day once a filter is applied. */}
              {processFiltered ? "[Daily]" : "[Hourly]"}
            </span>
            {rangedProcess.error && (
              <span
                className="text-[10px] font-bold text-critical truncate"
                title={rangedProcess.error}
              >
                {rangedProcess.error}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {/* Here and not in the header: a line only reaches the cards in
                  `line_steps`, and this is where those cards are. */}
              <LineFilter
                options={filterOptions.lines}
                optionsState={filterOptions.state}
                value={selectedLines}
                onChange={setSelectedLines}
                appliesTo={lineSteps}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 flex-grow justify-between relative">
            <div className="flex flex-col gap-2">
              <div
                className="flex items-center w-full flex-shrink-0 z-10"
                style={{ gap: PROCESS_CARD_GAP }}
              >
                <StageGroupBar span={4} label="SMT" />
                <StageGroupBar span={2} label="MFT" />
                <StageGroupBar span={2} label="RFM" endCap={false} />
              </div>

              <div
                className="flex items-center w-full z-10"
                style={{ gap: PROCESS_CARD_GAP }}
              >
                {renderRedesignedCard("SPI")}
                {renderRedesignedCard("DPMOI")}
                {renderRedesignedCard("AXI", "AXI-S")}
                {renderRedesignedCard("SMT DEFECTS @ MFT")}
                {renderRedesignedCard("FPY MODULE", "FPY MODULE")}
                {renderRedesignedCard("SPY MODULE", "SPY MODULE")}
                {renderRedesignedCard("THERMAL GEL AVI", "THERMAL GEL AVI")}
                {renderRedesignedCard("SCREW DEFECT", "SCREW DEFECT")}
              </div>
            </div>

            <div
              className="flex items-center w-full flex-shrink-0"
              style={{ gap: PROCESS_CARD_GAP }}
            >
              <StageGroupBar span={8} label="RFM" startCap={false} />
            </div>

            <div
              className="flex items-center w-full z-10"
              style={{ gap: PROCESS_CARD_GAP }}
            >
              {renderRedesignedCard("FPY UNIT", "FPY UNIT")}
              {renderRedesignedCard("SPY UNIT", "SPY UNIT")}
              {renderRedesignedCard("OTA")}
              {renderRedesignedCard("RTWP")}
              {renderRedesignedCard("BURN-IN", "BURN-IN-S")}
              {renderRedesignedCard("LBTS", "LBTS-S")}
              {renderRedesignedCard("IP")}
              {renderRedesignedCard("AUTO OGI")}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 bg-panel border border-line rounded-xl p-4 flex flex-col justify-between h-full min-h-[300px]">
          <span className="text-[12px] font-black tracking-widest text-ink-muted uppercase border-b border-line/50 pb-2 mb-3.5 flex-shrink-0">
            KEY PERFORMANCE INDICATOR
          </span>
          <div className="flex-grow flex flex-col gap-3.5">
            {renderLargeKpiCard("CUSTOMER", "CUSTOMER QUALITY AUDIT")}
            {renderLargeKpiCard("UNITHFTPY", "UNIT-HFTPY")}
          </div>
        </div>
      </section>

      <main className="grid grid-cols-1 lg:grid-cols-[calc(25%_-_12px)_minmax(0,1fr)_calc(25%_-_12px)] gap-4">
        <section className="bg-panel border border-white/20 rounded-xl p-4 flex flex-col h-[380px]">
          <div className="flex items-center justify-between border-b border-line/50 pb-2 mb-3 flex-shrink-0">
            <span className="text-[12px] font-black tracking-widest text-ink-muted">
              QUALITY HEAT MAP
            </span>
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
            className="flex-1 relative bg-page border border-white/15 rounded-lg overflow-hidden flex items-center justify-center group cursor-pointer"
            onClick={() => setIsTwinModalOpen(true)}
          >
            <FactoryLayoutOverlay
              zones={twinZones}
              variant="compact"
              className="transition-transform duration-500 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-page/40 via-transparent to-transparent pointer-events-none" />
          </div>
        </section>

        <ProductYieldPanel
          rows={productYield}
          activeTab={activeYieldTab}
          onTabChange={setActiveYieldTab}
          fetchState={
            // While filtered the table's freshness is the REST query's, not the
            // stream's.
            kpiFiltered
              ? rangedYield.state === "ready"
                ? "ready"
                : rangedYield.state === "error"
                  ? "error"
                  : "loading"
              : yieldFetchState
          }
          recommendations={yieldRecommendations}
          recsLoading={yieldRecsLoading}
          planStatus={yieldPlanStatus}
          shift={shiftLetter}
          requestedStep={yieldStepRequest}
          productOptions={productOptions.options}
          productOptionsState={productOptions.state}
          selectedProducts={selectedProducts}
          onProductsChange={setSelectedProducts}
          rangeMeta={rangedYield.meta}
          rangeError={rangedYield.error}
          // The step tabs read this too, so a date range narrows IP, RTWP and
          // the rest the same way it narrows UNITS.
          dateRange={dateRange}
          // And the shared product selection, so the step tabs narrow with it.
          productScope={selectedProducts}
        />

        <AttentionCenterPanel
          alerts={visibleAlerts}
          activeTab={activeAlertTab}
          onTabChange={setActiveAlertTab}
          tabCounts={alertTabCounts}
          feedState={alertsFeedState}
          onOpenAll={() => setIsAlertsModalOpen(true)}
        />
      </main>

      <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
        <div className="bg-panel border border-line rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-line/50 pb-1.5 flex-shrink-0">
            <Shield size={15} className="text-healthy" />
            <span className="text-ink-muted text-[12px] font-black uppercase tracking-wider">
              SAFETY
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 items-center min-h-0 pt-2">
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col">
                <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                  INCIDENT
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span
                    className="text-[24px] font-black leading-none font-mono"
                    style={{ color: incidentColor }}
                  >
                    {safetyAccident}
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

            <div className="flex flex-col h-full justify-between border-l border-line/30 pl-3">
              <div className="flex flex-col">
                <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                  NEAR MISS
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span
                    className="text-[24px] font-black leading-none font-mono"
                    style={{ color: nearMissColor }}
                  >
                    {safetyNearMiss}
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

        <div className="bg-panel border border-line rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-line/50 pb-1.5 flex-shrink-0">
            <Leaf size={15} className="text-healthy" />
            <span className="text-ink-muted text-[12px] font-black uppercase tracking-wider">
              SUSTAINABILITY
            </span>
          </div>

          <div className="grid grid-cols-2 flex-1 min-h-0 pt-1.5">
            <div className="flex flex-col pr-3 min-h-0">
              <div className="mb-1.5 -mt-1.5">
                <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                  GREEN ENERGY (%)
                </span>

                <div className="text-healthy text-[24px] font-black font-mono mt-1 leading-none">
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
                  color={palette.healthy}
                  icon={CustomSymmetricalLeafIcon}
                  showValueInCenter={false}
                />
              </div>
            </div>

            <div className="flex flex-col border-l border-line/40 pl-3 min-h-0">
              <div className="mb-1.5 -mt-1.5">
                <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                  CO₂ EMISSION (tCO₂)
                </span>

                <div className="mt-1 flex items-baseline leading-none">
                  <span className="text-healthy text-[21px] font-black font-mono">
                    {co2Emission.toLocaleString()}
                  </span>
                  <span className="ml-1 text-[11px] text-ink-muted">tCO₂</span>
                </div>
              </div>

              <div className="flex-1 min-h-[55px] flex items-center">
                <div className="w-full h-full">
                  <SafetyChart
                    points={co2Points}
                    yTicks={co2YTicks}
                    xTicks={co2Labels.length ? co2Labels : safetyXTicks}
                    color={palette.healthy}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-xl pt-3 px-3 pb-[17px] flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-line/50 pb-1.5 flex-shrink-0">
            <Target size={15} className="text-healthy" />
            <span className="text-ink-muted text-[12px] font-black uppercase tracking-wider">
              CUSTOMER REFLECTION
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 items-center min-h-0 pt-2">
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col">
                <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                  COMPLAINTS
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-healthy text-[24px] font-black leading-none font-mono">
                    {customerComplaintsCount}
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
                  color={palette.healthy}
                />
              </div>
            </div>

            <div className="flex flex-col h-full justify-between border-l border-line/30 pl-3">
              <div className="flex flex-col">
                <div className="flex justify-between items-baseline">
                  <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                    ERI (%)
                  </span>
                  {eriData && (
                    <span className="text-ink-dim text-[9.5px] font-bold font-sans">
                      Target {eriData.target_pct}%
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span
                    className="text-[24px] font-black leading-none font-mono"
                    style={{ color: eriStatusColor(eriData?.status) }}
                  >
                    {customerEri}%
                  </span>
                  {eriData && (
                    <span
                      className="text-ink-dim text-[9px] font-bold font-sans truncate max-w-[50px]"
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
                  color={eriStatusColor(eriData?.status)}
                  icon={CustomEriIcon}
                  showValueInCenter={false}
                />
              </div>
              {eriData && (
                <div className="flex justify-between text-[9px] text-ink-dim font-bold mt-0.5 pb-1.5 mb-3">
                  <span>Returns</span>
                  <span className="text-white font-mono">
                    {eriData.returns} / {eriData.deliveries}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-line/50 pb-1.5 flex-shrink-0">
            <Trophy size={15} className="text-healthy" />
            <span className="text-ink-muted text-[12px] font-black uppercase tracking-wider">
              CI
            </span>
            {ciMonthLabel && (
              <span className="text-ink-dim text-[10px] font-bold ml-auto">
                {ciMonthLabel}
              </span>
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 pt-2">
            <div className="flex flex-col h-full min-h-0">
              <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                Lean savings
                <span className="text-ink-dim ml-1 normal-case">(K&euro;)</span>
              </span>
              <div className="flex items-baseline gap-1.5 mt-1 mb-3">
                <span className="text-healthy text-[24px] font-black leading-none font-mono">
                  {fmtCompact(ciTotals.leanSavings, "—")}
                </span>
              </div>
              <div className="flex-1 min-h-[44px] flex items-center justify-center mt-1">
                <div className="w-full h-full">
                  <SafetyChart
                    points={ciSavingsPoints}
                    yTicks={ciSavingsYTicks}
                    xTicks={ciMonthTicks}
                    color={palette.healthy}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col h-full min-h-0 border-l border-line/30 pl-3">
              <span className="text-ink-muted text-[11px] font-bold uppercase leading-none">
                No. of Kaizen
              </span>
              <div className="flex items-baseline gap-1.5 mt-1 mb-3">
                <span className="text-healthy text-[24px] font-black leading-none font-mono">
                  {fmtCount(ciTotals.kaizen, "—")}
                </span>
              </div>
              <div className="flex-1 min-h-[44px] flex items-center justify-center mt-1">
                <div className="w-full h-full">
                  <SafetyChart
                    points={ciKaizenPoints}
                    yTicks={ciKaizenYTicks}
                    xTicks={ciMonthTicks}
                    color={palette.healthy}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* The tile drilldown modal used to sit here. Its content — the
          per-product table — moved into the Product Yield step tabs, and the
          modal shell was reused for the NC log one level further down, which is
          opened from a row in those tabs (see ProductYieldPanel). A tile click
          now selects its step tab instead (yieldStepRequest above). */}

      {isTwinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 lg:p-8 transition-all duration-300">
          <div className="relative w-full h-full max-w-[95vw] max-h-[90vh] bg-panel border border-line rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center bg-panel/90 px-6 py-4 border-b border-line z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-info animate-pulse" />
                <span className="text-[16px] font-black text-white uppercase tracking-wider">
                  Quality Plant Floor Layout
                </span>
                <div className="flex gap-3 text-[12px] font-bold text-ink-muted ml-4">
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
                className="bg-raised hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
              >
                ✕ Close view
              </button>
            </div>

            <div className="flex-1 relative min-h-0 bg-page flex items-center justify-center p-4">
              <FactoryLayoutOverlay zones={twinZones} variant="full" />
            </div>
          </div>
        </div>
      )}

      {isAlertsModalOpen && (
        <AlertsModal
          alerts={visibleAlerts}
          activeTab={activeAlertTab}
          onTabChange={setActiveAlertTab}
          tabCounts={alertTabCounts}
          onClose={() => setIsAlertsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default QualityLayout;
