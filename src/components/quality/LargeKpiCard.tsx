import { isNum } from "../../core/format";
import { palette } from "../../theme/palette";
import MetricSparkline from "./MetricSparkline";
import { getKpiIcon } from "./kpiIcons";
import { GRADE_CSS, kpiCardGrade } from "./metrics";

interface LargeKpiCardProps {
  /** The matching entry from the feed's kpiCards list. */
  item: any;
  title: string;
  /** Card 9 (UNIT-HFTPY) shows a projection beside the current value. True when
   *  the feed reports that projection as a fixed constant rather than a computed
   *  forecast, which the tooltip then says out loud. */
  projectionIsHardcoded?: boolean;
}

// One of the two headline KPI cards in the right-hand panel.
//
// Card 9 (UNIT-HFTPY) is laid out differently from the rest: current value and
// projection side by side, and no sparkline, because the projection occupies the
// space the trend line would use.
export const LargeKpiCard = ({
  item,
  title,
  projectionIsHardcoded,
}: LargeKpiCardProps) => {
  const target = (item as any).target as number | null | undefined;

  const kpiGrade = kpiCardGrade(item);
  const trendColor =
    kpiGrade === "unknown"
      ? item.color || palette.inkMuted
      : GRADE_CSS[kpiGrade];

  const deltaColor = palette.inkMuted;

  return (
    <div
      className="flex-1 bg-[#0b131e] border rounded-xl p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{
        boxShadow: `0 4px 12px ${trendColor}10`,
        borderColor: `${trendColor}30`,
      }}
    >
      <div className="flex items-center gap-2 z-10">
        {getKpiIcon(item.id, trendColor, 15)}
        <span className="text-white text-[11px] 2xl:text-[13px] uppercase font-black tracking-wider leading-tight">
          {title}
        </span>
      </div>

      <div className="flex-grow flex flex-col justify-center mt-2 z-10 mb-4">
        {item.id === 9 ? (
          <div className="flex items-baseline gap-2 justify-between">
            <span
              className="text-[26px] 2xl:text-[32px] font-black font-mono leading-none"
              style={{
                color: trendColor,
                textShadow: `0 0 8px ${trendColor}40`,
              }}
            >
              {item.value}
            </span>
            <span className="text-ink-muted text-[9.5px] font-bold uppercase leading-none">
              Cur
            </span>
            <span
              className="text-[#3fd3c6] text-[18px] 2xl:text-[22px] font-black font-mono ml-auto leading-none"
              style={{ textShadow: `0 0 6px rgba(63,211,198,0.3)` }}
              title={
                projectionIsHardcoded
                  ? "Projection is a fixed constant, not a computed forecast"
                  : undefined
              }
            >
              {item.projectedValue || "—"}
            </span>
            <span className="text-ink-muted text-[9.5px] font-bold uppercase leading-none">
              Proj
            </span>
          </div>
        ) : (
          <span
            className="text-[30px] 2xl:text-[36px] font-black font-mono leading-none"
            style={{
              color: trendColor,
              textShadow: `0 0 8px ${trendColor}40`,
            }}
          >
            {item.value}
          </span>
        )}

        <div className="flex items-baseline gap-1.5 mt-1.5">
          <span
            className="text-[11px] 2xl:text-[12.5px] font-bold"
            style={{ color: deltaColor }}
          >
            {item.change}
          </span>
          {isNum(target) && (
            <span className="text-ink-dim text-[9.5px] 2xl:text-[11px] font-bold ml-auto whitespace-nowrap">
              Tgt {target}%
            </span>
          )}
        </div>
      </div>

      <div className="absolute bottom-[2px] left-0 right-0 h-[22px] pointer-events-none opacity-85">
        {item.id !== 9 && (
          <MetricSparkline
            points={item.points}
            yesterdayPoints={item.yesterdayPoints}
            stroke={trendColor}
            target={target}
          />
        )}
      </div>
    </div>
  );
};

export default LargeKpiCard;
