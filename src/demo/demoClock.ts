// The demo's sense of time.
//
// Two problems this solves, both specific to this app.
//
// 1. THE ROLLING WINDOW. `rangeError` in dashboardFilters.ts refuses any day
//    outside the last MAX_RANGE_DAYS ending today, and `rangeLatest()` reads the
//    real system clock. A fixture set stamped with a fixed calendar date would
//    therefore be rejected by the date picker the moment that date aged out —
//    the demo would quietly stop being able to query its own data.
//
//    So fixtures are generated against a fixed ANCHOR day and the loader shifts
//    every date label by (today - anchor) whole days. The scenario is fixed; its
//    position on the calendar is not. Metric values never change, so the demo is
//    deterministic in every way that shows on screen while remaining permanently
//    inside the selectable window.
//
// 2. THE PRODUCTION DAY. A production day runs 06:15 to 06:15, so 02:00 on the
//    12th belongs to the 11th. Timestamps must be emitted as plant-local strings
//    with NO timezone suffix, because `productionDayOf` parses them with a regex
//    and returns null for anything else — an ISO string with a Z would make
//    every drill-down row fall out of its own day.

/** Shift letters that denote a real shift. "D" is the whole day. */
export const SHIFT_LETTERS = ["A", "B", "C"] as const;
export type ShiftLetter = (typeof SHIFT_LETTERS)[number];

/** Shift windows in plant-local time. The day starts at 06:15, not midnight. */
export const SHIFT_WINDOWS: Record<ShiftLetter, { start: string; end: string }> = {
  A: { start: "06:15", end: "14:15" },
  B: { start: "14:15", end: "22:15" },
  C: { start: "22:15", end: "06:15" }, // crosses midnight into the next calendar day
};

const DAY_MS = 86_400_000;

/** Parse a YYYY-MM-DD label to a UTC epoch. UTC so the viewer's zone and DST
 *  cannot move a label that is not an instant in the first place. */
export const dayToUtc = (label: string): number =>
  Date.parse(`${label}T00:00:00Z`);

export const utcToDay = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 10);

export const addDays = (label: string, n: number): string =>
  utcToDay(dayToUtc(label) + n * DAY_MS);

export const daysBetween = (from: string, to: string): number =>
  Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);

/** Today in the viewer's own calendar — the same calculation `rangeLatest()`
 *  does, so the shifted fixtures line up exactly with the picker's bounds. */
export const todayLabel = (): string => {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * Whole days to add to every generated label so the scenario's last day is
 * today. Zero when the fixtures were generated today.
 */
export const anchorOffset = (anchorDate: string): number =>
  daysBetween(anchorDate, todayLabel());

/** Re-date one label. */
export const shiftDay = (label: string, offset: number): string =>
  offset === 0 ? label : addDays(label, offset);

/**
 * Re-date a plant-local timestamp, preserving the clock time.
 *
 * Only the date part moves; `14:32:07` stays `14:32:07`. The time of day is
 * what places a row in a shift, so shifting it would move rows between shifts
 * and break the reconciliation between the shift rows and the day row.
 */
export const shiftTimestamp = (ts: string, offset: number): string => {
  if (offset === 0) return ts;
  const m = /^(\d{4}-\d{2}-\d{2})([T ].*)$/.exec(ts);
  if (!m) return ts;
  return `${addDays(m[1], offset)}${m[2]}`;
};

/**
 * Walks every date-shaped string in a parsed fixture and re-dates it.
 *
 * Deliberately shape-agnostic rather than per-endpoint: there are 20+ response
 * shapes and date labels appear in keys (`kpis-2026-09-18`), values, and array
 * elements. A per-shape rewriter would be 20 places to forget one, and a missed
 * label shows up as an empty table rather than an error.
 *
 * Object KEYS are rewritten too, because `by_date` maps and the manifest index
 * are keyed by day.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export const reanchor = <T>(value: T, offset: number): T => {
  if (offset === 0) return value;
  return walk(value, offset) as T;
};

const walk = (value: unknown, offset: number): unknown => {
  if (typeof value === "string") {
    if (DATE_ONLY.test(value)) return shiftDay(value, offset);
    if (DATE_TIME.test(value)) return shiftTimestamp(value, offset);
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, offset));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[DATE_ONLY.test(k) ? shiftDay(k, offset) : k] = walk(v, offset);
    }
    return out;
  }
  return value;
};

/**
 * The production day a plant-local timestamp belongs to.
 *
 * Mirrors `productionDayOf` in dashboardFilters.ts. Duplicated rather than
 * imported because the generator runs in Node where that module's siblings pull
 * in browser types — and because the generator must not be able to drift from
 * the app silently, so the validator asserts the two agree.
 */
export const productionDayOfTs = (ts: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(ts);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  if (`${hh}:${mm}` >= "06:15") return `${y}-${mo}-${d}`;
  return utcToDay(Date.UTC(Number(y), Number(mo) - 1, Number(d) - 1));
};

/**
 * A plant-local timestamp inside a shift on a production day.
 *
 * Shift C starts at 22:15 and runs past midnight, so minutes past 01:45 land on
 * the NEXT calendar day while still belonging to THIS production day. That is
 * the case `productionDayOf` exists for, and the fixtures have to exercise it or
 * the boundary logic is never tested by the demo.
 */
export const timestampIn = (
  day: string,
  shift: ShiftLetter,
  minuteOfShift: number,
  second = 0,
): string => {
  const { start } = SHIFT_WINDOWS[shift];
  const [sh, sm] = start.split(":").map(Number);
  const total = sh * 60 + sm + minuteOfShift;
  const dayOffset = Math.floor(total / 1440);
  const mins = ((total % 1440) + 1440) % 1440;
  const hh = `${Math.floor(mins / 60)}`.padStart(2, "0");
  const mm = `${mins % 60}`.padStart(2, "0");
  const ss = `${second % 60}`.padStart(2, "0");
  return `${addDays(day, dayOffset)}T${hh}:${mm}:${ss}`;
};
