import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  Maximize2,
  Filter,
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
  Wrench,
  User,
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

import FactoryQualityTwin from "./FactoryQualityTwin";

interface QualityLayoutProps {
  header?: React.ReactNode;
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

  const svgPoints = points
    .map((p, i) => {
      const x = paddingLeft + (i / (points.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - ((p - minVal) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${paddingLeft},${paddingTop + chartHeight} ${svgPoints} ${paddingLeft + chartWidth},${paddingTop + chartHeight}`;
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
        <polygon points={areaPoints} fill={`url(#${gradId})`} />

        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1"
          points={svgPoints}
        />

        {/* Dots */}
        {points.map((p, i) => {
          const x = paddingLeft + (i / (points.length - 1)) * chartWidth;
          const y =
            paddingTop + chartHeight - ((p - minVal) / range) * chartHeight;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="1.8"
              fill={color}
              stroke="#070e17"
              strokeWidth="0.4"
            />
          );
        })}

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
    type: "yield",
    data: { done: "11,230", ok: "11,052", yield: "98.42%" },
    status: "Healthy",
    color: "#10b981",
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
    name: "AUTO OGI",
    icon: Search,
    section: "RFM",
    type: "yield",
    data: { done: "840", ok: "832", yield: "98.05%" },
    status: "Healthy",
    color: "#10b981",
  },
  {
    name: "MANUAL OGI",
    icon: User,
    section: "RFM",
    type: "yield",
    data: { done: "420", ok: "413", yield: "98.33%" },
    status: "At Risk",
    color: "#eab308",
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
];

const productYieldData = [
  {
    id: 1,
    name: "Flexi Air 100",
    tested: "12,450",
    failed: "102",
    fpy: 98.2,
    spy: 99.1,
    target: 98,
    status: "Healthy",
    rec: "Maintain current process",
  },
  {
    id: 2,
    name: "Flexi Air 200",
    tested: "11,321",
    failed: "146",
    fpy: 97.1,
    spy: 98.5,
    target: 98,
    status: "At Risk",
    rec: "Increase AOI sampling",
  },
  {
    id: 3,
    name: "Giga Node 10G",
    tested: "9,876",
    failed: "210",
    fpy: 95.7,
    spy: 97.4,
    target: 98,
    status: "At Risk",
    rec: "Improve solder paste print",
  },
  {
    id: 4,
    name: "Giga Node 25G",
    tested: "10,223",
    failed: "98",
    fpy: 98.6,
    spy: 99.6,
    target: 98,
    status: "Healthy",
    rec: "Maintain current process",
  },
  {
    id: 5,
    name: "OptiX Edge 100",
    tested: "8,765",
    failed: "189",
    fpy: 95.8,
    spy: 97.2,
    target: 98,
    status: "At Risk",
    rec: "Review AXI voiding trend",
  },
  {
    id: 6,
    name: "OptiX Edge 200",
    tested: "9,112",
    failed: "75",
    fpy: 99.2,
    spy: 98.7,
    target: 98,
    status: "Healthy",
    rec: "Maintain current process",
  },
  {
    id: 7,
    name: "Wave 5G Lite",
    tested: "13,002",
    failed: "156",
    fpy: 98.8,
    spy: 97.4,
    target: 98,
    status: "Healthy",
    rec: "Maintain current process",
  },
  {
    id: 8,
    name: "Wave 5G Pro",
    tested: "11,876",
    failed: "203",
    fpy: 96.6,
    spy: 94.1,
    target: 98,
    status: "At Risk",
    rec: "Check screw torque failures",
  },
  {
    id: 9,
    name: "Cloud Router X1",
    tested: "7,654",
    failed: "92",
    fpy: 98.8,
    spy: 97.0,
    target: 98,
    status: "Healthy",
    rec: "Maintain current settings",
  },
  {
    id: 10,
    name: "Cloud Router X2",
    tested: "12,222",
    failed: "118",
    fpy: 97.5,
    spy: 95.3,
    target: 98,
    status: "At Risk",
    rec: "Optimize reflow profile",
  },
  {
    id: 11,
    name: "Access Point AX",
    tested: "12,221",
    failed: "134",
    fpy: 98.9,
    spy: 97.6,
    target: 98,
    status: "Healthy",
    rec: "Maintain current settings",
  },
  {
    id: 12,
    name: "Access Point BE",
    tested: "9,443",
    failed: "167",
    fpy: 97.3,
    spy: 94.9,
    target: 98,
    status: "At Risk",
    rec: "Check thermal performance",
  },
  {
    id: 13,
    name: "5G CPE Indoor",
    tested: "8,834",
    failed: "89",
    fpy: 97.9,
    spy: 98.5,
    target: 98,
    status: "Healthy",
    rec: "Maintain current settings",
  },
  {
    id: 14,
    name: "5G CPE Outdoor",
    tested: "6,789",
    failed: "121",
    fpy: 97.3,
    spy: 97.0,
    target: 98,
    status: "At Risk",
    rec: "Improve conformal coating",
  },
  {
    id: 15,
    name: "Enterprise Switch 1",
    tested: "5,432",
    failed: "64",
    fpy: 98.2,
    spy: 97.0,
    target: 98,
    status: "Healthy",
    rec: "Maintain current process",
  },
];

const attentionCenterAlertsData = [
  {
    id: 1,
    title: "FPY dropped below threshold - TRX Board",
    time: "14m ago",
    current: "94.8%",
    target: "98%",
    dev: "-3.2%",
    level: "Critical",
    impact: "High",
    rec: "Inspect SPI alignment and verify paste deposition.",
  },
  {
    id: 2,
    title: "AOI Yield Reduction - AOI Line 02",
    time: "28m ago",
    current: "95.6%",
    target: "98%",
    dev: "-2.4%",
    level: "Risk",
    impact: "Medium",
    rec: "Calibrate AOI lighting and adjust exposure settings.",
  },
  {
    id: 3,
    title: "Thermal AVI Yield Drop - Thermal AVI",
    time: "45m ago",
    current: "96.1%",
    target: "98%",
    dev: "-1.9%",
    level: "Critical",
    impact: "Medium",
    rec: "Review camera ROI and improve gel detection.",
  },
  {
    id: 4,
    title: "Manual OGI increase - Manual OGI",
    time: "1h 06m ago",
    failed: "42",
    target: "< 20",
    dev: "+22",
    level: "Risk",
    impact: "Medium",
    rec: "Operator retraining required. Review SOP adherence.",
  },
];

const SHIFTS = [
  "Shift A (06:15 AM - 02:15 PM)",
  "Shift B (02:15 PM - 10:15 PM)",
  "Shift C (10:15 PM - 06:15 AM)",
];

export const QualityLayout: React.FC<QualityLayoutProps> = () => {
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState("16:16:54");
  const [isTwinModalOpen, setIsTwinModalOpen] = useState(false);
  const [kpiCards, setKpiCards] = useState(qualityData.kpiCards);
  const [activeAlertTab, setActiveAlertTab] = useState<
    "All" | "Critical" | "Risk"
  >("All");
  const [activeShift, setActiveShift] = useState(SHIFTS[0]);
  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const [activeYieldTab, setActiveYieldTab] = useState<"UNITS" | "TRX" | "PA">(
    "UNITS",
  );
  const [yieldPage, setYieldPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const currentYieldData = React.useMemo(() => {
    if (activeYieldTab === "UNITS") return productYieldData;
    if (activeYieldTab === "TRX")
      return [...productYieldData].reverse().slice(0, 8);
    if (activeYieldTab === "PA") return [...productYieldData].slice(4, 11);
    return productYieldData;
  }, [activeYieldTab]);

  const totalYieldPages =
    Math.ceil(currentYieldData.length / ITEMS_PER_PAGE) || 1;
  const paginatedYieldData = currentYieldData.slice(
    (yieldPage - 1) * ITEMS_PER_PAGE,
    yieldPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setYieldPage(1);
  }, [activeYieldTab]);

  // Telemetry simulation loop for top Quality KPI cards (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setKpiCards((prevCards) => {
        return prevCards.map((card) => {
          let newValue = card.value;
          let newChange = card.change;
          let newStatus = card.status;
          let newPoints = [...card.points];

          const shift = Math.random() * 2 - 1; // -1 to 1

          // Cards 1-5 are all yield/audit percentages; walk each around its
          // baseline and re-render change vs baseline.
          const pctCard: Record<
            number,
            { base: number; min: number; max: number }
          > = {
            1: { base: 98.6, min: 97.6, max: 99.5 },
            2: { base: 99.4, min: 98.6, max: 99.9 },
            3: { base: 97.8, min: 96.6, max: 99.0 },
            4: { base: 98.9, min: 98.0, max: 99.7 },
            5: { base: 96.5, min: 94.8, max: 98.5 },
          };
          if (pctCard[card.id]) {
            const { base, min, max } = pctCard[card.id];
            const val = Math.max(min, Math.min(max, base + shift * 1.0));
            newValue = `${val.toFixed(1)}%`;
            newChange = `${val >= base ? "▲" : "▼"} ${Math.abs(val - base).toFixed(1)}% vs Yesterday`;
            newStatus = "nominal";
          } else if (card.id === 6) {
            const val = Math.max(8, Math.min(22, Math.round(14 + shift * 5)));
            newValue = String(val);
            newChange = `${val <= 14 ? "▼" : "▲"} ${Math.abs(val - 14)} vs yesterday`;
            newStatus = val > 17 ? "warning" : "nominal";
          } else if (card.id === 7) {
            const val = Math.max(0.8, Math.min(3.2, 1.8 + shift * 0.8));
            newValue = `${val.toFixed(1)}%`;
            newChange = `${val <= 1.8 ? "▼" : "▲"} ${Math.abs(val - 1.8).toFixed(1)}% vs yesterday`;
            newStatus = val > 2.4 ? "warning" : "nominal";
          } else if (card.id === 8) {
            const val = Math.max(8, Math.min(42, Math.round(18 + shift * 12)));
            newValue = String(val);
            newChange = `${val <= 18 ? "▼" : "▲"} ${Math.abs(val - 18)} vs yesterday`;
            const riskLabel =
              val >= 30 ? "High Risk" : val >= 20 ? "Medium Risk" : "Low Risk";
            return {
              ...card,
              value: newValue,
              change: newChange,
              riskLabel,
              points: [...newPoints.slice(1), val],
            };
          }

          const currentVal = Number(newValue.replace(/[^0-9.-]/g, ""));
          newPoints = [...newPoints.slice(1), currentVal];

          return {
            ...card,
            value: newValue,
            change: newChange,
            status: newStatus,
            points: newPoints,
          };
        });
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Keep clock running
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString("en-US", { hour12: false }));
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
          <span className="text-[#526a8a]">Wed, Jul 09, 2026</span>
          <span className="h-3.5 w-[1px] bg-[#142337]" />
          <span className="text-white font-bold">{timeStr}</span>
          <span className="h-3.5 w-[1px] bg-[#142337]" />

          <div className="flex items-center gap-1.5 border border-[#10b981]/30 bg-[#10b981]/5 px-2.5 py-0.5 rounded text-[#10b981] text-[13px] font-black">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            LIVE
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

          <button className="flex items-center gap-1.5 bg-[#0a1523] border border-[#1b3252] hover:bg-[#122339] rounded px-2.5 py-0.5 text-[13px] font-bold cursor-pointer text-[#8fa0b5] outline-none">
            <Filter size={11} /> Filters
            <ChevronDown size={11} className="text-[#526a8a]" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-[#122339] rounded border border-[#1b3252] cursor-pointer text-[#8fa0b5] outline-none"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </header>

      {/* Row 1: Top KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
      </section>

      {/* Row 2: Process Performance */}
      <section className="bg-[#070e17] border border-[#142337] rounded-xl p-4 flex flex-col">
        {/* Title for mobile/tablet */}
        <span className="lg:hidden text-[#06b6d4] text-[15px] uppercase font-bold tracking-widest mb-3">
          PROCESS PERFORMANCE
        </span>

        {/* Brackets row for desktop */}
        <div className="hidden lg:grid grid-cols-10 gap-2 items-center mb-3">
          {/* SMT Section Bracket */}
          <div className="col-span-4 flex items-center gap-2">
            <span className="text-[#f8fafc] text-[12.5px] font-black tracking-wider uppercase flex-shrink-0">
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
          <div className="col-span-6 flex items-center">
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

        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
          {processPerformanceData.map((item, idx) => {
            const cardColor = getCardBorderColor(item);
            const colorCurrent = getTimelineNodeColor(item);
            const colorNext =
              idx < processPerformanceData.length - 1
                ? getTimelineNodeColor(processPerformanceData[idx + 1])
                : "";

            return (
              <div key={idx} className="flex flex-col w-full min-w-0">
                {/* Card */}
                <div
                  className={`bg-[#040910] border rounded-lg p-1.5 2xl:p-2.5 pb-2 2xl:pb-3 flex flex-col h-[126px] 2xl:h-[142px] transition-all duration-300 ${
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
                  <div className="flex items-start gap-1 mb-1 2xl:mb-2 flex-shrink-0">
                    <item.icon
                      size={12}
                      className="text-white flex-shrink-0 mt-[1px] 2xl:size-[14px]"
                    />
                    <span className="text-white text-[10.5px] 2xl:text-[13px] font-black uppercase leading-tight truncate">
                      {item.name}
                    </span>
                  </div>
                  {/* Body */}
                  <div className="flex-1 flex flex-col justify-start gap-0.5 mt-0.5 min-h-0">
                    {item.type === "yield" && (
                      <>
                        <div className="flex justify-between text-[10px] 2xl:text-[13px]">
                          <span className="text-[#8fa0b5]">Done</span>
                          <span className="text-white font-mono">
                            {item.data.done}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] 2xl:text-[13px]">
                          <span className="text-[#8fa0b5]">OK</span>
                          <span className="text-white font-mono">
                            {item.data.ok}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] 2xl:text-[13px]">
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
                    {item.type === "failure" && (
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <span className="text-[#8fa0b5] text-[10px] 2xl:text-[13px]">
                          Failure %
                        </span>
                        <span
                          className="text-[15px] 2xl:text-[21px] font-black mt-0.5 font-mono"
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
                  <div className="flex items-center gap-1 mt-auto flex-shrink-0 pt-1 2xl:pt-2">
                    <div
                      className="w-1.5 h-1.5 2xl:w-2 2xl:h-2 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}`,
                      }}
                    />
                    <span
                      className="text-[9.5px] 2xl:text-[11px]"
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
        <section className="bg-[#070e17] border border-[#142337] rounded-xl p-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-[#142337]/50 pb-2 mb-3 flex-shrink-0">
            <span className="text-[15.5px] font-black tracking-widest text-[#06b6d4]">
              FACTORY QUALITY TWIN
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

          <div className="flex-1 relative bg-[#040910] border border-[#142337]/60 rounded-lg overflow-hidden flex items-center justify-center">
            <FactoryQualityTwin
              preview={true}
              onMaximize={() => setIsTwinModalOpen(true)}
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
                6 Alerts
              </div>
              <div className="bg-[#070e17] border border-[#ef4444]/40 text-[#ef4444] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                1 Critical
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
            {attentionCenterAlertsData
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
                  ACCIDENT
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[#ef4444] text-[24px] font-black leading-none font-mono">
                    2
                  </span>
                  <span className="text-[#526a8a] text-[10px] font-bold">
                    This Month
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <SafetyChart
                  points={[
                    0.8, 2.0, 1.7, 2.2, 3.0, 4.5, 1.7, 1.5, 0.8, 1.2, 1.8,
                  ]}
                  yTicks={[4, 3, 2, 1, 0]}
                  xTicks={[
                    "Jul 03",
                    "Jul 04",
                    "Jul 05",
                    "Jul 06",
                    "Jul 07",
                    "Jul 08",
                    "Jul 09",
                  ]}
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
                    7
                  </span>
                  <span className="text-[#526a8a] text-[10px] font-bold">
                    This Month
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <SafetyChart
                  points={[11, 14, 10, 12, 10, 13, 14, 9, 6, 8, 11]}
                  yTicks={[20, 15, 10, 5, 0]}
                  xTicks={[
                    "Jul 03",
                    "Jul 04",
                    "Jul 05",
                    "Jul 06",
                    "Jul 07",
                    "Jul 08",
                    "Jul 09",
                  ]}
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
                  99.7%
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center min-h-0">
                <SemiCircleGauge
                  value={99.7}
                  min={90}
                  max={100}
                  labelMin="90%"
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
                    1,284
                  </span>
                  <span className="ml-1 text-[11px] text-[#8fa0b5]">tCO₂</span>
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-[55px] flex items-center">
                <div className="w-full h-full">
                  <SafetyChart
                    points={[
                      1400, 1360, 1300, 1390, 1480, 1380, 1260, 1330, 1400,
                      1360, 1270, 1290, 1320,
                    ]}
                    yTicks={[1600, 1400, 1200, 1000]}
                    xTicks={[
                      "Jul 03",
                      "Jul 04",
                      "Jul 05",
                      "Jul 06",
                      "Jul 07",
                      "Jul 08",
                      "Jul 09",
                    ]}
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
                    3
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
                <span className="text-[#8fa0b5] text-[11px] font-bold uppercase leading-none">
                  ERI (%)
                </span>
                <span className="text-[#a855f7] text-[24px] font-black mt-1 leading-none font-mono">
                  96.2%
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center w-full mt-2">
                <SemiCircleGauge
                  value={96.2}
                  min={85}
                  max={100}
                  labelMin="85%"
                  labelMax="100%"
                  color="#a855f7"
                  icon={CustomEriIcon}
                  showValueInCenter={false}
                />
              </div>
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
                  value={72}
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
                <span className="text-white font-mono">360K €</span>
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
                  value={71}
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
                <span className="text-white font-mono">142K</span>
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
              <FactoryQualityTwin preview={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityLayout;
