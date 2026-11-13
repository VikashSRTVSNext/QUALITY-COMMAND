import { ChevronLeft, ChevronRight } from "lucide-react";
import { HOUR_SLOTS, endBeforeStart, shortDay } from "./dashboardFilters";
import {
  useReworkHistoryFrom,
  useReworkPeriods,
  type ReworkGranularity,
  type ReworkPeriod,
  type ReworkPeriodOption,
  type ReworkScope,
} from "./useReworkParetos";

const GRANULARITIES: { key: ReworkGranularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];
const SHIFTS = [null, "A", "B", "C"] as const;

/** The anchor limit, kept here only to grey out ‹ before a request that is
 *  certain to 400. The server is the authority — and this is deliberately NOT
 *  the dashboard's 30-day validator, which does not apply to these endpoints. */
const MAX_ANCHOR_DAYS_BACK = 365;
/** A Day range is at most this many days (handoff 2026-10-31). */
const MAX_DAY_RANGE = 31;
/** What Day opens on: the last seven days, today included. */
const DEFAULT_DAY_SPAN = 7;

/** Local calendar date, YYYY-MM-DD. A Day range is plain calendar days (not
 *  fiscal), so computing it here is safe in a way a fiscal week is not. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + n));
};
const todayYmd = () => ymd(new Date());
const minYmd = (a: string, b: string) => (a < b ? a : b);
const maxYmd = (a: string, b: string) => (a > b ? a : b);

const oldestAnchor = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - MAX_ANCHOR_DAYS_BACK);
  return ymd(d);
};

export const pill = (on: boolean) =>
  `border text-[10px] font-bold px-2.5 py-1 rounded uppercase transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
    on ? "bg-tab-active text-white border-tab-border/50" : "bg-page text-ink-dim border-line hover:bg-line"
  }`;

const SELECT =
  "bg-page border border-line rounded px-2 py-1 text-[10px] font-bold text-white cursor-pointer disabled:opacity-40";

/** The scope every rework view opens on: the server's default five weeks. */
export const DEFAULT_REWORK_SCOPE: ReworkScope = {
  granularity: "week",
  // Unset on open so the server picks today. Afterwards only ever an anchor
  // the server returned — fiscal periods do not follow calendar weeks or
  // months, so a date computed here would land in the wrong one.
  anchor: null,
  weekFrom: null,
  weekTo: null,
  dateFrom: null,
  dateTo: null,
  timeFrom: null,
  timeTo: null,
  shift: null,
};

type Props = {
  scope: ReworkScope;
  onScopeChange: (update: (s: ReworkScope) => ReworkScope) => void;
  /** The period the charts are on, as the server returned it. */
  period: ReworkPeriod | null;
  /** Any request behind the view in flight: holds the granularity tabs and
   *  arrows still so a second click cannot race the first. */
  loading: boolean;
  /** A 400 from the view's requests — almost always "older than 365 days". */
  rejected: boolean;
  /** Off for the SPI and DPMOI charts, whose endpoints refuse `day`. */
  allowDay?: boolean;
};

/**
 * Day / Week / Month, the ‹ › arrows, the Week From–To range (or the Month
 * period) and the shift — the one period selector every rework view uses
 * (handoff 3.4–3.6), so the unit and SPI charts behave identically.
 *
 * Reads the dropdown lists itself from /rework/periods; everything else comes
 * from the server's `period`, never computed here.
 */
export const ReworkPeriodControls = ({
  scope,
  onScopeChange,
  period,
  loading,
  rejected,
  allowDay = true,
}: Props) => {
  const periods = useReworkPeriods(scope.granularity);
  // Week counts calendar days from timestamped data (2026-11-13), which starts
  // on this day; a week before it is a 400. Known once a request said so.
  const historyFrom = useReworkHistoryFrom();
  const weekBeforeHistory = (from: string) =>
    scope.granularity === "week" && historyFrom !== null && from < historyFrom;

  // Read only when the list is for the granularity on screen, so a stale
  // month list never fills the week dropdowns for a frame.
  const periodOptions =
    scope.granularity !== "day" && periods.data?.granularity === scope.granularity
      ? periods.data.options
      : [];
  const optionFrom = (from: string | undefined) =>
    from ? periodOptions.find((o) => o.from === from) ?? null : null;
  // Month: the one period on screen.
  const selectedOption = optionFrom(period?.from);
  // Week: the span on screen, as From and To. Read off `period.weeks` rather
  // than the range in state, so the default five weeks — sent as no range at
  // all — and the arrows' sliding window both show as what they are.
  const spanWeeks = period?.weeks ?? [];
  const fromOption = optionFrom(spanWeeks[0]?.from);
  const toOption = optionFrom(spanWeeks[spanWeeks.length - 1]?.from);
  const isRange = scope.granularity === "week" && Boolean(scope.weekFrom && scope.weekTo);
  // A Day range has no prev/next anchors either: the two date pickers move it.
  const isDayRange = scope.granularity === "day" && Boolean(scope.dateFrom && scope.dateTo);

  /** Move one end of the Day range, keeping the other inside 31 days. */
  const setDayRange = (end: "from" | "to", value: string) => {
    if (!value) return;
    onScopeChange((s) => {
      let from = end === "from" ? value : (s.dateFrom ?? value);
      let to = end === "to" ? value : (s.dateTo ?? value);
      if (from > to) {
        if (end === "from") to = from;
        else from = to;
      }
      // Over 31 days: pull the OTHER end in, so the one just picked stays.
      if (addDays(from, MAX_DAY_RANGE - 1) < to) {
        if (end === "from") to = addDays(from, MAX_DAY_RANGE - 1);
        else from = addDays(to, -(MAX_DAY_RANGE - 1));
      }
      // Narrowing to one date can leave the end time at or before the start.
      const clash = endBeforeStart(from === to, s.timeFrom, s.timeTo);
      return {
        ...s,
        anchor: null,
        dateFrom: from,
        dateTo: minYmd(to, todayYmd()),
        timeTo: clash ? null : s.timeTo,
      };
    });
  };

  const prevDisabled =
    loading ||
    !period?.prev_anchor ||
    period.prev_anchor < oldestAnchor() ||
    rejected ||
    // Sliding the 5-week span back one week moves its first week 7 days back.
    (spanWeeks[0] ? weekBeforeHistory(addDays(spanWeeks[0].from, -7)) : false);
  const nextDisabled = loading || !period?.next_anchor;

  /** Pick one end of the week range; the other end stays where it is on screen. */
  const setWeekRange = (end: "from" | "to", anchor: string) => {
    const from = end === "from" ? anchor : (fromOption?.anchor ?? anchor);
    const to = end === "to" ? anchor : (toOption?.anchor ?? anchor);
    onScopeChange((s) => ({ ...s, anchor: null, weekFrom: from, weekTo: to }));
  };

  const optionLabel = (o: ReworkPeriodOption) =>
    `${o.label} (${shortDay(o.from)} – ${shortDay(o.to)})${o.partial ? " · in progress" : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        {GRANULARITIES.filter((g) => allowDay || g.key !== "day").map((g) => (
          <button
            key={g.key}
            type="button"
            disabled={loading && scope.granularity !== g.key}
            // Keeps the date, so the user stays around the same place: the
            // last week of a range becomes the anchor. A week range is
            // Week-only, so it is dropped on the way out. Day opens on the
            // last seven days, ending at that same date.
            onClick={() =>
              onScopeChange((s) => {
                const anchor = s.weekTo ?? s.dateTo ?? s.anchor;
                if (g.key === "day") {
                  const to = anchor ? minYmd(anchor, todayYmd()) : todayYmd();
                  return {
                    ...s,
                    granularity: "day",
                    anchor: null,
                    weekFrom: null,
                    weekTo: null,
                    dateFrom: s.dateFrom ?? addDays(to, -(DEFAULT_DAY_SPAN - 1)),
                    dateTo: s.dateTo ?? to,
                  };
                }
                return {
                  ...s,
                  granularity: g.key,
                  anchor,
                  weekFrom: null,
                  weekTo: null,
                  dateFrom: null,
                  dateTo: null,
                  // Times are Day-only: a week or month with them is a 400.
                  timeFrom: null,
                  timeTo: null,
                };
              })
            }
            className={pill(scope.granularity === g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Hidden on a picked range: the API sends no prev/next anchors there,
          and the From/To dropdowns are the navigation. On the default five
          weeks they slide the window by one week. */}
      {!isRange && !isDayRange && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous period"
            disabled={prevDisabled}
            onClick={() => period?.prev_anchor && onScopeChange((s) => ({ ...s, anchor: period.prev_anchor }))}
            className={`${pill(false)} !px-1.5`}
            title={
              rejected
                ? "Older than 365 days is not available"
                : scope.granularity === "week"
                  ? "Slide the five weeks back by one"
                  : "Previous period"
            }
          >
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            aria-label="Next period"
            disabled={nextDisabled}
            onClick={() => period?.next_anchor && onScopeChange((s) => ({ ...s, anchor: period.next_anchor }))}
            className={`${pill(false)} !px-1.5`}
            title={
              period && !period.next_anchor
                ? "This is the current period"
                : scope.granularity === "week"
                  ? "Slide the five weeks forward by one"
                  : "Next period"
            }
          >
            <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Day: a calendar date range, at most 31 days, today at the latest. One
          date on both ends is that single day. The paretos cover the whole
          range; the trend charts draw one bar per day. */}
      {scope.granularity === "day" && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">From</span>
          <input
            type="date"
            value={scope.dateFrom ?? ""}
            min={oldestAnchor()}
            max={scope.dateTo ?? todayYmd()}
            onChange={(e) => setDayRange("from", e.target.value)}
            className={`${SELECT} [color-scheme:dark]`}
            aria-label="From date"
          />
          <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">To</span>
          <input
            type="date"
            value={scope.dateTo ?? ""}
            min={scope.dateFrom ?? oldestAnchor()}
            max={
              scope.dateFrom
                ? minYmd(addDays(scope.dateFrom, MAX_DAY_RANGE - 1), todayYmd())
                : todayYmd()
            }
            onChange={(e) => setDayRange("to", e.target.value)}
            className={`${SELECT} [color-scheme:dark]`}
            aria-label="To date"
          />
          {/* Time of day (2026-11-01): one continuous window from From + start
              time to To + end time. Hours start on the :15, matching the
              shifts; the end is not included. On a single day the end list
              only offers hours after the start, which the server would
              otherwise refuse. */}
          <select
            value={scope.timeFrom ?? ""}
            onChange={(e) => {
              const t = e.target.value || null;
              onScopeChange((s) => {
                const clash = endBeforeStart(s.dateFrom === s.dateTo, t, s.timeTo);
                return { ...s, timeFrom: t, timeTo: clash ? null : s.timeTo };
              });
            }}
            className={SELECT}
            aria-label="Start time"
            title="Start time, on the From date. --:-- = whole production days (06:15)"
          >
            <option value="">--:--</option>
            {HOUR_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="text-[9.5px] font-black text-ink-dim">–</span>
          <select
            value={scope.timeTo ?? ""}
            onChange={(e) => onScopeChange((s) => ({ ...s, timeTo: e.target.value || null }))}
            className={SELECT}
            aria-label="End time"
            title="End time, on the To date (not included). For a night shift pick the next date as To, e.g. 30 Oct 22:00 → 31 Oct 06:00"
          >
            <option value="">--:--</option>
            {HOUR_SLOTS.filter(
              (t) => !endBeforeStart(scope.dateFrom === scope.dateTo, scope.timeFrom, t),
            ).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const t = todayYmd();
              onScopeChange((s) => ({ ...s, anchor: null, dateFrom: t, dateTo: t, timeFrom: null, timeTo: null }));
            }}
            className={pill(scope.dateFrom === todayYmd() && scope.dateTo === todayYmd())}
            title="Today only"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const t = todayYmd();
              onScopeChange((s) => ({
                ...s,
                anchor: null,
                dateFrom: maxYmd(addDays(t, -(DEFAULT_DAY_SPAN - 1)), oldestAnchor()),
                dateTo: t,
                timeFrom: null,
                timeTo: null,
              }));
            }}
            className={pill(false)}
            title="The last seven days, today included"
          >
            Last 7 days
          </button>
        </div>
      )}

      {/* Week: From and To over the same last-8-weeks list. Each sends that
          option's own anchor, never a computed date. Weeks after To are
          disabled in From and weeks before From in To, which the server would
          refuse. A span end older than the list (the arrows can reach one)
          shows as itself rather than blank. */}
      {scope.granularity === "week" && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">From</span>
          <select
            value={fromOption?.anchor ?? ""}
            disabled={periodOptions.length === 0}
            onChange={(e) => e.target.value && setWeekRange("from", e.target.value)}
            className={SELECT}
            aria-label="From week"
          >
            {!fromOption && (
              <option value="">
                {periods.state === "loading" ? "Loading…" : (spanWeeks[0]?.label ?? "—")}
              </option>
            )}
            {periodOptions.map((o) => (
              <option
                key={o.anchor}
                value={o.anchor}
                disabled={(!!toOption && o.from > toOption.from) || weekBeforeHistory(o.from)}
              >
                {optionLabel(o)}
              </option>
            ))}
          </select>
          <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">To</span>
          <select
            value={toOption?.anchor ?? ""}
            disabled={periodOptions.length === 0}
            onChange={(e) => e.target.value && setWeekRange("to", e.target.value)}
            className={SELECT}
            aria-label="To week"
          >
            {!toOption && (
              <option value="">
                {periods.state === "loading"
                  ? "Loading…"
                  : (spanWeeks[spanWeeks.length - 1]?.label ?? period?.label ?? "—")}
              </option>
            )}
            {periodOptions.map((o) => (
              <option
                key={o.anchor}
                value={o.anchor}
                disabled={(!!fromOption && o.from < fromOption.from) || weekBeforeHistory(o.from)}
              >
                {optionLabel(o)}
              </option>
            ))}
          </select>
          {/* Back to the server's default: the current week and the four
              before it, with the arrows. */}
          {(isRange || scope.anchor) && (
            <button
              type="button"
              onClick={() => onScopeChange((s) => ({ ...s, anchor: null, weekFrom: null, weekTo: null }))}
              className={pill(false)}
              title="The current week and the four before it"
            >
              Last 5 weeks
            </button>
          )}
        </div>
      )}

      {/* Month: one fiscal period of the last twelve. */}
      {scope.granularity === "month" && (
        <select
          value={selectedOption?.anchor ?? ""}
          disabled={periodOptions.length === 0}
          onChange={(e) => e.target.value && onScopeChange((s) => ({ ...s, anchor: e.target.value }))}
          className={SELECT}
          aria-label="Fiscal period"
        >
          {!selectedOption && (
            <option value="">
              {periods.state === "loading"
                ? "Loading…"
                : period
                  ? `${period.label} (${shortDay(period.from)} – ${shortDay(period.to)})`
                  : "—"}
            </option>
          )}
          {periodOptions.map((o) => (
            <option key={o.anchor} value={o.anchor}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      )}

      <select
        value={scope.shift ?? ""}
        onChange={(e) =>
          onScopeChange((s) => ({ ...s, shift: (e.target.value || null) as ReworkScope["shift"] }))
        }
        className={`${SELECT} uppercase`}
        aria-label="Shift"
      >
        {SHIFTS.map((s) => (
          <option key={s ?? "all"} value={s ?? ""}>
            {s ? `Shift ${s}` : "All shifts"}
          </option>
        ))}
      </select>
    </div>
  );
};

/** "AKNB – WK39–WK43 (in progress)  2026-09-21 – 2026-10-25 · data to …" */
export const ReworkPeriodTitle = ({ period }: { period: ReworkPeriod | null }) =>
  period ? (
    <>
      <span className="text-[13px] font-black text-info whitespace-nowrap">
        – {period.span_label ?? period.label}
        {period.partial && <span className="ml-1 text-[11px] font-bold text-warning">(in progress)</span>}
      </span>
      <span className="text-[10.5px] font-bold text-ink-dim whitespace-nowrap">
        {period.from === period.to ? period.from : `${period.from} – ${period.to}`}
        {period.partial && period.read_to !== period.to && ` · data to ${period.read_to}`}
      </span>
    </>
  ) : null;

export default ReworkPeriodControls;
