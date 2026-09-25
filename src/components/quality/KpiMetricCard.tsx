import { isNum } from "../../core/format";
import { palette } from "../../theme/palette";
import TileSparkline from "./TileSparkline";
import { getKpiIcon } from "./kpiIcons";
import { GRADE_CSS, kpiCardGrade } from "./metrics";

interface KpiMetricCardProps {
  /** The matching entry from the feed's kpiCards list. */
  item: any;
  title: string;
  /** What one trend point is: "hr" live, "day" under a date range. */
  bucketLabel?: string;
}

// A Process Performance slot filled from the KPI feed instead of the process
// feed — the FPY/SPY module and unit tiles, which the process payload does not
// carry. Shows a target and yesterday's delta, which process tiles do not.
//
// The trend line is TileSparkline, the same one the process tiles use, so every
// card in the strip hovers the same way: a marker on the nearest point, its
// value, and the distance from target. It used to be MetricSparkline, which
// draws the line but has no hover at all — so four cards in the middle of the
// row silently did nothing under the pointer.
//
// Nothing is lost in the swap. MetricSparkline's one extra feature is a faint
// dashed line for yesterday, and it draws that ONLY when there is no target to
// compare against — these four all carry one, so it was never being drawn here.
export const KpiMetricCard = ({
  item,
  title,
  bucketLabel,
}: KpiMetricCardProps) => {
  const target = (item as any).target as number | null | undefined;

  const kpiGrade = kpiCardGrade(item);
  const trendColor =
    kpiGrade === "unknown"
      ? item.color || palette.inkMuted
      : GRADE_CSS[kpiGrade];

  const deltaColor = palette.inkMuted;

  return (
    <div
      className="relative border rounded-lg p-1 2xl:p-2 pb-1 flex flex-col h-[112px] 2xl:h-[131px] transition-all duration-300 flex-1 min-w-0"
      style={{
        background: `linear-gradient(180deg, ${trendColor}1f 0%, ${trendColor}0a 100%), rgb(var(--c-panel))`,
        borderColor: `${trendColor}40`,
        boxShadow: `0 4px 12px ${trendColor}15`,
      }}
    >
      <div className="flex items-start gap-1 mb-0.5 2xl:mb-1.5 flex-shrink-0">
        {getKpiIcon(item.id, trendColor, 10)}
        <span className="text-white text-[9.5px] 2xl:text-[12px] uppercase font-bold tracking-wider leading-tight">
          {title}
        </span>
      </div>

      <div className="flex-grow flex flex-col justify-center items-center min-h-0 -mt-1.5 2xl:-mt-2">
        <span className="text-ink-muted text-[9px] 2xl:text-[11px] leading-none uppercase">
          Yield %
        </span>
        <span
          className="text-[16px] 2xl:text-[20px] font-black mt-1 font-mono leading-none"
          style={{
            color: trendColor,
            textShadow: `0 0 8px ${trendColor}40`,
          }}
        >
          {item.value}
        </span>
        <span
          className="text-[7.5px] 2xl:text-[9.5px] font-bold mt-1 leading-none"
          style={{ color: deltaColor }}
        >
          {item.change}
        </span>
      </div>

      {/* overflow-VISIBLE, matching the process tiles: the hover marker and
          its label sit slightly outside the line's box, and clipping them is
          what makes the hover look broken rather than absent. */}
      <div className="h-[22px] 2xl:h-[28px] w-full flex-shrink-0 mt-auto mb-1 2xl:mb-1.5 overflow-visible relative">
        {item.id !== 9 && (
          <TileSparkline
            points={item.points}
            // These four are all pass-rate percentages, so they read against
            // target the same way a process yield tile does.
            type="yield"
            bucketLabel={bucketLabel}
            color={trendColor}
            target={target}
            targetDirection="higher"
          />
        )}
      </div>

      {isNum(target) && (
        <span className="absolute bottom-1 right-1.5 2xl:right-2 text-ink-dim text-[7.5px] 2xl:text-[9px] font-bold leading-none pointer-events-none">
          Tgt {target}%
        </span>
      )}
    </div>
  );
};

export default KpiMetricCard;
