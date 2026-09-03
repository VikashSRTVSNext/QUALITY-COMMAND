/**
 * Categorical colours for chart series — identity, not status.
 *
 * Separate from `palette` on purpose. Those are STATUS colours (healthy /
 * warning / critical) and are reserved: reusing red for "tester 4" makes a
 * routine machine look like an alarm. These eight only ever answer "which one is
 * this", never "how is it doing".
 *
 * Validated as a set against this app's dark chart surface (#101c2b, the panel
 * behind every drill-down) on the adjacent-pair gates that stacked bars and
 * lines use:
 *
 *   lightness band     all 8 inside L 0.48-0.67
 *   chroma floor       all 8 >= 0.1
 *   CVD separation     worst adjacent pair dE 8.4 (protan), 8.7 (tritan)
 *   normal vision      worst adjacent pair dE 19.3
 *   contrast           all 8 >= 3:1 against the surface
 *
 * Two rules that keep that true, and are easy to break by accident:
 *
 *   1. The ORDER is the safety mechanism. It was chosen so that every
 *      NEIGHBOURING pair clears the gates — a chart with three series uses slots
 *      1-3, never 1, 4 and 7. Do not reorder to make a particular chart prettier.
 *   2. Never cycle. A ninth series is not `SERIES_COLORS[8 % 8]`; two series
 *      sharing a colour is worse than not drawing the ninth. Fold the tail into
 *      OTHER_COLOR instead, which is what `seriesColor` does.
 */
export const SERIES_COLORS = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
] as const;

/** The fold-to bucket, and the colour for anything unattributed. Deliberately
 *  the lowest-chroma thing on the chart: "Other" must never out-shout a series
 *  that has a name. */
export const OTHER_COLOR = "#64748b";

/** How many series can be drawn before the rest must be folded into "Other". */
export const MAX_SERIES = SERIES_COLORS.length;

/** Slot `i`, or the Other colour once the slots run out. Index by the series'
 *  STABLE position (its rank in a fixed ordering), never by its position after
 *  filtering — a filter that drops one tester must not repaint the others. */
export const seriesColor = (i: number): string =>
  i >= 0 && i < SERIES_COLORS.length ? SERIES_COLORS[i] : OTHER_COLOR;
