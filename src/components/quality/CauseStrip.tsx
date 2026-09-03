import { useMemo } from "react";
import { palette } from "../../theme/palette";
import StackedBarStrip from "../charts/StackedBarStrip.lazy";
import type { StripSegment } from "../charts/StackedBarStrip";
import { CATEGORY_COLOR } from "./useProductDefects";
import type { ProductTestersResponse } from "./useProductTesters";

type Props = {
  totals: ProductTestersResponse["totals"];
  /** Same signature as the tester table's, so a slice and a cell open the same
   *  log. */
  onDrill: (resource: string | null, category: string | null) => void;
};

/**
 * "Where the failed units went" — the level-2 summary, in one row of pixels.
 *
 * The same numbers as the cause columns in the tester table, read at a glance
 * instead of scanned across seven mostly-zero cells.
 *
 * Lives beside the table rather than inside it because it summarises the LEVEL,
 * not the table: the chart view shows the same strip above it, and a supervisor
 * switching views should not watch the summary disappear and come back.
 *
 * Built from `totals` and nothing else. Only the totals block holds DISTINCT
 * unit counts — summing the tester rows would count a unit once per machine it
 * ran, and a part-of-whole bar that overflows its own whole is worse than no bar.
 */
export const CauseStrip = ({ totals, onDrill }: Props) => {
  const failedUnits = totals.failed_units ?? totals.failed ?? 0;

  const segments: StripSegment[] = useMemo(() => {
    const out: StripSegment[] = totals.causes
      .filter((c) => (c.units ?? 0) > 0)
      .map((c) => ({
        key: c.code,
        label: c.label,
        value: c.units,
        color: CATEGORY_COLOR[c.code] ?? palette.inkMuted,
        onClick: () => onDrill(null, c.code),
        hint: `Open the NC log for ${c.label} across all testers`,
      }));

    const pending = totals.pending_units ?? 0;
    const undisposed = totals.undispositioned_units ?? 0;
    if (pending + undisposed > 0) {
      out.push({
        key: "__pending__",
        label: "Awaiting review",
        value: pending + undisposed,
        // Grey, NOT the amber the Pending column uses. In a cause breakdown this
        // slice is an absence of information rather than a warning, and an amber
        // slice beside a solid amber FCR would read as a second cause.
        color: palette.inkMuted,
        muted: true,
        onClick: () => onDrill(null, null),
        hint:
          `${pending} entered but not yet verified, ${undisposed} with nothing ` +
          `entered at all — open the full NC log`,
      });
    }

    const unmapped = totals.unmapped_units ?? 0;
    if (unmapped > 0) {
      out.push({
        key: "__unmapped__",
        label: "No category",
        value: unmapped,
        color: palette.lineSoft,
        muted: true,
        // No click: there is no filter for "unmapped" — the fix is in the NC code
        // master, not in this log.
        hint:
          "Verified, but the NC code carries no category in the master — a " +
          "master-data gap, not a review backlog",
      });
    }

    return out;
  }, [totals, onDrill]);

  if (failedUnits <= 0) return null;

  return (
    <div className="flex-shrink-0 px-6 pt-3 pb-3 border-b border-line/60 bg-page/25">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-ink-dim">
          Where the {failedUnits} failed unit{failedUnits === 1 ? "" : "s"} went
        </span>
        <span className="text-[10px] text-ink-dim/70 whitespace-nowrap">
          Distinct units, every tester · click a slice for its NC log
        </span>
      </div>
      <StackedBarStrip
        segments={segments}
        // The groups partition the failed units exactly, so the remainder slice
        // should never appear. It stays enabled as the tell if that stops being
        // true.
        total={failedUnits}
        remainderLabel="Unaccounted"
        unit="u"
        height={16}
        emptyLabel="No cause recorded for these failures yet."
        ariaLabel={`Failure cause breakdown for ${failedUnits} failed units`}
      />
    </div>
  );
};

export default CauseStrip;
