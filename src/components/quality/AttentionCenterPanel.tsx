import { useState } from "react";
import { createPortal } from "react-dom";
import { Bot, ChevronRight } from "lucide-react";
import AlertCard, { RecTip } from "./AlertCard";
import AlertTabs, { AlertTab } from "./AlertTabs";
import ShiftReportDownload from "./ShiftReportDownload";

const ALERT_PREVIEW_LIMIT = 4;

interface AttentionCenterPanelProps {
  /** Alerts already filtered to the active severity. */
  alerts: any[];
  activeTab: AlertTab;
  onTabChange: (tab: AlertTab) => void;
  tabCounts: Record<AlertTab, number>;
  feedState: "loading" | "ready" | "error";
  /** Opens the full-list modal. */
  onOpenAll: () => void;
}

// Attention Center panel: severity tabs, the first few alerts as cards, and a
// link to the full list.
//
// Owns the AI-recommendation tooltip because it portals to document.body — the
// alert cards sit in a scrolling list that would clip it.
export const AttentionCenterPanel = ({
  alerts: visibleAlerts,
  activeTab,
  onTabChange,
  tabCounts,
  feedState,
  onOpenAll,
}: AttentionCenterPanelProps) => {
  const [recTip, setRecTip] = useState<RecTip | null>(null);

  const previewAlerts = visibleAlerts.slice(0, ALERT_PREVIEW_LIMIT);

  return (
    <>
      <section className="bg-panel border border-line rounded-xl p-4 flex flex-col h-[380px]">
        <div className="flex items-center justify-between border-b border-line/50 pb-2 mb-2 flex-shrink-0">
          <span className="text-[12px] font-black tracking-widest text-ink-muted uppercase">
            ATTENTION CENTER
          </span>
          <ShiftReportDownload />
        </div>

        <div className="flex gap-2 mb-2 flex-shrink-0">
          <AlertTabs
            active={activeTab}
            onChange={onTabChange}
            counts={tabCounts}
          />
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2"
          onScroll={() => recTip && setRecTip(null)}
        >
          {visibleAlerts.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-10 text-center text-[12px] font-bold tracking-wide">
              {feedState === "loading" ? (
                <span className="text-ink-dim">Loading…</span>
              ) : feedState === "error" ? (
                <span className="text-warning">
                  Alerts unavailable — live feed disconnected
                </span>
              ) : (
                <span className="text-ink-dim">No records found</span>
              )}
            </div>
          )}
          {previewAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onRecHover={setRecTip}
            />
          ))}
        </div>

        <div className="flex justify-between items-center pt-2.5 mt-1 flex-shrink-0 border-t border-line/50">
          <span className="text-[10px] font-bold text-ink-dim">
            {visibleAlerts.length > ALERT_PREVIEW_LIMIT
              ? `Showing ${ALERT_PREVIEW_LIMIT} of ${visibleAlerts.length}`
              : `Showing ${visibleAlerts.length}`}
          </span>
          <button
            onClick={() => onOpenAll()}
            disabled={visibleAlerts.length === 0}
            className="flex items-center gap-1 text-[10px] font-bold text-tab-border hover:text-white disabled:text-[#3b5069] disabled:cursor-not-allowed transition-colors"
          >
            View All Alerts
            <span className="bg-tab-active/60 border border-tab-border/40 rounded px-1.5 py-[1px] font-mono">
              {visibleAlerts.length}
            </span>
            <ChevronRight size={11} />
          </button>
        </div>
      </section>

      {recTip &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[9999] pointer-events-none w-[300px] max-w-[90vw] -translate-x-1/2 -translate-y-full bg-[#0b1220] border border-indigo-700/50 rounded-md p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
            style={{
              left: Math.min(Math.max(recTip.x, 160), window.innerWidth - 160),
              top: recTip.y - 8,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Bot size={11} className="text-indigo-400" />
              <span className="text-indigo-400 text-[9px] font-black uppercase tracking-wider">
                AI Recommendation
              </span>
            </div>
            <p className="text-ink-secondary text-[11px] font-medium leading-relaxed">
              {recTip.text}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
};

export default AttentionCenterPanel;
