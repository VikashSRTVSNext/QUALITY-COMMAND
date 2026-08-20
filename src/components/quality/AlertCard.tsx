import { Bell, Bot, ChevronRight } from "lucide-react";
import { palette } from "../../theme/palette";

export interface RecTip {
  text: string;
  x: number;
  y: number;
}

interface AlertCardProps {
  alert: any;
  onRecHover: (tip: RecTip | null) => void;
}

// One alert as it appears in the dashboard panel: a severity rail down the left,
// the title and age, the impact chip, and the AI recommendation.
export const AlertCard = ({ alert, onRecHover }: AlertCardProps) => (
  <div
    className={`group flex-shrink-0 bg-gradient-to-b from-[#0b1520] to-[#070f17] border ${alert.level === "Critical" ? "animate-border-pulse-critical" : "border-warning/25 hover:border-warning/45"} rounded-lg pl-3 pr-2.5 py-2.5 relative flex flex-col gap-2 overflow-hidden transition-all duration-300`}
    style={{
      boxShadow:
        alert.level === "Critical"
          ? undefined
          : "0 0 15px rgba(234, 179, 8, 0.05)",
    }}
  >
    <span
      aria-hidden
      className="absolute left-0 top-0 bottom-0 w-[3px]"
      style={{
        background:
          alert.level === "Critical"
            ? "linear-gradient(180deg,rgb(var(--c-critical)),rgb(var(--c-critical)/0.15))"
            : "linear-gradient(180deg,rgb(var(--c-warning)),rgb(var(--c-warning)/0.15))",
      }}
    />

    <div className="flex justify-between items-start gap-2">
      <div className="flex items-start gap-2 min-w-0">
        <Bell
          size={13}
          className={`mt-[2px] flex-shrink-0 ${
            alert.level === "Critical" ? "text-critical" : "text-warning"
          }`}
          fill={alert.level === "Critical" ? palette.critical : palette.warning}
          style={{
            filter:
              alert.level === "Critical"
                ? "drop-shadow(0 0 8px rgb(var(--c-critical)))"
                : "drop-shadow(0 0 8px rgb(var(--c-warning)))",
          }}
        />
        <span className="text-[12px] font-semibold leading-snug text-ink">
          {alert.title}
        </span>
      </div>
      <div className="flex items-center gap-0.5 text-[10px] text-ink-dim font-bold whitespace-nowrap flex-shrink-0 group-hover:text-ink-muted transition-colors">
        {alert.time}
        <ChevronRight size={11} />
      </div>
    </div>

    <div className="flex items-center gap-1.5">
      <span className="text-[#5b6f87] text-[9px] uppercase tracking-wider font-bold">
        Impact
      </span>
      <span
        className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-[1px] rounded border ${
          alert.level === "Critical"
            ? "text-[#ff8080] border-critical/30 bg-critical/10"
            : "text-warning border-warning/30 bg-warning/10"
        }`}
      >
        {alert.impact}
      </span>
    </div>

    <div
      className="mt-auto bg-indigo-700/[0.08] hover:bg-indigo-700/[0.14] border border-indigo-700/25 hover:border-indigo-700/45 rounded-md p-1.5 flex items-start gap-2 transition-colors cursor-default"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onRecHover({
          text: alert.rec,
          x: r.left + r.width / 2,
          y: r.top,
        });
      }}
      onMouseLeave={() => onRecHover(null)}
    >
      <div className="bg-indigo-600 w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]">
        <Bot size={11} />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span
          className="text-indigo-400 text-[9px] font-black uppercase tracking-wider"
          style={{ textShadow: "0 0 10px rgba(99,102,241,0.35)" }}
        >
          AI Recommendation
        </span>
        <span className="text-ink-secondary text-[10.5px] font-semibold leading-snug mt-0.5 line-clamp-2">
          {alert.rec}
        </span>
      </div>
    </div>
  </div>
);

export default AlertCard;
