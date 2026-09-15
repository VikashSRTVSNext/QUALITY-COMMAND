import { isNum } from "../../core/format";
import TileSparkline from "./TileSparkline";
import { cardVerdict, getProcessTrendData } from "./metrics";
import { yieldTabForTile } from "./yieldTabs";

interface ProcessMetricCardProps {
  /** The matching entry from the feed's process_performance list. */
  item: any;
  /** Label shown on the tile, which is not always the feed's own name. */
  title: string;
  /** Shift selected in the header — decides which hourly buckets to plot. */
  activeShift: string;
  /** Called with the Product Yield tab this tile maps to (see yieldTabs.ts)
   *  when the tile is clicked. Tiles with no tab stay inert. */
  onDrill?: (card: { step: string; title: string }) => void;
}

// One Process Performance tile: value, hourly trend line and target.
//
// Clicking it selects the matching tab in the Product Yield panel. It stays
// clickable on "No production": switching a tab is cheap and the tab shows its
// own empty state, unlike the modal this used to open.
export const ProcessMetricCard = ({
  item,
  title,
  activeShift,
  onDrill,
}: ProcessMetricCardProps) => {
  const { color: cardColor, red: cardIsRed } = cardVerdict(item);
  const { points } = getProcessTrendData(item.trend, activeShift);

  const plotPoints = points;

  const hasNoProduction =
    item.status === "Not Run" || item.status === "N/A";

  const tabStep = yieldTabForTile(item.name);

  const canDrill = tabStep !== null && Boolean(onDrill);
  const openDrilldown = () => {
    if (tabStep !== null) onDrill?.({ step: tabStep, title });
  };

  return (
    <div
      className={`relative border rounded-lg p-1 2xl:p-2 pb-1 flex flex-col h-[112px] 2xl:h-[131px] transition-all duration-300 flex-1 min-w-0 ${
    cardIsRed ? "animate-border-pulse-critical" : ""
      } ${
    canDrill
      ? "cursor-pointer hover:brightness-125 focus-visible:outline-2 focus-visible:outline-tab-border"
      : ""
      }`}
      onClick={canDrill ? openDrilldown : undefined}
      role={canDrill ? "button" : undefined}
      tabIndex={canDrill ? 0 : undefined}
      aria-label={
    canDrill ? `${title} — open in Product Yield` : undefined
      }
      onKeyDown={
    canDrill
      ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDrilldown();
          }
        }
      : undefined
      }
      style={{
    background: `linear-gradient(180deg, ${cardColor}1f 0%, ${cardColor}0a 100%), rgb(var(--c-panel))`,
    borderColor: cardIsRed ? undefined : `${cardColor}40`,
    boxShadow: cardIsRed ? undefined : `0 4px 12px ${cardColor}15`,
      }}
    >
      <div className="flex items-start gap-1 mb-0.5 2xl:mb-1.5 flex-shrink-0">
    <item.icon
      size={10}
      className="text-white flex-shrink-0 mt-[1px] 2xl:size-[12px]"
    />
    <span
      className={`text-white font-bold uppercase leading-tight tracking-wider whitespace-nowrap ${
        title.length > 15
          ? "text-[7.5px] 2xl:text-[10px]"
          : "text-[9.5px] 2xl:text-[12px]"
      }`}
    >
      {title}
    </span>
      </div>

      <div className="flex-grow flex flex-col justify-center items-center min-h-0 -mt-1.5 2xl:-mt-2">
    {!hasNoProduction && (
      <span className="text-ink-muted text-[9px] 2xl:text-[11px] leading-none uppercase">
        {item.type === "yield" && "Yield %"}
        {item.type === "dpmo" && "Index"}
        {item.type === "failure" && "Failure %"}
      </span>
    )}
    {hasNoProduction ? (
      <span className="text-ink-muted text-[10px] 2xl:text-[12px] font-bold leading-tight text-center">
        No production
      </span>
    ) : (
      <span
        className="text-[16px] 2xl:text-[20px] font-black mt-1.5 2xl:mt-2 font-mono leading-none"
        style={{
          color: cardColor,
          textShadow: `0 0 8px ${cardColor}30`,
        }}
      >
        {item.type === "yield" && item.data.yield}
        {item.type === "dpmo" && item.data.index}
        {item.type === "failure" && item.data.failure}
      </span>
    )}
      </div>

      <div className="h-[22px] 2xl:h-[28px] w-full flex-shrink-0 mt-auto mb-1 2xl:mb-1.5 overflow-visible relative">
    <TileSparkline
      points={plotPoints}
      type={item.type}
      color={cardColor}
      target={item.target}
      targetDirection={item.targetDirection}
    />
      </div>

      {isNum(item.target) && (
    <span className="absolute bottom-1 right-1.5 2xl:right-2 text-ink-dim text-[7.5px] 2xl:text-[9px] font-bold leading-none pointer-events-none">
      Tgt {item.target}
      {item.targetUnit === "percent" ? "%" : ""}
    </span>
      )}
    </div>
  );
};

export default ProcessMetricCard;
