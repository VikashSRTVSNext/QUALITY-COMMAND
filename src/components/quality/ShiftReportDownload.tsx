// Shift report download: a small icon button that opens a from / to / shift
// picker and saves the Attention Center workbook.
//
// Only rendered where the Attention Center itself is shown. The endpoint has no
// login and the workbook carries engineers' names, comments and causes, so the
// button must not spread to screens that do not already show that content.

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  downloadShiftReport,
  reportToday,
  shiftReportError,
  ShiftReportError,
  SHIFT_REPORT_MAX_DAYS,
  type ReportShift,
} from "../alerts/shiftReport";

const FIELD_CLASS =
  "bg-page border border-line rounded px-1.5 py-1 text-[12px] text-white " +
  "font-bold outline-none focus:border-line-strong [color-scheme:dark] w-[130px]";

const SHIFT_OPTIONS: { value: ReportShift | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

interface ShiftReportDownloadProps {
  /** Which way the popover opens from the button. */
  align?: "left" | "right";
}

export const ShiftReportDownload = ({
  align = "right",
}: ShiftReportDownloadProps) => {
  const [open, setOpen] = useState(false);
  // Defaults from the contract: from = to = today, shift = all.
  const [from, setFrom] = useState<string | null>(reportToday);
  const [to, setTo] = useState<string | null>(reportToday);
  const [shift, setShift] = useState<ReportShift | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  // Closing (or unmounting with the modal) abandons an in-flight download
  // rather than saving a file the user has walked away from.
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const localError = shiftReportError(from, to);

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setServerError(null);
    setSaved(null);
  };

  const run = async () => {
    if (localError || busy || !from || !to) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true);
    setServerError(null);
    setSaved(null);
    try {
      const name = await downloadShiftReport(from, to, shift, ctrl.signal);
      if (!ctrl.signal.aborted) setSaved(name);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setServerError(
        err instanceof ShiftReportError
          ? `${err.title}: ${err.detail}`
          : "Download failed. Check the connection and try again.",
      );
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  };

  const message = serverError ?? localError;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Download the shift report (Excel)"
        aria-label="Download the shift report"
        aria-expanded={open}
        className="flex items-center gap-1 border border-line rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-dim hover:bg-line hover:text-white transition-colors"
      >
        {busy ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Download size={11} />
        )}
        Report
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-full mt-1 z-50 w-max bg-panel border border-line-strong rounded-lg shadow-xl shadow-black/50 p-3 flex flex-col gap-2 ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <span className="text-[11px] font-black tracking-widest text-ink-muted uppercase">
              Shift report
            </span>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="First production day"
                className={FIELD_CLASS}
                value={from ?? ""}
                max={to ?? reportToday()}
                onChange={(e) => edit(setFrom)(e.target.value || null)}
              />
              <span className="text-ink-dim text-[11px]">–</span>
              <input
                type="date"
                aria-label="Last production day"
                className={FIELD_CLASS}
                value={to ?? ""}
                min={from ?? undefined}
                max={reportToday()}
                onChange={(e) => edit(setTo)(e.target.value || null)}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-dim uppercase tracking-wide mr-1">
                Shift
              </span>
              {SHIFT_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => edit(setShift)(o.value)}
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border transition-colors ${
                    shift === o.value
                      ? "bg-tab-active text-white border-tab-border/50"
                      : "border-line text-ink-dim hover:bg-line hover:text-white"
                  }`}
                >
                  {o.label}
                </button>
              ))}

              <button
                type="button"
                onClick={run}
                disabled={Boolean(localError) || busy}
                className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded border border-info/40 text-info hover:bg-line disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Download size={11} />
                )}
                {busy ? "Preparing…" : "Download"}
              </button>
            </div>

            <span
              className={`text-[10px] max-w-[300px] ${
                message ? "font-bold text-critical" : "text-ink-dim"
              }`}
            >
              {message ??
                (saved
                  ? `Saved ${saved}`
                  : `Excel workbook · up to ${SHIFT_REPORT_MAX_DAYS} days · every alert raised or mailed in the selected shifts`)}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default ShiftReportDownload;
