// Attention Center shift report: the same Excel workbook the system mails after
// every shift, for any range of production days.
//
// Deliberately NOT built on dashboardFilters.ts. The two pickers have different
// rules and must not share a validator:
//   - dashboard filters: at most 30 days AND within the last 30 days (rolling)
//   - this report:       at most 31 days, any past range, no rolling window
// The endpoint also names its dates differently (`from_date` / `to_date`, not
// `date_from` / `date_to`), so the parameters are mapped explicitly here.

import { apiUrl } from "../../core/api/config";

/** Backend ceiling: one download covers at most this many production days. */
export const SHIFT_REPORT_MAX_DAYS = 31;

export type ReportShift = "A" | "B" | "C";

/** Today as a YYYY-MM-DD label in the viewer's own calendar. The backend owns
 *  the 06:15 production-day boundary and is the authority on "not after
 *  today"; this only seeds the picker and stops obvious mistakes. */
export const reportToday = (): string => {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

/** Inclusive day count. Parsed as UTC so DST and the viewer's zone cannot move
 *  it; these are day labels, not instants. */
const dayCount = (from: string, to: string): number =>
  Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  ) + 1;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Why this request cannot be sent, or null when it can. Mirrors the endpoint's
 * 400s so the button can be disabled with the reason beside it instead of
 * spending a round trip to hear it.
 */
export const shiftReportError = (
  from: string | null,
  to: string | null,
): string | null => {
  if (!from || !to) return "Choose both a start and an end day.";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return "Dates must be YYYY-MM-DD.";
  // Lexical order is date order for fixed-width zero-padded labels.
  if (to < from) return "The end day is before the start day.";
  if (to > reportToday()) return "The end day is in the future.";
  const days = dayCount(from, to);
  if (days > SHIFT_REPORT_MAX_DAYS) {
    return `One download covers at most ${SHIFT_REPORT_MAX_DAYS} days (this is ${days}).`;
  }
  return null;
};

/** An error the UI can show as-is. The endpoint's `title` and `detail` are
 *  both documented as safe to display. */
export class ShiftReportError extends Error {
  constructor(
    public title: string,
    public detail: string,
  ) {
    super(`${title}: ${detail}`);
  }
}

/**
 * Fetch the workbook and hand it to the browser as a download.
 *
 * fetch + blob rather than a plain link: a link turns an error into a raw JSON
 * page, and the errors here (range too long, bad date) are ones the user should
 * read next to the picker and correct.
 */
export const downloadShiftReport = async (
  from: string,
  to: string,
  shift: ReportShift | null,
  signal?: AbortSignal,
): Promise<string> => {
  const qs = new URLSearchParams({ from_date: from, to_date: to });
  if (shift) qs.set("shift", shift);
  const res = await fetch(apiUrl(`/alerts/shift-report?${qs}`), { signal });

  if (!res.ok) {
    // Same envelope as the alert acknowledgement API, NOT FastAPI's `detail`.
    let title = "Download failed";
    let detail = `The server answered ${res.status}.`;
    try {
      const body = await res.json();
      if (body?.error) {
        title = body.error.title ?? title;
        detail = body.error.detail ?? detail;
      } else if (typeof body?.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // Non-JSON (a proxy page); keep the generic wording.
    }
    throw new ShiftReportError(title, detail);
  }

  // The API exposes Content-Disposition cross-origin, so the server's own
  // name (attention_alerts_<from>[_to_<to>]_<shift>.xlsx) survives local dev.
  const name =
    /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
    "attention_alerts.xlsx";

  const url = URL.createObjectURL(await res.blob());
  try {
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: name,
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Deferred one tick: some browsers start the download asynchronously and
    // revoking synchronously can cancel it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return name;
};
