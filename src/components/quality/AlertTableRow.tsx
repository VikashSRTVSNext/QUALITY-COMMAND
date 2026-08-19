import { Bot } from "lucide-react";
import { palette } from "../../theme/palette";

// One alert as a row in the full-list modal: severity pill, title, impact, age
// and the AI recommendation in full (the panel card truncates it to two lines).
export const AlertTableRow = ({ alert }: { alert: any }) => {
  const isCritical = alert.level === "Critical";
  const tone = isCritical
    ? palette.critical
    : palette.warning;
  return (
    <tr
        className="hover:bg-raised/40 transition-colors align-top"
    >
      <td className="py-2.5 pr-3 whitespace-nowrap">
        <span
          className="text-[9.5px] font-black uppercase tracking-wider px-1.5 py-[2px] rounded border inline-flex items-center gap-1.5"
          style={{
            color: tone,
            borderColor: `${tone}4d`,
            backgroundColor: `${tone}1a`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: tone,
              boxShadow: `0 0 6px ${tone}`,
            }}
          />
          {alert.level}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-[11.5px] font-semibold text-ink leading-snug min-w-[220px]">
        {alert.title}
      </td>
      <td className="py-2.5 pr-3 text-center text-[10px] font-bold text-ink-muted whitespace-nowrap">
        {alert.impact}
      </td>
      <td className="py-2.5 pr-3 text-right text-[10px] font-bold text-ink-dim whitespace-nowrap font-mono">
        {alert.time}
      </td>
      <td className="py-2.5 text-[11px] text-[#c3cdda] font-medium leading-snug min-w-[280px]">
        <div className="flex items-start gap-1.5">
          <Bot
            size={11}
            className="text-indigo-400 mt-[2px] flex-shrink-0"
          />
          <span>{alert.rec}</span>
        </div>
      </td>
    </tr>
  );
};

export default AlertTableRow;
