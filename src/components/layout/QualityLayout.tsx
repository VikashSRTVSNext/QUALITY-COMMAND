import React, { useState, useEffect, useMemo } from "react";
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

// TEMPORARY: hard-coded UNIT-HFTPY actual, overriding the live feed value.
const HFTPY_HARDCODED_VALUE = "77.8%";

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

  // Product-yield rows now arrive on /dashboard/stream/product-yield, unfiltered
  // and for every shift and level at once. Filtering and shaping them is cheap
  // and local, so switching a tab costs no request — it used to refetch.
  const productYield = React.useMemo(() => {
    const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
    const targetShift = shiftMatch ? shiftMatch[1].toUpperCase() : null;

    return filterYieldRows(rawProductYield, activeYieldTab, targetShift).map(
      (row: any) => ({
        id: row.id,
        name: row.product,
        // Item code, needed to open the UNIT_TEST drill-down from a UNITS row.
        // The table shows `name`; the endpoint takes the code.
        item: row.item,
        tested: fmtCount(row.tested, "—"),
        failed: isNum(row.failed) ? row.failed.toString() : "—",
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
      }),
    );
  }, [rawProductYield, activeShift, activeYieldTab]);

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
    const handleData = (data: any) => {
      if (!data) return;

      setAlertsFeedState("ready");

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
      sources.forEach((es) => es.close());
    };
  }, []);

  useEffect(() => {
    if (!rawKpiData) return;

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
          trend = rawKpiData.trend.buckets.map(
            (b: any) => b.today?.[sseKey] ?? null,
          );
          yesterdayPoints = rawKpiData.trend.buckets.map(
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
  }, [activeShift, rawKpiData, hftpyBlock]);

  useEffect(() => {
    if (!rawProcessPerformance) return;

    const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
    const shiftLetter = shiftMatch ? shiftMatch[1].toUpperCase() : null;

    setProcessPerformance((prev) => {
      return prev.map((prevItem) => {
        const apiKey =
          API_KEY_BY_TILE[prevItem.name] ?? prevItem.name.replace(/\s+/g, "_");
        const incoming = rawProcessPerformance[apiKey];

        const item = { ...prevItem, trend: incoming?.trend ?? null };
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
            const actual = incoming.index;
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
  }, [activeShift, rawProcessPerformance]);

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

    const SMT_CARD_NAMES = ["SPI", "DPMOI", "AXI - S", "SMT DEFECTS @ MFT"];
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

    const rfmCards = processPerformance.filter((p) => p.section === "RFM");
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
        />
      );
    }

    const kpiItem = kpiCards.find(
      (k) =>
        k.label === metricName || KPI_LABEL_ALIASES[metricName] === k.label,
    );
    if (kpiItem) {
      return <KpiMetricCard item={kpiItem} title={title} />;
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

    // TEMPORARY: UNIT-HFTPY actual is pinned to a fixed value until the feed
    // supplies a trustworthy number. Remove this override to go back live.
    const item =
      kpiItem.id === 9 ? { ...kpiItem, value: HFTPY_HARDCODED_VALUE } : kpiItem;

    return (
      <LargeKpiCard
        item={item}
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
          <svg
            viewBox="0 0 238 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-[82px] h-auto cursor-pointer"
            onClick={navigateToHome}
          >
            <path
              d="M164.52 1.70304V54.2969H172.407V1.70304H164.52ZM80.2509 0.804622C64.8848 0.804553 52.9624 11.9886 52.9624 28C52.9624 44.7324 64.8848 55.1957 80.2509 55.1954C95.6171 55.1951 107.564 44.7324 107.539 28C107.517 12.8299 95.6171 0.804691 80.2509 0.804622ZM99.6661 28C99.6661 39.8532 90.9737 47.7084 80.2509 47.7084C69.5282 47.7084 60.8357 39.8532 60.8357 28C60.8357 16.3618 69.5282 8.29171 80.2509 8.29171C90.9737 8.29171 99.6661 16.3618 99.6661 28ZM0 4.74601e-06V54.2969H8.04989V18.4143L49.8817 56V44.7427L0 4.74601e-06ZM113.472 28L142.745 54.297H154.483L125.165 28L154.483 1.70302H142.745L113.472 28ZM238 54.2969H229.323L222.978 42.6502H194.239L187.893 54.2969H179.215L189.724 34.8846H218.851L204.327 7.90705L208.608 0L238 54.2969Z"
              fill={palette.white}
            />
          </svg>

          <div className="h-8 w-[1px] bg-line-strong mx-1.5 self-center" />
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] xl:text-[17px] font-black text-white leading-none tracking-wide whitespace-nowrap">
              QUALITY EXCELLENCE CENTER
            </span>
            <span className="text-[11px] xl:text-[12.5px] font-bold text-info leading-none tracking-wider whitespace-nowrap">
              CHENNAI FACTORY
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
                  : "No BMS reading available for today"
              }
            >
              {shopFloorConditions.temp !== null
                ? `${shopFloorConditions.temp.toFixed(1)}°C`
                : "N/A"}
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
                  : "No BMS reading available for today"
              }
            >
              {shopFloorConditions.humidity !== null
                ? `${shopFloorConditions.humidity.toFixed(1)}%`
                : "N/A"}
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
          <div className="flex items-baseline gap-2 border-b border-line/50 pb-2 mb-3.5 flex-shrink-0">
            <span className="text-[12px] font-black tracking-widest text-ink-muted uppercase">
              PROCESS PERFORMANCE
            </span>
            <span className="text-[10px] font-bold tracking-wider text-ink-dim normal-case">
              [Hourly]
            </span>
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
          fetchState={yieldFetchState}
          recommendations={yieldRecommendations}
          recsLoading={yieldRecsLoading}
          planStatus={yieldPlanStatus}
          shift={
            activeShift.match(/Shift\s+([A-C])/i)?.[1].toUpperCase() ?? null
          }
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

      <footer className="flex items-center justify-end gap-2 flex-shrink-0 border-t border-line/60 py-0.5">
        <span className="text-[9px] font-semibold text-ink-dim leading-none">
          Powered by
        </span>
        <svg
          width="66"
          height="22"
          viewBox="0 0 94 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
        >
          <rect width="66" height="22" fill="url(#pattern0_15409_74893)" />
          <defs>
            <pattern
              id="pattern0_15409_74893"
              patternContentUnits="objectBoundingBox"
              width="1"
              height="1"
            >
              <use
                xlinkHref="#image0_15409_74893"
                transform="matrix(0.000992908 0 0 0.00333333 -0.00177305 0)"
              />
            </pattern>
            <image
              id="image0_15409_74893"
              width="1000"
              height="300"
              preserveAspectRatio="none"
              xlinkHref="data:image/png;base64,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AhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhC4LwL/D2fBbPsIV2HMAAAAAElFTkSuQmCC"
            />
          </defs>
        </svg>
      </footer>

      {/* The tile drilldown modal used to sit here. Its content — the
          per-product table — moved into the Product Yield step tabs, and the
          modal shell was reused for the NC log one level further down, which is
          opened from a row in those tabs (see ProductYieldPanel). Tile
          click-through is off in ProcessMetricCard; re-enabling it means
          deciding which level a tile should open. */}

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
