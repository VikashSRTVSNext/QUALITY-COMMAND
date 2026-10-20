// Date and shift arithmetic for the generator.
//
// Mirrors the runtime half in src/demo/demoClock.ts. The duplication is
// deliberate and bounded: the generator runs under plain `node` with no
// transpiler, so it cannot import the .ts module, and the shared surface is
// ~60 lines of pure date maths with no dependencies.
//
// The risk of a silent drift between the two copies is covered by
// validate-demo-fixtures.mjs, which runs `productionDayOfTs` against the same
// boundary vectors the app's `productionDayOf` must satisfy. If they ever
// disagree, the validator fails the build rather than emitting rows that fall
// outside their own production day.

/** Shift letters that denote a real shift. "D" is the whole day. */
export const SHIFT_LETTERS = ["A", "B", "C"];

/** Shift windows in plant-local time. The day starts at 06:15, not midnight. */
export const SHIFT_WINDOWS = {
  A: { start: "06:15", end: "14:15" },
  B: { start: "14:15", end: "22:15" },
  // Crosses midnight into the next calendar day while still belonging to this
  // production day.
  C: { start: "22:15", end: "06:15" },
};

const DAY_MS = 86_400_000;

export const dayToUtc = (label) => Date.parse(`${label}T00:00:00Z`);
export const utcToDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (label, n) => utcToDay(dayToUtc(label) + n * DAY_MS);
export const daysBetween = (from, to) =>
  Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);

/** Today in the local calendar — the same calculation the app's rangeLatest()
 *  does, so a scenario anchored here lines up with the picker's bounds. */
export const todayLabel = () => {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * The production day a plant-local timestamp belongs to.
 *
 * Must stay byte-identical in behaviour to productionDayOf in
 * dashboardFilters.ts. Regex-parsed, never `new Date()`: the string carries no
 * timezone and letting the host interpret it would move the day.
 */
export const productionDayOfTs = (ts) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(ts);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  if (`${hh}:${mm}` >= "06:15") return `${y}-${mo}-${d}`;
  return utcToDay(Date.UTC(Number(y), Number(mo) - 1, Number(d) - 1));
};

/**
 * A plant-local timestamp `minuteOfShift` minutes into a shift on a production
 * day, with NO timezone suffix.
 *
 * The suffix matters: productionDayOf parses with a regex that accepts
 * `YYYY-MM-DDTHH:MM` and nothing cleverer, so an ISO string with a Z would make
 * every drill-down row fall out of its own day.
 *
 * Shift C rolls past midnight, so this returns the next calendar day for
 * minutes past 01:45 while the row still belongs to `day`. Fixtures exercise
 * that on purpose — it is the case the boundary logic exists for.
 */
export const timestampIn = (day, shift, minuteOfShift, second = 0) => {
  const [sh, sm] = SHIFT_WINDOWS[shift].start.split(":").map(Number);
  const total = sh * 60 + sm + minuteOfShift;
  const dayOffset = Math.floor(total / 1440);
  const mins = ((total % 1440) + 1440) % 1440;
  const hh = `${Math.floor(mins / 60)}`.padStart(2, "0");
  const mm = `${mins % 60}`.padStart(2, "0");
  const ss = `${second % 60}`.padStart(2, "0");
  return `${addDays(day, dayOffset)}T${hh}:${mm}:${ss}`;
};

/** Minutes in a shift. All three are 8h; C is 8h across the midnight roll. */
export const SHIFT_MINUTES = 480;

/** "2026-09-27" -> "P09", matching monthPeriodLabel's expectation. */
export const periodMonthOf = (day) => day.slice(0, 7);

/**
 * The plant's 12 fiscal periods for a year.
 *
 * NOT calendar months. The year is divided into four 13-week quarters split
 * 5-4-4, so P01 runs 3 Jan - 6 Feb and P02 only 7 Feb - 6 Mar. Every
 * period-scale metric in the dashboard — safety, ERI, HFTPY, CO2 — is reported
 * against these, and labelling them with month names puts the numbers under
 * the wrong heading by up to a week.
 *
 * Anchored on the first Saturday of January, which is how the captured
 * payload's P01 starts on 2026-01-03.
 */
export const fiscalPeriods = (year) => {
  // First Saturday of January.
  let cursor = `${year}-01-01`;
  while (new Date(`${cursor}T00:00:00Z`).getUTCDay() !== 6) cursor = addDays(cursor, 1);

  const WEEKS = [5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4];
  const periods = [];
  let week = 2; // P01 starts in ISO week 2, as the capture reports.
  for (let i = 0; i < WEEKS.length; i++) {
    const span = WEEKS[i];
    const start = cursor;
    const end = addDays(cursor, span * 7 - 1);
    periods.push({
      period: `${year}-P${`${i + 1}`.padStart(2, "0")}`,
      fiscal_year: year,
      period_code: `P${`${i + 1}`.padStart(2, "0")}`,
      period_num: i + 1,
      week_from: week,
      week_to: week + span - 1,
      period_start: start,
      period_end: end,
    });
    cursor = addDays(end, 1);
    week += span;
  }
  return periods;
};

/** The fiscal period a day falls in, or the last one before it. */
export const fiscalPeriodOf = (day) => {
  const all = fiscalPeriods(Number(day.slice(0, 4)));
  return all.find((p) => day >= p.period_start && day <= p.period_end) ?? all[all.length - 1];
};
