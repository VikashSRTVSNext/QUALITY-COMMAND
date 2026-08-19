// Metric logic shared by the Quality dashboard and its tile components.
//
// Kept out of QualityLayout so the tiles can import it without importing the
// dashboard back — the cards are rendered BY QualityLayout, so a shared import
// in the other direction would be circular.

import type { ZoneStatus } from "../factory/zones";
import { palette, toolPalette } from "../../theme/palette";
import { isNum } from "../../core/format";

// Tile label -> its key in the API's process_performance payload.
//
// Listed explicitly rather than derived from the label, because two keys cannot
// be guessed: burn-in is stored as THERMAL_TEST, and "SMT DEFECTS @ MFT" as
// SMT_DEFECTS.
export const API_KEY_BY_TILE: Record<string, string> = {
  "SMT DEFECTS @ MFT": "SMT_DEFECTS",
  "BURN-IN": "BURN_IN",
  "BURN-IN - S": "BURN_IN",
  "AXI - S": "AXI",
  "LBTS - S": "LBTS",
  OTA: "OTA_TEST",
};

// Pulls one tile's hourly buckets out of the API payload, keeping only the
// selected shift's buckets, and derives the trend arrow from first vs last.
export const getProcessTrendData = (trend: any, activeShift: string) => {
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

// The amber band: how far past target still counts as a warning rather than
// critical. Yield targets are judged in percentage points, defect-rate targets
// as a fraction of the target itself.
export const ZONE_BAND_POINTS = 5;

export const ZONE_BAND_RELATIVE = 0.05;

export type MetricGrade = "green" | "yellow" | "red" | "unknown";

// Grades one card against its target. Yield metrics want a high number,
// defect and failure rates want a low one.
export const gradeAgainstTarget = (card: any): MetricGrade => {
  const target = card?.target;
  const actual = card?.actual;
  if (!isNum(target) || !isNum(actual)) return "unknown";

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

// Grade -> colour, for each of the three things that carry a grade.
export const GRADE_CSS: Record<MetricGrade, string> = {
  green: palette.healthy,
  yellow: palette.warning,
  red: palette.critical,
  unknown: palette.accentRail,
};

export const YIELD_STATUS_CSS: Record<string, string> = {
  Healthy: GRADE_CSS.green,
  Warning: GRADE_CSS.yellow,
  "No Target": palette.inkMuted,
};
export const yieldRowTone = (status: string) =>
  YIELD_STATUS_CSS[status] ?? GRADE_CSS.red;

export const ERI_STATUS_CSS: Record<string, string> = {
  healthy: GRADE_CSS.green,
  at_risk: GRADE_CSS.yellow,
  critical: GRADE_CSS.red,
};
export const ERI_UNGRADED_CSS = toolPalette.purple500;
export const eriStatusColor = (status?: string | null) =>
  (status && ERI_STATUS_CSS[status]) || ERI_UNGRADED_CSS;

// Grade for a Process Performance card: measured against target where both
// numbers exist, otherwise taken from the status the feed reports.
export const cardGrade = (card: any): MetricGrade => {
  if (
    card.status === "N/A" ||
    card.status === "..." ||
    card.status === "Not Run"
  ) {
    return "unknown";
  }

  const graded = gradeAgainstTarget(card);
  if (graded !== "unknown") return graded;

  return card.status === "Critical" || card.status === "At Risk"
    ? "red"
    : "green";
};

// Same idea for a KPI card, which carries its value as a formatted string
// ("88.7%") and falls back to yesterday's delta when there is no target.
export const kpiCardGrade = (card: any): MetricGrade => {
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

// Grade reduced to the colour and red flag that the tiles actually use.
export const cardVerdict = (card: any): { color: string; red: boolean } => {
  const grade = cardGrade(card);
  return { color: GRADE_CSS[grade], red: grade === "red" };
};

// A zone on the heat map takes the worst grade among its cards. Zones with no
// graded cards read as unknown rather than healthy.
export const zoneStatusFromGrades = (all: MetricGrade[]): ZoneStatus => {
  const grades = all.filter((g) => g !== "unknown");
  if (grades.length === 0) return "unknown";
  if (grades.includes("red")) return "critical";
  if (grades.includes("yellow")) return "warning";
  return "healthy";
};

export const bandedZoneStatus = (cards: any[]): ZoneStatus =>
  zoneStatusFromGrades(cards.map(cardGrade));
