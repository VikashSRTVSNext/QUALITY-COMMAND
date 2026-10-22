import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import LoadingBar, { useSlowHint } from "../common/LoadingBar";

/** How long a request runs before the panel is locked. Below this the bar and
 *  the header text are enough, and a veil that flashes on every fast refilter
 *  is noise. */
const BLOCK_AFTER_MS = 350;

type Props = {
  onClose: () => void;
  /** When set, Escape steps BACK one level before it closes. Losing a drill-down
   *  to a mistyped Escape is the annoyance this avoids. */
  onBack?: (() => void) | null;
  /** Left of the header: title and any breadcrumb. */
  header: React.ReactNode;
  /** Right of the header, before the close button — a date, extra actions. */
  meta?: React.ReactNode;
  /** Tailwind max-width class. Wide tables want more room than narrow ones. */
  maxWidth?: string;
  /** True while ANY request behind this modal is in flight — the first load and
   *  every refilter alike. The refilter case is the one that matters: the panel
   *  keeps showing the previous answer while the new one loads, so without this
   *  a click on a filter chip looks like it did nothing. */
  busy?: boolean;
  /** Lock the body and the header controls while `busy`. On by default: these
   *  queries can run for a minute, and a second filter click in that time
   *  queues another slow request behind the first and leaves the operator
   *  unsure which answer is on screen. Close stays live throughout. */
  blockWhileBusy?: boolean;
  children: React.ReactNode;
};

/** True once `active` has held for `ms`; false the moment it drops. */
const useDelayed = (active: boolean, ms: number) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) {
      setOn(false);
      return;
    }
    const t = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return on;
};

/** Whole seconds since `active` went true, ticking once a second. */
const useElapsedSeconds = (active: boolean) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setSecs(0);
    if (!active) return;
    const started = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active]);
  return secs;
};

/**
 * The chrome every process drill-down shares: backdrop, panel, header strip,
 * Escape and click-outside handling, and the loading lock.
 *
 * Extracted so a second drill-down reuses the SHELL rather than the contents.
 * ProductDrilldownModal's props are product/tester/NC-log specific, so reusing
 * that component for a different subject would have meant threading unrelated
 * fields through it; this keeps the parts that are genuinely common — how a modal
 * looks, how it closes and how it waits — in one place.
 */
export const DrilldownModalShell = ({
  onClose,
  onBack,
  header,
  meta,
  maxWidth = "max-w-[1400px]",
  busy = false,
  blockWhileBusy = true,
  children,
}: Props) => {
  const slow = useSlowHint(busy);
  const blocked = useDelayed(blockWhileBusy && busy, BLOCK_AFTER_MS);
  // From when the request started, not from when the veil appeared, so the
  // count matches the wait the operator has actually had.
  const elapsed = useElapsedSeconds(busy);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape still works while locked: stepping back or closing abandons the
      // wait, which is exactly the way out a locked screen must keep.
      if (onBack) onBack();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onBack]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-page/30 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* stopPropagation, or a click anywhere inside the panel would close it */}
      <div
        className={`relative w-full ${maxWidth} max-h-[88vh] bg-panel/95 border border-line-soft rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.75)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Under the header strip rather than at the very top of the panel, so it
            reads as belonging to the content being replaced rather than to the
            title, which does not change. */}
        <div className="flex justify-between items-center bg-white/[0.04] px-6 py-4 border-b border-line-modal flex-shrink-0 gap-3 relative">
          <LoadingBar active={busy} className="top-auto bottom-0" />
          <div className="flex items-center gap-2 min-w-0">{header}</div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* The text half of the indicator. Carries the meaning on its own,
                which is what makes the bar safe to freeze under reduced motion. */}
            {busy && (
              <span
                className="text-[10px] font-bold text-info uppercase tracking-wider whitespace-nowrap"
                aria-live="polite"
              >
                {slow ? "Still loading…" : "Loading…"}
              </span>
            )}
            {/* The modal's own controls -- view toggles, date picker, filters --
                go inert with the body, so nothing can fire a second request
                while the first is still running. */}
            <div
              className={`flex items-center gap-3 transition-opacity ${blocked ? "opacity-40 pointer-events-none" : ""}`}
              inert={blocked}
            >
              {meta}
            </div>
            <button
              onClick={onClose}
              className="bg-raised hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* A positioned box for the veil, laid out exactly as the panel lays
            out its children (a flex column that fills the rest), so wrapping
            them here changes nothing about how they size or scroll. */}
        <div className="relative flex-1 min-h-0 flex flex-col" aria-busy={busy}>
          <div className="flex-1 min-h-0 flex flex-col" inert={blocked}>
            {children}
          </div>

          {blocked && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-panel/70 backdrop-blur-[2px] cursor-wait"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-2.5 px-6 py-5 rounded-xl border border-line-strong bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-w-[44ch] text-center">
                <Loader2 size={26} className="text-info animate-spin" />
                <div className="text-[12px] font-black text-white uppercase tracking-wider">
                  {slow ? "Still loading" : "Loading"}
                  <span className="ml-1.5 font-mono font-bold text-ink-muted normal-case tabular-nums">
                    {elapsed}s
                  </span>
                </div>
                <div className="text-[10.5px] text-ink-dim leading-relaxed">
                  {slow
                    ? "A wide window on a busy day can take up to a minute. Controls are paused until it lands — Close or Esc to stop waiting."
                    : "Controls are paused until this answer lands."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrilldownModalShell;
