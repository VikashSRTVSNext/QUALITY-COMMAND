// Production-day range picker for the QCC dashboard.
//
// Two native date inputs plus presets. Native rather than a date-picker
// dependency because the value is a plain YYYY-MM-DD production-day label, which
// is exactly what <input type="date"> yields — a picker library would add a
// timezone-aware Date in the middle of a contract that has no instants in it.
//
// Presented as a PILL plus a popover, not an inline row. The header is a
// single-line flex bar of fixed-height pills; two date fields, three presets and
// a status line sitting inline wrap on a laptop and stretch the whole bar.
// Collapsed, this is one pill the width of its own label, like the shift
// dropdown beside it.
//
// The control is DEBOUNCED and commits both dates together. Two reasons, and the
// first is the one the backend called out: a picker that fires while the "from"
// field is still empty sends an open-ended range, which scans years of
// production and comes back as a 400 about the 400-day ceiling. Committing on a
// trailing edge also means typing a year digit by digit is one request, not four.

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import {
  MAX_RANGE_DAYS,
  rangeDayCount,
  rangeEarliest,
  rangeError,
  rangeLatest,
  shortDay,
  type DateRange,
} from "./dashboardFilters";

/** Trailing-edge delay before a typed date turns into a request. */
const COMMIT_DELAY_MS = 450;

const FIELD_CLASS =
  "bg-page border border-line rounded px-1.5 py-1 text-[12px] text-white " +
  "font-bold outline-none focus:border-line-strong [color-scheme:dark] w-[130px]";

const PRESET_CLASS =
  "text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded " +
  "border border-line text-ink-dim hover:bg-line hover:text-white transition-colors";

/** Today as a production-day label, in the viewer's own calendar.
 *
 *  Only ever used to seed the presets. A production day runs 06:15 to 06:15, so
 *  between midnight and 06:15 this names the calendar day the backend would call
 *  yesterday — harmless for a preset the user can see and adjust, which is why
 *  no attempt is made to guess the boundary client-side. */
const todayLabel = (): string => {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const daysAgoLabel = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

/** What the collapsed pill reads. Kept short enough to sit in the header at
 *  1366px, where the bar is already close to full. */
const pillLabel = (range: DateRange): string => {
  if (!range.from && !range.to) return "LIVE";
  if (range.from && range.to) {
    return range.from === range.to
      ? shortDay(range.from)
      : `${shortDay(range.from)} – ${shortDay(range.to)}`;
  }
  return shortDay((range.from ?? range.to) as string);
};

// Inclusive spans, so "last 7 days" ends today and starts six days back.
//
// No 90D any more: MAX_RANGE_DAYS is 30, so that button could only ever produce
// a range the picker then refuses. Offering a control that is always invalid is
// worse than not offering it. Every preset here is filtered against the ceiling
// below, so raising MAX_RANGE_DAYS is the only edit needed to bring one back.
const PRESETS: { label: string; span: number }[] = [
  { label: "7D", span: 7 },
  { label: "30D", span: 30 },
  { label: "90D", span: 90 },
].filter((p) => p.span <= MAX_RANGE_DAYS);

interface DateRangeFilterProps {
  /** The committed range — what is actually being fetched. */
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Shown inside the popover: the window the backend reported, which can
   *  differ from what was asked for when only one date was sent. */
  appliedLabel?: string | null;
}

export const DateRangeFilter = ({
  value,
  onChange,
  appliedLabel,
}: DateRangeFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // What the inputs show. Separate from `value` so a half-typed date is visible
  // without being requested.
  const [draft, setDraft] = useState<DateRange>(value);

  // Re-sync when the range is changed from outside (a preset, or Clear).
  useEffect(() => {
    setDraft(value);
  }, [value.from, value.to]);

  const draftError = rangeError(draft);

  useEffect(() => {
    // An invalid draft is never committed: it would spend a round trip to be
    // told what rangeError already knows.
    if (draftError) return;
    if (draft.from === value.from && draft.to === value.to) return;

    const id = setTimeout(() => onChange(draft), COMMIT_DELAY_MS);
    return () => clearTimeout(id);
  }, [draft.from, draft.to, draftError, value.from, value.to, onChange]);

  const applyPreset = (span: number) => {
    const next = { from: daysAgoLabel(span - 1), to: todayLabel() };
    setDraft(next);
    onChange(next); // A preset is a finished choice — no debounce to wait for.
  };

  const clear = () => {
    const next = { from: null, to: null };
    setDraft(next);
    onChange(next);
  };

  const days = rangeDayCount(draft);
  const isActive = Boolean(value.from || value.to);

  const status = draftError
    ? draftError
    : appliedLabel
      ? appliedLabel
      : isActive && days !== null
        ? `${days} production day${days === 1 ? "" : "s"}`
        : isActive
          ? "Single production day"
          : `Live current day · ranges up to ${MAX_RANGE_DAYS} days`;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={isActive ? status : "Filter by production day"}
        className={`flex items-center gap-1.5 border rounded px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors outline-none ${
          isActive
            ? "bg-panel border-info/40 text-info hover:bg-raised"
            : "bg-panel border-line-strong text-white hover:bg-raised"
        }`}
      >
        <CalendarDays size={12} className="text-ink-dim flex-shrink-0" />
        {pillLabel(value)}
        <ChevronDown
          size={11}
          className={`text-ink-dim transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-50 w-max bg-panel border border-line-strong rounded-lg shadow-xl shadow-black/50 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="First production day"
                className={FIELD_CLASS}
                value={draft.from ?? ""}
                // Empty string means the field was cleared, which is a real
                // state (one date alone is a single-day query), so it maps to
                // null.
                onChange={(e) =>
                  setDraft((d) => ({ ...d, from: e.target.value || null }))
                }
                // The window is a ROLLING one — today back MAX_RANGE_DAYS —
                // so both ends are pinned to it as well as to each other. The
                // native calendar then greys out every day it cannot answer,
                // which is the difference between a control that refuses you and
                // one that never offers the mistake.
                min={rangeEarliest()}
                max={draft.to ?? rangeLatest()}
              />
              <span className="text-ink-dim text-[11px]">–</span>
              <input
                type="date"
                aria-label="Last production day"
                className={FIELD_CLASS}
                value={draft.to ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, to: e.target.value || null }))
                }
                // Today at the latest: there is no data after it, and a
                // future date is a request that can only come back empty.
                max={rangeLatest()}
                min={draft.from ?? rangeEarliest()}
              />
            </div>

            <div className="flex items-center gap-1.5">
              {PRESETS.map(({ label, span }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => applyPreset(span)}
                  className={PRESET_CLASS}
                >
                  {label}
                </button>
              ))}

              {isActive && (
                <button
                  type="button"
                  onClick={clear}
                  title="Back to the live current-day view"
                  className={`flex items-center gap-0.5 ${PRESET_CLASS}`}
                >
                  <X size={10} /> Live
                </button>
              )}
            </div>

            <span
              className={`text-[10px] max-w-[290px] ${
                draftError ? "font-bold text-critical" : "text-ink-dim"
              }`}
            >
              {status}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default DateRangeFilter;
