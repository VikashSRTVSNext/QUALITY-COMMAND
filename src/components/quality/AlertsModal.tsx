import { useEffect } from "react";
import AlertTableRow from "./AlertTableRow";
import AlertTabs, { AlertTab } from "./AlertTabs";

interface AlertsModalProps {
  /** Alerts already filtered to the active severity. */
  alerts: any[];
  activeTab: AlertTab;
  onTabChange: (tab: AlertTab) => void;
  tabCounts: Record<AlertTab, number>;
  onClose: () => void;
}

// The full alert list. Rendered only while open, so the Escape handler can key
// off mount rather than a flag — it used to live in the dashboard, which meant
// the dashboard knew about a keybinding that is purely this modal's business.
export const AlertsModal = ({
  alerts: visibleAlerts,
  activeTab,
  onTabChange,
  tabCounts,
  onClose,
}: AlertsModalProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-page/30 backdrop-blur-sm p-4 lg:p-8"
      onClick={() => onClose()}
    >
      <div
        className="relative w-full max-w-[1200px] max-h-[85vh] bg-panel/95 border border-line-soft rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center bg-panel/90 px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-critical animate-pulse" />
            <span className="text-[16px] font-black text-white uppercase tracking-wider">
              Attention Center
            </span>
          </div>
          <button
            onClick={() => onClose()}
            className="bg-raised hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-b border-line/60 flex-shrink-0">
          <div className="flex gap-2">
            <AlertTabs
              active={activeTab}
              onChange={onTabChange}
              counts={tabCounts}
            />
          </div>
          <span className="text-[11px] font-bold text-ink-dim">
            {visibleAlerts.length}{" "}
            {visibleAlerts.length === 1 ? "alert" : "alerts"}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-6 py-3">
          {visibleAlerts.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[12px] font-bold text-ink-dim">
              No records found
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] text-ink-dim uppercase tracking-wider">
                <tr>
                  <th className="pb-2 font-black sticky top-0 bg-panel border-b border-line z-10">
                    Severity
                  </th>
                  <th className="pb-2 font-black sticky top-0 bg-panel border-b border-line z-10">
                    Alert
                  </th>
                  <th className="pb-2 font-black text-center sticky top-0 bg-panel border-b border-line z-10">
                    Impact
                  </th>
                  <th className="pb-2 font-black text-right sticky top-0 bg-panel border-b border-line z-10">
                    Age
                  </th>
                  <th className="pb-2 font-black sticky top-0 bg-panel border-b border-line z-10">
                    AI Recommendation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/45">
                {visibleAlerts.map((alert) => (
                  <AlertTableRow key={alert.id} alert={alert} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsModal;
