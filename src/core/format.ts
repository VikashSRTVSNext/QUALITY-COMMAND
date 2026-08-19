// Value formatters for the dashboard.
//
// The feed sends null for any metric a shift has no data for, so every value on
// screen goes through one of these — null.toFixed() throws mid-render and blanks
// the whole page.

export const isNum = (v: any): v is number =>
  typeof v === "number" && Number.isFinite(v);

export const fmtFixed = (v: any, digits: number, fallback = "...") =>
  isNum(v) ? v.toFixed(digits) : fallback;

export const fmtCompact = (v: any, fallback = "...") => {
  if (!isNum(v)) return fallback;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(3)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${Math.round(v * 100) / 100}`;
};

export const fmtCount = (v: any, fallback = "...") =>
  isNum(v) ? v.toLocaleString() : fallback;

export const fmtAlertValue = (v: any, unit: string) =>
  isNum(v) ? `${Math.round(v * 100) / 100}${unit}` : "—";

export const fmtAlertAge = (m: any) => {
  if (!isNum(m)) return "";
  if (m < 60) return `${Math.round(m)}m ago`;
  const hours = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  return mins ? `${hours}h ${mins}m ago` : `${hours}h ago`;
};

// Calendar month ("2026-07") -> fiscal period label ("P07").
export const monthPeriodLabel = (m: any): string => {
  const month = Number(String(m?.period_month ?? "").slice(5, 7));
  return month >= 1 && month <= 12
    ? `P${String(month).padStart(2, "0")}`
    : (m?.label ?? "");
};
