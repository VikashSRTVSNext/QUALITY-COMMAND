import React, { useState, useEffect } from "react";
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
  Wrench,
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
import { ZONES, ZoneDef } from "../factory/zones";

import FactoryQualityTwin from "./FactoryQualityTwin";

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

const CustomDocumentWarningIcon = ({
  size = 24,
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
    {/* Document outline with folded corner */}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M20 8v6" />
    {/* Horizontal text lines */}
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="7" y1="16" x2="12" y2="16" />
    {/* circular exclamation mark on the bottom right */}
    <circle
      cx="17.5"
      cy="17.5"
      r="4.5"
      fill="#070e17"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <line
      x1="17.5"
      y1="15.5"
      x2="17.5"
      y2="18"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <circle cx="17.5" cy="19.5" r="0.5" fill="currentColor" />
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

const SafetyChart = ({
  points,
  yTicks,
  xTicks,
  color = "#ef4444",
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
    <div className="w-full h-[70px] 2xl:h-[55px] mt-1 relative select-none">
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
                stroke="#142337"
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
                stroke={isHovered ? "#ffffff" : "#070e17"}
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
                    fill="#070e17"
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
          const isMiddle = i === Math.floor(xTicks.length / 2);
          const shouldRender = isFirst || isLast || isMiddle;
          if (!shouldRender) return null;

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
}: any) => {
  const radius = 32;
  const strokeWidth = 6;
  const cx = 60;
  const cy = 38;

  const circumference = Math.PI * radius;
  const percentage = (value - min) / (max - min);
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
          stroke="#0f172a"
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
          fill="#526a8a"
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
          fill="#526a8a"
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
            {value}%
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

const processPerformanceData = [
  {
    name: "SPI",
    icon: Search,
    section: "SMT",
    type: "yield",
    data: { done: "12,450", ok: "12,221", yield: "98.16%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "DPMOI",
    icon: Camera,
    section: "SMT",
    type: "dpmo",
    data: { defects: "...", opportunities: "...", index: "..." },
    status: "...",
    color: "#1e293b",
  },
  {
    name: "AXI",
    icon: Scan,
    section: "SMT",
    type: "yield",
    data: { done: "11,180", ok: "11,001", yield: "98.40%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "SMT DEFECTS",
    icon: Cpu,
    section: "SMT",
    type: "yield",
    data: { done: "10,890", ok: "10,702", yield: "98.27%" },
    status: "Healthy",
    color: "#10b981",
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
    color: "#ef4444",
  },
  {
    name: "LBTS",
    icon: Zap,
    section: "RFM",
    type: "yield",
    data: { done: "610", ok: "602", yield: "98.69%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "THERMAL TEST",
    icon: Thermometer,
    section: "RFM",
    type: "yield",
    data: { done: "590", ok: "586", yield: "99.32%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "OTA",
    icon: Cpu,
    section: "RFM",
    type: "yield",
    data: { done: "540", ok: "531", yield: "98.33%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "RTWP",
    icon: Zap,
    section: "RFM",
    type: "yield",
    data: { done: "520", ok: "512", yield: "98.46%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "IP",
    icon: Scan,
    section: "RFM",
    type: "yield",
    data: { done: "510", ok: "502", yield: "98.43%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "AUTO OGI",
    icon: Search,
    section: "RFM",
    type: "yield",
    data: { done: "840", ok: "832", yield: "98.05%" },
    status: "Healthy",
    color: "#10b981",
  },
];

const SHIFTS = [
  "Shift A (06:15 AM - 02:15 PM)",
  "Shift B (02:15 PM - 10:15 PM)",
  "Shift C (10:15 PM - 06:15 AM)",
  "Full Day (06:15 AM - 06:15 AM)",
];

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
  const [kpiCards, setKpiCards] = useState(
    qualityData.kpiCards.map((card) => {
      const isPercent = [1, 2, 3, 4, 5, 7].includes(card.id);
      return {
        ...card,
        title: card.label,
        value: isPercent ? `${card.value.toFixed(1)}%` : `${card.value}`,
        change: isPercent
          ? `▲ ${card.delta_vs_yesterday.toFixed(1)}% vs Yesterday`
          : `▲ ${card.delta_vs_yesterday} vs yesterday`,
        points: card.trend,
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
  const [yieldPage, setYieldPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [processPerformance, setProcessPerformance] = useState<any[]>(
    processPerformanceData.map((item) => ({
      ...item,
      data:
        item.type === "yield"
          ? { done: "...", ok: "...", yield: "..." }
          : { failure: "..." },
      status: "...",
      color: "#1e293b",
    })),
  );
  const [productYield, setProductYield] = useState<any[]>([]);
  const [rawKpiData, setRawKpiData] = useState<any>(null);
  const [rawProcessPerformance, setRawProcessPerformance] = useState<any>(null);
  const [attentionCenterAlerts, setAttentionCenterAlerts] = useState<any[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [criticalTotal, setCriticalTotal] = useState(0);
  const [safetyAccident, setSafetyAccident] = useState(0);
  const [safetyNearMiss, setSafetyNearMiss] = useState(0);
  const [accidentPoints, setAccidentPoints] = useState<number[]>([]);
  const [nearMissPoints, setNearMissPoints] = useState<number[]>([]);
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
  const [greenEnergyPct, setGreenEnergyPct] = useState(0);
  const [co2Emission, setCo2Emission] = useState(0);
  const [customerIncidents, setCustomerIncidents] = useState(0);
  const [customerEri, setCustomerEri] = useState(0);
  const [eriData, setEriData] = useState<EriData | null>(null);
  const [ciLeanSavingsPct, setCiLeanSavingsPct] = useState(0);
  const [ciLeanSavingsVal, setCiLeanSavingsVal] = useState("...");
  const [ciKaizenPct, setCiKaizenPct] = useState(0);
  const [ciKaizenVal, setCiKaizenVal] = useState("...");
  const [twinZones, setTwinZones] = useState<ZoneDef[]>(ZONES);
  const [shopFloorConditions, setShopFloorConditions] = useState<{
    temp: number | null;
    humidity: number | null;
  }>({ temp: null, humidity: null });

  const currentYieldData = React.useMemo(() => {
    return productYield;
  }, [productYield]);

  const totalYieldPages =
    Math.ceil(currentYieldData.length / ITEMS_PER_PAGE) || 1;
  const paginatedYieldData = currentYieldData.slice(
    (yieldPage - 1) * ITEMS_PER_PAGE,
    yieldPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setYieldPage(1);
  }, [activeYieldTab]);

  // Fetch product yield from REST API every 5 minutes and when shift or tab changes
  useEffect(() => {
    const fetchYieldData = async () => {
      const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
      const targetShift = shiftMatch ? shiftMatch[1].toUpperCase() : "D";
      const targetLevel = activeYieldTab === "UNITS" ? "UNIT" : activeYieldTab;

      try {
        const url = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/dashboard/product-yield?shift=${targetShift}&level=${targetLevel}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch product yield");
        const data = await res.json();
        if (data && data.rows) {
          const mappedRows = data.rows.map((row: any) => ({
            id: row.id,
            name: row.product,
            tested: row.tested.toLocaleString(),
            failed: row.failed.toString(),
            fpy: row.fpy,
            spy: row.spy,
            target: row.target_yield,
            status:
              row.status === "healthy"
                ? "Healthy"
                : row.status === "risk" || row.status === "at_risk"
                  ? "At Risk"
                  : "Critical",
            rec: row.ai_recommendation,
            shift: row.shift,
            sub_module: row.sub_module,
          }));
          setProductYield(mappedRows);
        }
      } catch (err) {
        console.error("Error fetching product yield:", err);
      }
    };

    fetchYieldData();
    const interval = setInterval(fetchYieldData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [activeShift, activeYieldTab]);

  // Fetch safety data from REST API
  useEffect(() => {
    const fetchSafetyData = async () => {
      try {
        const url = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/dashboard/safety`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch safety data");
        const data = await res.json();
        if (data) {
          if (data.current) {
            setSafetyAccident(data.current.incident ?? 0);
            setSafetyNearMiss(data.current.near_miss ?? 0);
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
        const url = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/dashboard/eri`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch ERI data");
        const data = await res.json();
        if (data && data.eri) {
          setEriData(data.eri);
          if (data.eri.eri_pct !== undefined && data.eri.eri_pct !== null) {
            setCustomerEri(data.eri.eri_pct);
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
    // Point at the FastAPI yield feed via env; falls back to the legacy tunnel.
    // Local docker stack: VITE_DASHBOARD_SSE_URL=http://localhost:8000/dashboard/stream
    const sseUrl = import.meta.env.VITE_DASHBOARD_SSE_URL;
    const es = new EventSource(sseUrl);

    const mapStatus = (
      status: string,
    ): "healthy" | "warning" | "critical" | "unknown" => {
      if (status === "at_risk" || status === "warning") return "warning";
      if (status === "critical") return "critical";
      if (status === "healthy") return "healthy";
      return "unknown";
    };

    const handleData = (data: any) => {
      if (!data) return;

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

      // 2b. Shop Floor Conditions
      if (data.shop_floor_conditions) {
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

      // 4. Factory Quality Twin
      if (data.factory_quality_twin) {
        setTwinZones((prev) => {
          return prev.map((zone) => {
            const incoming = data.factory_quality_twin.find(
              (z: any) => z.station.toUpperCase() === zone.name.toUpperCase(),
            );
            if (incoming) {
              return {
                ...zone,
                status: mapStatus(incoming.status),
              };
            }
            return zone;
          });
        });
      }

      // 5. Product Yield - Handled by separate REST API polling now

      // 6. Attention Center Alerts
      if (data.attention_center) {
        if (data.attention_center.alerts) {
          const mappedAlerts = data.attention_center.alerts.map((a: any) => ({
            id: a.id,
            title: a.title,
            time: `${a.age_minutes}m ago`,
            current: `${a.current}%`,
            target: `${a.target}%`,
            dev: `${a.deviation >= 0 ? "+" : ""}${a.deviation}%`,
            level: a.severity === "critical" ? "Critical" : "Risk",
            impact: a.impact.charAt(0).toUpperCase() + a.impact.slice(1),
            rec: a.ai_recommendation,
          }));
          setAttentionCenterAlerts(mappedAlerts);
        }
        setAlertsTotal(
          data.attention_center.alerts_total ??
            data.attention_center.alerts?.length ??
            0,
        );
        setCriticalTotal(
          data.attention_center.critical_total ??
            data.attention_center.alerts?.filter(
              (x: any) => x.severity === "critical",
            ).length ??
            0,
        );
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
          setCo2Emission(data.sustainability.co2_emission_tco2.value);
          if (data.sustainability.co2_emission_tco2.trend)
            setCo2Points(data.sustainability.co2_emission_tco2.trend);
        }
      }

      // 9. Customer Reflection
      if (data.customer_reflection) {
        if (data.customer_reflection.incidents !== undefined)
          setCustomerIncidents(data.customer_reflection.incidents.value);
        if (data.customer_reflection.eri_pct !== undefined)
          setCustomerEri(data.customer_reflection.eri_pct.value);
      }
      if (data.eri) {
        setEriData(data.eri);
        if (data.eri.eri_pct !== undefined && data.eri.eri_pct !== null) {
          setCustomerEri(data.eri.eri_pct);
        }
      }


      // 10. CI
      if (data.ci) {
        if (data.ci.lean_savings) {
          setCiLeanSavingsPct(data.ci.lean_savings.pct);
          const val = data.ci.lean_savings.achieved;
          const formattedVal =
            val >= 1000 ? `${(val / 1000).toFixed(0)}K €` : `${val} €`;
          setCiLeanSavingsVal(formattedVal);
        }
        if (data.ci.kaizen) {
          setCiKaizenPct(data.ci.kaizen.pct);
          const val = data.ci.kaizen.achieved;
          const formattedVal =
            val >= 1000 ? `${(val / 1000).toFixed(0)}K` : `${val}`;
          setCiKaizenVal(formattedVal);
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
        if (parsed.kpis || parsed.meta) {
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
        let trend: any = null;

        // Parse active shift name (e.g., "Shift A (06:15 AM - 02:15 PM)" -> "A")
        const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
        const shiftLetter = shiftMatch ? shiftMatch[1].toUpperCase() : null;

        const isShiftSpecificKpi = [
          "fpy_unit",
          "spy_unit",
          "fpy_module",
          "spy_module",
        ].includes(sseKey);

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
            // Get delta/trend from day summary if available, since shift entries don't have delta
            if (rawKpiData.day) {
              const dayItem = rawKpiData.day[sseKey];
              if (dayItem && typeof dayItem === "object") {
                delta = dayItem.delta_vs_yesterday ?? 0;
                trend = dayItem.trend;
              }
            }
          } else {
            // Shift C or missing shift has no data -> set to 0
            val = 0;
            delta = 0;
            trend = null;
          }
        }

        // Fall back to day-level KPIs if KPI is not shift-specific or shift-specific was not resolved
        if (val === null) {
          if (rawKpiData.day) {
            const dayItem = rawKpiData.day[sseKey];
            if (dayItem !== undefined && dayItem !== null) {
              val = typeof dayItem === "object" ? dayItem.value : dayItem;
              delta =
                typeof dayItem === "object" ? dayItem.delta_vs_yesterday : 0;
              trend = typeof dayItem === "object" ? dayItem.trend : null;
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

        if (val !== null && val !== undefined) {
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
          };
        }

        return card;
      });
    });
  }, [activeShift, rawKpiData]);

  // Update process performance cards when active shift or raw process performance data changes
  useEffect(() => {
    if (!rawProcessPerformance) return;

    // Parse active shift name (e.g., "Shift A (06:15 AM - 02:15 PM)" -> "A")
    const shiftMatch = activeShift.match(/Shift\s+([A-C])/i);
    const shiftLetter = shiftMatch ? shiftMatch[1].toUpperCase() : null;

    setProcessPerformance((prev) => {
      return prev.map((item) => {
        const getApiKey = (name: string) => {
          if (name === "OTA") return "OTA_TEST";
          return name.replace(/\s+/g, "_");
        };

        const apiKey = getApiKey(item.name);
        const incoming = rawProcessPerformance[apiKey];
        if (incoming) {
          if (item.name === "DPMOI") {
            const statusMapped =
              incoming.index <= 10
                ? "Healthy"
                : incoming.index <= 50
                  ? "At Risk"
                  : "Critical";
            const colorMapped =
              statusMapped === "Healthy"
                ? "#10b981"
                : statusMapped === "At Risk"
                  ? "#eab308"
                  : "#ef4444";
            return {
              ...item,
              data: {
                defects:
                  incoming.defects !== undefined
                    ? incoming.defects.toLocaleString()
                    : "...",
                opportunities:
                  incoming.opportunities !== undefined
                    ? incoming.opportunities.toLocaleString()
                    : "...",
                index:
                  incoming.index !== undefined
                    ? incoming.index.toFixed(2)
                    : "...",
              },
              status: statusMapped,
              color: colorMapped,
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
            const statusMapped =
              targetData.status === "healthy"
                ? "Healthy"
                : targetData.status === "at_risk" ||
                    targetData.status === "warning"
                  ? "At Risk"
                  : "Critical";
            const colorMapped =
              targetData.status === "healthy"
                ? "#10b981"
                : targetData.status === "at_risk" ||
                    targetData.status === "warning"
                  ? "#eab308"
                  : "#ef4444";

            if (
              targetData.failure_pct !== undefined &&
              targetData.failure_pct !== null
            ) {
              return {
                ...item,
                data: { failure: `${targetData.failure_pct.toFixed(1)}%` },
                status: statusMapped,
                color: colorMapped,
              };
            } else {
              return {
                ...item,
                data: {
                  done:
                    targetData.done !== undefined
                      ? targetData.done.toLocaleString()
                      : "...",
                  ok:
                    targetData.ok !== undefined
                      ? targetData.ok.toLocaleString()
                      : "...",
                  yield:
                    targetData.yield_pct !== undefined
                      ? `${targetData.yield_pct.toFixed(2)}%`
                      : "...",
                },
                status: statusMapped,
                color: colorMapped,
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
              color: "#3b82f6",
            };
          }
        }
        return item;
      });
    });
  }, [activeShift, rawProcessPerformance]);

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

  const getTimelineNodeColor = (card: (typeof processPerformanceData)[0]) => {
    if (card.section === "SMT") return "#0091ff";
    if (card.status === "Critical") return "#ef4444";
    if (card.status === "At Risk") return "#eab308";
    return "#10b981";
  };

  const getCardBorderColor = (card: (typeof processPerformanceData)[0]) => {
    if (card.status === "Critical") return "#ef4444";
    if (card.status === "At Risk") return "#eab308";
    return card.section === "SMT" ? "#0091ff" : "#10b981";
  };

  const renderFullSparkline = (points: number[], strokeColor: string) => {
    const width = 160;
    const height = 24;
    const padding = 6;
    const chartHeight = height - padding * 2;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const svgPoints = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = padding + chartHeight - ((p - min) / range) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible opacity-40"
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
          `}
        </style>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          points={svgPoints}
          className="animate-sparkline"
        />
      </svg>
    );
  };

  const getKpiIcon = (id: number, color: string) => {
    const props = { size: 18, className: "flex-shrink-0", style: { color } };
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
      default:
        return null;
    }
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
  const nearMissYTicks = getYTicks(nearMissPoints, 5);

  return (
    <div className="w-full min-h-screen bg-[#02070e] text-[#f8fafc] flex flex-col p-4 box-border gap-4 font-sans select-none">
      {/* Top Branding & SubHeader Row */}
      <header className="flex flex-col lg:flex-row justify-between items-center bg-[#070e17] border border-[#142337] rounded-xl px-3.5 py-1.5 gap-3">
        {/* Left Side Branding */}
        <div className="flex items-center gap-3">
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
          <div className="h-8 w-[1px] bg-[#1d3557] mx-1.5 self-center" />

          <div className="flex flex-col">
            <span className="text-[17px] font-black text-white leading-none tracking-wide">
              QUALITY COMMAND CENTER
            </span>
            <span className="text-[13px] text-[#06b6d4] font-bold mt-1 tracking-wider uppercase">
              NOKIA CHENNAI PLANT
            </span>
          </div>
        </div>

        {/* Right Side Widgets / Telemetry */}
        <div className="flex items-center gap-3.5 flex-wrap text-[#8fa0b5] font-mono text-[14px]">
          <span className="text-[#526a8a]">{dateStr}</span>
          <span className="h-3.5 w-[1px] bg-[#142337]" />
          <span className="text-white font-bold">{timeStr}</span>
          <span className="h-3.5 w-[1px] bg-[#142337]" />

          <div
            className={`flex items-center gap-1.5 border px-2.5 py-0.5 rounded text-[13px] font-black ${
              isStatusLive
                ? "border-[#10b981]/30 bg-[#10b981]/5 text-[#10b981]"
                : "border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isStatusLive ? "bg-[#10b981]" : "bg-[#ef4444]"}`}
            />
            {liveStatus}
          </div>

          <div className="relative">
            <div
              className="bg-[#0a1523] border border-[#1b3252] rounded px-2.5 py-0.5 text-[13px] text-white font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#122339] transition-colors"
              onClick={() => setIsShiftDropdownOpen(!isShiftDropdownOpen)}
            >
              <span>{activeShift}</span>
              <ChevronDown
                size={11}
                className={`text-[#526a8a] transition-transform duration-200 ${isShiftDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>

            {isShiftDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsShiftDropdownOpen(false)}
                />
                <div className="absolute top-full right-0 mt-1 bg-[#0a1523] border border-[#1b3252] rounded-lg shadow-xl shadow-black/50 overflow-hidden z-50 w-max">
                  {SHIFTS.map((shift) => (
                    <div
                      key={shift}
                      className={`px-3 py-2 text-[14px] cursor-pointer hover:bg-[#1e3a8a] hover:text-white transition-colors ${activeShift === shift ? "text-white bg-[#142337]" : "text-[#8fa0b5]"}`}
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
            className="p-1.5 hover:bg-[#122339] rounded border border-[#1b3252] cursor-pointer text-[#8fa0b5] outline-none"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </header>

      {/* Row 1: Top KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.slice(0, 5).map((card) => {
          const accent = card.color ?? "#a3e635";
          return (
            <div
              key={card.id}
              className="bg-[#070e17] border border-[#142337] rounded-xl p-2.5 flex flex-col justify-between h-[114px] relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{ boxShadow: `0 4px 12px ${accent}15` }}
            >
              <div className="flex items-center gap-1.5 z-10">
                {getKpiIcon(card.id, accent)}
                <span className="text-white text-[12px] uppercase font-bold tracking-wider leading-tight">
                  {card.title}
                </span>
              </div>
              <div className="flex flex-col mt-0.5 z-10 mb-0.5">
                <span
                  className="text-[26px] font-black font-mono leading-none"
                  style={{ color: accent, textShadow: `0 0 8px ${accent}40` }}
                >
                  {card.value}
                </span>
                <span
                  className="text-[11.5px] font-bold mt-0.5"
                  style={{ color: accent }}
                >
                  {card.change}
                </span>
              </div>
              <div className="absolute bottom-[8px] left-0 right-0 h-[24px] pointer-events-none">
                {renderFullSparkline(card.points, accent)}
              </div>
            </div>
          );
        })}

        {/* Shop Floor Conditions Card */}
        <div
          className="bg-[#070e17] border border-[#142337] rounded-xl p-2.5 flex flex-col justify-between h-[114px] relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
          style={{ boxShadow: "0 4px 12px #06b6d415" }}
        >
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5">
              <Thermometer size={18} className="flex-shrink-0 text-[#06b6d4]" />
              <span className="text-white text-[11px] uppercase font-bold tracking-wider leading-tight">
                SHOP FLOOR CONDITIONS
              </span>
            </div>
          </div>
          <div className="flex items-center justify-around z-10 mt-1">
            {/* Temperature */}
            <div className="flex flex-col items-center">
              <span
                className="text-[22px] font-black font-mono leading-none text-[#06b6d4]"
                style={{ textShadow: "0 0 8px #06b6d440" }}
              >
                {shopFloorConditions.temp !== null
                  ? `${shopFloorConditions.temp}°`
                  : "N/A"}
              </span>
              <span className="text-[10px] text-[#526a8a] mt-0.5 font-medium">
                Temperature
              </span>
            </div>
            {/* Divider */}
            <div className="w-[1px] h-8 bg-[#1d324b]" />
            {/* Humidity */}
            <div className="flex flex-col items-center">
              <span
                className="text-[22px] font-black font-mono leading-none text-[#06b6d4]"
                style={{ textShadow: "0 0 8px #06b6d440" }}
              >
                {shopFloorConditions.humidity !== null
                  ? `${shopFloorConditions.humidity}%`
                  : "N/A"}
              </span>
              <span className="text-[10px] text-[#526a8a] mt-0.5 font-medium">
                Humidity
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 z-10">
            <Droplets size={10} className="text-[#06b6d4]" />
            <span className="text-[10px] text-[#526a8a]">
              Live sensor reading
            </span>
          </div>
        </div>
      </section>

      {/* Row 2: Process Performance */}
      <section className="bg-[#070e17] border border-[#142337] rounded-xl p-4 flex flex-col">
        {/* Title for mobile/tablet */}
        <span className="lg:hidden text-[#06b6d4] text-[15px] uppercase font-bold tracking-widest mb-3">
          PROCESS PERFORMANCE
        </span>

        {/* Brackets row for desktop */}
        <div className="hidden lg:grid grid-cols-12 gap-2 items-center mb-3">
          {/* SMT Section Bracket */}
          <div className="col-span-4 flex items-center gap-2">
            <span className="text-[#f8fafc] text-[12px] font-black tracking-wider uppercase flex-shrink-0">
              PROCESS PERFORMANCE
            </span>
            <div className="flex-1 flex items-center">
              <div className="flex-1 h-[1.5px] bg-[#0091ff]" />
              <span className="px-2.5 text-[#0091ff] text-[12.5px] font-black tracking-widest">
                SMT
              </span>
              <div className="flex-1 h-[1.5px] bg-[#0091ff]" />
              {/* Downward tick */}
              <div className="h-[7px] w-[1.5px] bg-[#0091ff] self-end" />
            </div>
          </div>

          {/* RFM Section Bracket */}
          <div className="col-span-8 flex items-center">
            {/* Downward tick */}
            <div className="h-[7px] w-[1.5px] bg-[#10b981] self-end" />
            <div className="flex-1 flex items-center">
              <div className="flex-1 h-[1.5px] bg-[#10b981]" />
              <span className="px-2.5 text-[#10b981] text-[12.5px] font-black tracking-widest">
                RFM
              </span>
              <div className="flex-1 h-[1.5px] bg-[#10b981]" />
              {/* Arrowhead */}
              <div className="w-1.5 h-1.5 border-t-[1.5px] border-r-[1.5px] border-[#10b981] rotate-45 -mr-[3px] -mt-[0.5px]" />
              {/* Downward tick */}
              <div className="h-[7px] w-[1.5px] bg-[#10b981] self-end" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-1.5 2xl:gap-2">
          {processPerformance.map((item, idx) => {
            const cardColor = getCardBorderColor(item);
            const colorCurrent = getTimelineNodeColor(item);
            const colorNext =
              idx < processPerformance.length - 1
                ? getTimelineNodeColor(processPerformance[idx + 1])
                : "";

            return (
              <div key={idx} className="flex flex-col w-full min-w-0">
                {/* Card */}
                <div
                  className={`bg-[#040910] border rounded-lg p-1 2xl:p-2 pb-1.5 2xl:pb-2.5 flex flex-col h-[116px] 2xl:h-[135px] transition-all duration-300 ${
                    item.status === "Critical"
                      ? "animate-border-pulse-critical"
                      : ""
                  }`}
                  style={{
                    borderColor:
                      item.status === "Critical" ? undefined : `${cardColor}40`,
                    boxShadow:
                      item.status === "Critical"
                        ? undefined
                        : `0 4px 12px ${cardColor}15`,
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start gap-1 mb-0.5 2xl:mb-1.5 flex-shrink-0">
                    <item.icon
                      size={10}
                      className="text-white flex-shrink-0 mt-[1px] 2xl:size-[12px]"
                    />
                    <span className="text-white text-[9.5px] 2xl:text-[12px] font-black uppercase leading-tight truncate">
                      {item.name}
                    </span>
                  </div>
                  {/* Body */}
                  <div className="flex-1 flex flex-col justify-start gap-0.5 mt-0.5 min-h-0">
                    {item.type === "yield" && (
                      <>
                        <div className="flex justify-between text-[9px] 2xl:text-[11.5px]">
                          <span className="text-[#8fa0b5]">Done</span>
                          <span className="text-white font-mono">
                            {item.data.done}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] 2xl:text-[11.5px]">
                          <span className="text-[#8fa0b5]">OK</span>
                          <span className="text-white font-mono">
                            {item.data.ok}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] 2xl:text-[11.5px]">
                          <span className="text-[#8fa0b5]">Yield</span>
                          <span
                            className="font-bold font-mono"
                            style={{ color: item.color }}
                          >
                            {item.data.yield}
                          </span>
                        </div>
                      </>
                    )}
                    {item.type === "dpmo" && (
                      <>
                        <div className="flex justify-between text-[9px] 2xl:text-[11.5px]">
                          <span className="text-[#8fa0b5]">Defects</span>
                          <span className="text-white font-mono">
                            {item.data.defects}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] 2xl:text-[11.5px]">
                          <span className="text-[#8fa0b5]">Opps</span>
                          <span
                            className="text-white font-mono truncate max-w-[45px]"
                            title={item.data.opportunities}
                          >
                            {item.data.opportunities}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] 2xl:text-[11.5px]">
                          <span className="text-[#8fa0b5]">Index</span>
                          <span
                            className="font-bold font-mono"
                            style={{ color: item.color }}
                          >
                            {item.data.index}
                          </span>
                        </div>
                      </>
                    )}
                    {item.type === "failure" && (
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <span className="text-[#8fa0b5] text-[9px] 2xl:text-[11.5px]">
                          Failure %
                        </span>
                        <span
                          className="text-[13px] 2xl:text-[18px] font-black mt-0.5 font-mono"
                          style={{
                            color: item.color,
                            textShadow: `0 0 8px ${item.color}30`,
                          }}
                        >
                          {item.data.failure}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Footer (inside card) */}
                  <div className="flex items-center gap-1 mt-auto flex-shrink-0 pt-0.5 2xl:pt-1.5">
                    <div
                      className="w-1.5 h-1.5 2xl:w-2 2xl:h-2 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}`,
                      }}
                    />
                    <span
                      className="text-[8.5px] 2xl:text-[10px]"
                      style={{
                        color: item.color,
                        textShadow:
                          item.status === "Critical"
                            ? `0 0 8px ${item.color}80`
                            : "none",
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Timeline Node */}
                <div className="relative h-6 flex justify-center items-center w-full mt-2">
                  {/* Right line segment (connecting this node to the next) */}
                  {idx !== processPerformanceData.length - 1 && (
                    <div
                      className="absolute left-[50%] right-[-50%] h-[2px] top-1/2 -translate-y-1/2 z-0"
                      style={{
                        background: `linear-gradient(to right, ${colorCurrent}, ${colorNext})`,
                      }}
                    />
                  )}
                  {/* Dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full relative z-10 ring-[3px] ring-[#070e17] transition-all duration-300"
                    style={{
                      backgroundColor: colorCurrent,
                      boxShadow: `0 0 10px ${colorCurrent}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Row 3: Middle Analysis Hub */}
      <main className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.8fr)_minmax(0,5fr)_minmax(0,2.5fr)] gap-4">
        {/* Section 1: Factory Quality Twin */}
        <section className="bg-[#070e17] border border-white/20 rounded-xl p-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-[#142337]/50 pb-2 mb-3 flex-shrink-0">
            <span className="text-[15.5px] font-black tracking-widest text-[#06b6d4]">
              QUALITY HEATMAP
            </span>
            <div className="flex gap-3 text-[12px] font-bold">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />{" "}
                Healthy
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#eab308] shadow-[0_0_8px_#eab308]" />{" "}
                At Risk
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_#ef4444]" />{" "}
                Critical
              </div>
            </div>
          </div>

          <div className="flex-1 relative bg-[#040910] border border-white/15 rounded-lg overflow-hidden flex items-center justify-center">
            <FactoryQualityTwin
              preview={true}
              onMaximize={() => setIsTwinModalOpen(true)}
              zones={twinZones}
            />
          </div>
        </section>

        {/* Section 2: Product Yield */}
        <section className="bg-[#070e17] border border-[#142337] rounded-xl p-4 flex flex-col h-[400px]">
          <span className="text-[15.5px] font-black tracking-widest text-[#06b6d4] uppercase mb-1.5">
            PRODUCT YIELD
          </span>
          {/* Tabs */}
          <div className="flex gap-2 mb-1.5">
            <button
              onClick={() => setActiveYieldTab("UNITS")}
              className={`${activeYieldTab === "UNITS" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#040910] text-[#526a8a] border-[#142337] hover:bg-[#142337]"} border text-[11px] font-bold px-4 py-1 rounded uppercase transition-colors`}
            >
              UNITS
            </button>
            <button
              onClick={() => setActiveYieldTab("TRX")}
              className={`${activeYieldTab === "TRX" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#040910] text-[#526a8a] border-[#142337] hover:bg-[#142337]"} border text-[11px] font-bold px-4 py-1 rounded uppercase transition-colors`}
            >
              TRX
            </button>
            <button
              onClick={() => setActiveYieldTab("PA")}
              className={`${activeYieldTab === "PA" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#040910] text-[#526a8a] border-[#142337] hover:bg-[#142337]"} border text-[11px] font-bold px-4 py-1 rounded uppercase transition-colors`}
            >
              PA
            </button>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-[720px] text-left text-[12px] border-collapse relative">
              <thead>
                <tr className="border-b border-[#142337] text-[#526a8a] font-bold text-[10px] uppercase">
                  <th className="pb-1.5 font-black pl-2">#</th>
                  <th className="pb-1.5 font-black">PRODUCT NAME</th>
                  <th className="pb-1.5 font-black text-center">TESTED</th>
                  <th className="pb-1.5 font-black text-center">
                    FAILED COUNT
                  </th>
                  <th className="pb-1.5 font-black text-center">FPY %</th>
                  <th className="pb-1.5 font-black text-center">SPY %</th>
                  <th className="pb-1.5 font-black text-center">
                    TARGET YIELD %
                  </th>
                  <th className="pb-1.5 font-black text-center">FPY STATUS</th>
                  <th className="pb-1.5 font-black pl-3">AI RECOMMENDATION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142337]/45 font-mono text-[11px]">
                {paginatedYieldData.map((row) => (
                  <tr key={row.id} className="hover:bg-[#0a1523]/40">
                    <td className="py-[4px] text-[#8fa0b5] pl-2">{row.id}</td>
                    <td className="py-[4px] text-white font-sans font-bold">
                      {row.name}
                    </td>
                    <td className="py-[4px] text-center text-white">
                      {row.tested}
                    </td>
                    <td className="py-[4px] text-center text-white">
                      {row.failed}
                    </td>
                    <td className="py-[4px] text-center font-bold">
                      <span
                        className={
                          row.fpy >= row.target
                            ? "text-[#10b981]"
                            : "text-[#eab308]"
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
                              row.fpy >= row.target ? "#10b981" : "#eab308"
                            }
                            strokeWidth="1.5"
                            points={
                              row.fpy >= row.target
                                ? "0,10 5,5 10,8 15,2 20,4"
                                : "0,2 5,8 10,4 15,10 20,6"
                            }
                          />
                        </svg>
                      </span>
                    </td>
                    <td className="py-[4px] text-center text-white font-bold">
                      {row.spy.toFixed(1)}%
                    </td>
                    <td className="py-[4px] text-center text-white">
                      {row.target}%
                    </td>
                    <td className="py-[4px] text-center">
                      <span
                        className={`text-[9.5px] font-black px-1.5 py-0.5 rounded border border-[#142337]/50 ${
                          row.status === "Healthy"
                            ? "bg-[#10b981]/10 text-[#10b981]"
                            : row.status === "At Risk"
                              ? "bg-[#eab308]/10 text-[#eab308]"
                              : "bg-[#ef4444]/10 text-[#ef4444]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-[4px] pl-3 text-[#cdd4de] font-sans text-[10px] leading-tight">
                      <div className="flex items-center gap-1">
                        <Wrench
                          size={10}
                          className="text-[#8fa0b5] flex-shrink-0"
                        />
                        <span className="truncate max-w-[120px]">
                          {row.rec}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-end items-center gap-3 mt-1.5 pt-2 text-[11px] text-white border-t border-[#142337]">
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
                className={`p-1 transition-colors ${yieldPage === 1 ? "text-[#526a8a]/50 cursor-not-allowed" : "text-[#526a8a] hover:text-white"}`}
              >
                <ChevronsLeft size={13} />
              </button>
              <button
                onClick={() => setYieldPage(Math.max(1, yieldPage - 1))}
                disabled={yieldPage === 1}
                className={`p-1 transition-colors ${yieldPage === 1 ? "text-[#526a8a]/50 cursor-not-allowed" : "text-[#526a8a] hover:text-white"}`}
              >
                <ChevronLeft size={13} />
              </button>
              <button className="bg-[#142337] text-white font-bold w-4.5 h-4.5 rounded flex items-center justify-center text-[10px]">
                {yieldPage}
              </button>
              <button
                onClick={() =>
                  setYieldPage(Math.min(totalYieldPages, yieldPage + 1))
                }
                disabled={yieldPage === totalYieldPages}
                className={`p-1 transition-colors ${yieldPage === totalYieldPages ? "text-[#526a8a]/50 cursor-not-allowed" : "text-[#526a8a] hover:text-white"}`}
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setYieldPage(totalYieldPages)}
                disabled={yieldPage === totalYieldPages}
                className={`p-1 transition-colors ${yieldPage === totalYieldPages ? "text-[#526a8a]/50 cursor-not-allowed" : "text-[#526a8a] hover:text-white"}`}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Attention Center Alerts */}
        <section className="bg-[#070e17] border border-[#142337] rounded-xl p-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-[#142337]/50 pb-2 mb-2 flex-shrink-0">
            <span
              className="text-[15.5px] font-black tracking-widest text-[#ef4444] uppercase"
              style={{ textShadow: "0 0 12px rgba(239,68,68,0.3)" }}
            >
              ATTENTION CENTER
            </span>
            <div className="flex gap-2 text-[11px]">
              <div className="bg-[#ef4444] text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                {alertsTotal} Alerts
              </div>
              <div className="bg-[#070e17] border border-[#ef4444]/40 text-[#ef4444] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                {criticalTotal} Critical
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-2 flex-shrink-0">
            <button
              onClick={() => setActiveAlertTab("All")}
              className={`${activeAlertTab === "All" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#040910] text-[#526a8a] border-[#142337] hover:bg-[#142337]"} border text-[11px] font-bold px-4 py-1.5 rounded transition-colors`}
            >
              All
            </button>
            <button
              onClick={() => setActiveAlertTab("Critical")}
              className={`${activeAlertTab === "Critical" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#040910] text-[#526a8a] border-[#142337] hover:bg-[#142337]"} border text-[11px] font-bold px-4 py-1.5 rounded transition-colors`}
            >
              Critical
            </button>
            <button
              onClick={() => setActiveAlertTab("Risk")}
              className={`${activeAlertTab === "Risk" ? "bg-[#1e3a8a] text-white border-[#3b82f6]/50" : "bg-[#040910] text-[#526a8a] border-[#142337] hover:bg-[#142337]"} border text-[11px] font-bold px-4 py-1.5 rounded transition-colors`}
            >
              Risk
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {attentionCenterAlerts
              .filter(
                (alert) =>
                  activeAlertTab === "All" || alert.level === activeAlertTab,
              )
              .map((alert) => (
                <div
                  key={alert.id}
                  className={`bg-[#050b11] border ${alert.level === "Critical" ? "animate-border-pulse-critical" : "border-[#eab308]/40"} rounded-lg p-2.5 relative flex flex-col transition-all duration-300`}
                  style={{
                    boxShadow:
                      alert.level === "Critical"
                        ? undefined
                        : "0 0 15px rgba(234, 179, 8, 0.05)",
                  }}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-2">
                      <Bell
                        size={13}
                        className={
                          alert.level === "Critical"
                            ? "text-[#ef4444]"
                            : "text-[#eab308]"
                        }
                        fill={
                          alert.level === "Critical" ? "#ef4444" : "#eab308"
                        }
                        style={{
                          filter:
                            alert.level === "Critical"
                              ? "drop-shadow(0 0 8px #ef4444)"
                              : "drop-shadow(0 0 8px #eab308)",
                        }}
                      />
                      <span
                        className={`text-[12.5px] font-bold ${alert.level === "Critical" ? "text-[#ef4444]" : "text-[#eab308]"}`}
                      >
                        {alert.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10.5px] text-[#8fa0b5] font-bold">
                      {alert.time}{" "}
                      <ChevronRight size={11} className="text-[#526a8a]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-1.5">
                    <div className="flex flex-col">
                      <span className="text-[#526a8a] text-[10px] uppercase font-bold">
                        {alert.failed ? "Failed Count" : "Current"}
                      </span>
                      <span className="text-white text-[15px] font-black font-mono leading-tight">
                        {alert.failed || alert.current}
                      </span>
                      <span className="text-[#526a8a] text-[9.5px] font-bold mt-0.5">
                        Impact: {alert.impact}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#526a8a] text-[10px] uppercase font-bold">
                        Target
                      </span>
                      <span className="text-white text-[15px] font-black font-mono leading-tight">
                        {alert.target}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#526a8a] text-[10px] uppercase font-bold">
                        Deviation
                      </span>
                      <span
                        className={`text-[15px] font-black font-mono leading-tight ${alert.level === "Critical" ? "text-[#ef4444]" : "text-[#ef4444]"}`}
                      >
                        {alert.dev}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`mt-auto bg-[#1e1b4b]/30 border ${alert.level === "Critical" ? "border-[#4338ca]/30" : "border-[#4338ca]/30"} rounded p-1.5 flex items-start gap-2`}
                  >
                    <div className="bg-[#4338ca] w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 text-white shadow-[0_0_12px_rgba(67,56,202,0.6)]">
                      <Wrench size={10} />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span
                        className="text-[#4338ca] text-[9px] font-black uppercase tracking-wider"
                        style={{ textShadow: "0 0 10px rgba(67,56,202,0.4)" }}
                      >
                        AI Recommendation
                      </span>
                      <span className="text-white text-[10.5px] font-bold leading-none mt-1 truncate">
                        {alert.rec}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="flex justify-end pt-3 text-[10px] font-bold text-[#3b82f6] cursor-pointer hover:text-white mt-1">
            View All Alerts <ChevronRight size={11} className="ml-0.5" />
          </div>
        </section>
      </main>

      {/* Row 4: Bottom Operational KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4 mt-1.5">
        {/* Card 1: Safety */}
        <div className="bg-[#070e17] border border-[#142337] rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-[#142337]/50 pb-1.5 flex-shrink-0">
            <Shield size={15} className="text-[#10b981]" />
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
                  <span className="text-[#ef4444] text-[24px] font-black leading-none font-mono">
                    {safetyAccident}
                  </span>
                  <span className="text-[#526a8a] text-[10px] font-bold">
                    This Month
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <SafetyChart
                  points={accidentPoints}
                  yTicks={incidentYTicks}
                  xTicks={safetyXTicks}
                  color="#ef4444"
                />
              </div>
            </div>

            <div className="flex flex-col h-full justify-between border-l border-[#142337]/30 pl-3">
              <div className="flex flex-col">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  NEAR MISS
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[#3b82f6] text-[24px] font-black leading-none font-mono">
                    {safetyNearMiss}
                  </span>
                  <span className="text-[#526a8a] text-[10px] font-bold">
                    This Month
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <SafetyChart
                  points={nearMissPoints}
                  yTicks={nearMissYTicks}
                  xTicks={safetyXTicks}
                  color="#3b82f6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Sustainability */}
        <div className="bg-[#070e17] border border-[#142337] rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          {/* Header */}
          <div className="flex items-center gap-1.5 border-b border-[#142337]/50 pb-1.5 flex-shrink-0">
            <Leaf size={15} className="text-[#10b981]" />
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

                <div className="text-[#10b981] text-[24px] font-black font-mono mt-1 leading-none">
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
                  color="#10b981"
                  icon={CustomSymmetricalLeafIcon}
                  showValueInCenter={false}
                />
              </div>
            </div>

            {/* Right */}
            <div className="flex flex-col border-l border-[#142337]/40 pl-3 min-h-0">
              <div className="mb-1.5 -mt-1.5">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  CO₂ EMISSION (tCO₂)
                </span>

                <div className="mt-1 flex items-baseline leading-none">
                  <span className="text-[#3b82f6] text-[21px] font-black font-mono">
                    {co2Emission.toLocaleString()}
                  </span>
                  <span className="ml-1 text-[11px] text-[#8fa0b5]">tCO₂</span>
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-[55px] flex items-center">
                <div className="w-full h-full">
                  <SafetyChart
                    points={co2Points}
                    yTicks={[1600, 1400, 1200, 1000]}
                    xTicks={safetyXTicks}
                    color="#3b82f6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Customer Reflection */}
        <div className="bg-[#070e17] border border-[#142337] rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-[#142337]/50 pb-1.5 flex-shrink-0">
            <Target size={15} className="text-[#a855f7]" />
            <span className="text-[#8fa0b5] text-[12px] font-black uppercase tracking-wider">
              CUSTOMER REFLECTION
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 items-center min-h-0 pt-2">
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  INCIDENTS
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[#a855f7] text-[24px] font-black leading-none font-mono">
                    {customerIncidents}
                  </span>
                  <span className="text-[#526a8a] text-[10px] font-bold font-sans">
                    This Month
                  </span>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <CustomDocumentWarningIcon
                  size={36}
                  className="text-[#a855f7] opacity-90"
                />
              </div>
            </div>

            <div className="flex flex-col h-full justify-between border-l border-[#142337]/30 pl-3">
              <div className="flex flex-col">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                    ERI (%)
                  </span>
                  {eriData && (
                    <span className="text-[#526a8a] text-[9.5px] font-bold font-sans">
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
                          ? "#10b981"
                          : eriData?.status === "critical"
                            ? "#ef4444"
                            : "#a855f7",
                    }}
                  >
                    {customerEri}%
                  </span>
                  {eriData && (
                    <span className="text-[#526a8a] text-[9px] font-bold font-sans truncate max-w-[50px]" title={eriData.period}>
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
                      ? "#10b981"
                      : eriData?.status === "critical"
                        ? "#ef4444"
                        : "#a855f7"
                  }
                  icon={CustomEriIcon}
                  showValueInCenter={false}
                />
              </div>
              {eriData && (
                <div className="flex justify-between text-[9px] text-[#526a8a] font-bold mt-0.5">
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
        <div className="bg-[#070e17] border border-[#142337] rounded-xl p-3 flex flex-col h-[195px] 2xl:h-[172px] justify-between">
          <div className="flex items-center gap-1.5 border-b border-[#142337]/50 pb-1.5 flex-shrink-0">
            <Trophy size={15} className="text-[#0ea5e9]" />
            <span className="text-[#8fa0b5] text-[12px] font-black uppercase tracking-wider">
              CI
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 items-center min-h-0 pt-2">
            <div className="flex flex-col h-full justify-between">
              <div className="flex justify-between items-baseline">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  LEAN SAVINGS
                </span>
                <span className="text-[#526a8a] text-[10px] font-bold font-sans">
                  Target 500K €
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center w-full mt-2">
                <SemiCircleGauge
                  value={ciLeanSavingsPct}
                  min={0}
                  max={100}
                  labelMin="0%"
                  labelMax="100%"
                  color="#a855f7"
                  showValueInCenter={true}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#526a8a] font-bold">
                <span>Achieved</span>
                <span className="text-white font-mono">{ciLeanSavingsVal}</span>
              </div>
            </div>

            <div className="flex flex-col h-full justify-between border-l border-[#142337]/30 pl-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  NO. OF KAIZEN
                </span>
                <span className="text-[#526a8a] text-[10px] font-bold">
                  Target 200K
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center w-full mt-2">
                <SemiCircleGauge
                  value={ciKaizenPct}
                  min={0}
                  max={100}
                  labelMin="0%"
                  labelMax="100%"
                  color="#0ea5e9"
                  showValueInCenter={true}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#526a8a] font-bold">
                <span>Achieved</span>
                <span className="text-white font-mono">{ciKaizenVal}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3D Digital Twin Fullscreen Modal */}
      {isTwinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 lg:p-8 transition-all duration-300">
          <div className="relative w-full h-full max-w-[95vw] max-h-[90vh] bg-[#070e17] border border-[#1d324b] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-[#0a1424]/90 px-6 py-4 border-b border-[#142337] z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3fd3c6] animate-pulse" />
                <span className="text-[16px] font-black text-white uppercase tracking-wider">
                  3D Digital Twin Plant Floor View
                </span>
              </div>
              <button
                onClick={() => setIsTwinModalOpen(false)}
                className="bg-[#122339] hover:bg-[#ef4444] text-[#8fa0b5] hover:text-white border border-[#1b3252] rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
              >
                ✕ Close view
              </button>
            </div>

            {/* Model Viewport */}
            <div className="flex-1 relative min-h-0 bg-[#060a10]">
              <FactoryQualityTwin preview={false} zones={twinZones} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityLayout;
