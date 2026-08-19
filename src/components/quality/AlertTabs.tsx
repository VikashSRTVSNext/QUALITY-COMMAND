export const ALERT_TABS = ["All", "Critical", "Risk"] as const;

export type AlertTab = (typeof ALERT_TABS)[number];

interface AlertTabsProps {
  active: AlertTab;
  onChange: (tab: AlertTab) => void;
  /** Alert count per severity, shown in the pill beside each label. */
  counts: Record<AlertTab, number>;
}

// Severity filter for the Attention Center. Rendered in both the dashboard panel
// and the full-list modal, which share one selection — switching severity in the
// modal leaves the panel on the same filter when it closes.
export const AlertTabs = ({ active, onChange, counts }: AlertTabsProps) => (
  <>
    {ALERT_TABS.map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        aria-pressed={active === tab}
        className={`${active === tab ? "bg-tab-active text-white border-tab-border/50" : "bg-page text-ink-dim border-line hover:bg-line hover:text-ink-muted"} border text-[11px] font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5`}
      >
        {tab}
        <span
          className={`${active === tab ? "bg-tab-border/30 text-white" : "bg-line/70 text-ink-dim"} rounded px-1 font-mono text-[10px] leading-tight`}
        >
          {counts[tab]}
        </span>
      </button>
    ))}
  </>
);

export default AlertTabs;
