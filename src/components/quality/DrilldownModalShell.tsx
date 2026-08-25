import { useEffect } from "react";

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
  children: React.ReactNode;
};

/**
 * The chrome every process drill-down shares: backdrop, panel, header strip,
 * Escape and click-outside handling.
 *
 * Extracted so a second drill-down reuses the SHELL rather than the contents.
 * ProductDrilldownModal's props are product/tester/NC-log specific, so reusing
 * that component for a different subject would have meant threading unrelated
 * fields through it; this keeps the parts that are genuinely common — how a modal
 * looks and how it closes — in one place.
 */
export const DrilldownModalShell = ({
  onClose,
  onBack,
  header,
  meta,
  maxWidth = "max-w-[1400px]",
  children,
}: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
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
        <div className="flex justify-between items-center bg-white/[0.04] px-6 py-4 border-b border-line-modal flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">{header}</div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {meta}
            <button
              onClick={onClose}
              className="bg-raised hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};

export default DrilldownModalShell;
