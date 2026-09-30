import { rangeDayCount, type DateRange } from "./dashboardFilters";

/** How the defect cuts in a drill-down are drawn. */
export type ChartView = "bars" | "pareto";

/**
 * Is a Pareto worth offering for this window?
 *
 * Only once the range covers more than one production day. A Pareto is a claim
 * about which categories dominate, and one shift's worth of defects is usually
 * too few to make that claim honestly — the ranking is mostly which fault
 * happened to occur twice. Over several days the shape settles into something
 * worth acting on.
 *
 * This is also why the toggle disappears rather than greying out: on a single
 * day there is nothing to reveal, and a permanently disabled control just raises
 * a question it cannot answer.
 */
export const paretoAvailable = (range: DateRange | null | undefined): boolean =>
  !!range && (rangeDayCount(range) ?? 0) >= 2;

const BTN =
  "text-[9.5px] font-black uppercase tracking-wider px-2 py-[3px] rounded transition-colors cursor-pointer outline-none";

/**
 * Bars / Pareto switch for a drill-down's defect cuts.
 *
 * ONE control for the whole modal, not one per cut. The cuts are the same
 * defects sliced different ways, so viewing NC code as a Pareto while ref des
 * stayed a bar list would invite comparing two charts that are not asking the
 * same question.
 */
export const ChartViewToggle = ({
  value,
  onChange,
  days,
}: {
  value: ChartView;
  onChange: (next: ChartView) => void;
  /** Production days in the window, named in the tooltip so the reader knows
   *  what the Pareto is accumulating over. */
  days?: number | null;
}) => (
  <div className="flex items-center gap-0.5 rounded border border-line bg-page/50 p-[2px]">
    {(
      [
        ["bars", "Bars", "Ranked by count — who contributed most"],
        [
          "pareto",
          "Pareto",
          `Ranked by count with the cumulative share over it${
            days ? `, across ${days} production days` : ""
          } — how few categories account for 80%`,
        ],
      ] as [ChartView, string, string][]
    ).map(([key, label, title]) => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        title={title}
        className={`${BTN} ${
          value === key
            ? "bg-tab-active text-white"
            : "text-ink-dim hover:text-white"
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

export default ChartViewToggle;
