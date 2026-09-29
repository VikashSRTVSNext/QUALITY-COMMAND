import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";
import type { DateRange } from "./dashboardFilters";

/**
 * Which screw positions failed at one station — level three of the card.
 *
 * The position is NOT `ref_des`. That column is empty on every screw row in
 * Bronze, so the `by_ref_des` cut the SMT drill-down renders has no equivalent
 * here; the backend derives the position from `failure_id` instead and returns
 * the raw id beside it so the mapping can be checked rather than trusted. See
 * the note above `_SCREW_POSITIONS_SQL` in the backend for the derivation.
 */

export type ScrewPositionRow = {
  /** 1-based, in board order. 1..parent.no_of_screws. */
  position: number;
  /**
   * Failed SCREWS at this position. THE figure to read: summing it over every
   * position reproduces the station's `fail_count` exactly, which is what makes
   * this level reconcile with the table above it.
   */
  screws: number;
  /** Distinct boards involved. Lower than `screws` only when one board failed
   *  the same position twice, which the pairing already collapses — so these two
   *  are usually equal and diverging is worth a look. */
  boards: number;
  /** Check failures. The LARGEST of the three: one screw can fail both the
   *  torque and the angle check, and that is two records for one screw. */
  records: number;
  torque_fails: number;
  angle_fails: number;
  /** The raw failure_ids behind the derived position — the audit trail for the
   *  encoding. A position maps to at most two: one odd, one even. */
  failure_ids: number[];
  /** Failed screws over BOARDS DRIVEN, not over total screws: this position is
   *  driven once per board, so the board count is its denominator. */
  fail_pct: number | null;
};

export type ScrewLogRow = {
  slno: number;
  /** Board serial. */
  sfc: string;
  position: number | null;
  /** Carried so the derived position is auditable from the row itself. */
  failure_id: number;
  nc: string | null;
  /** TORQUE or ANGLE — the check that tripped, from the failure_id's parity. */
  check: string;
  /** What the driver actually reached. 0 means the screw never bit; a value just
   *  under the limit is a different fault with a different fix. */
  achieved: number | null;
  item: string | null;
  resource: string | null;
  date_time: string | null;
  comment: string | null;
};

export type ScrewPositionsResponse = {
  step: string;
  business_date: string;
  window: { from: string; to: string };
  line: string;
  operation: string;
  item: string | null;
  /** The station's own row from the breakdown statement, so this level and the
   *  table behind it cannot disagree. */
  parent: {
    boards: number | null;
    /** Screws on the board at this station, from Screw Master.xlsx. The number
     *  of positions that EXIST, against which the failed ones are read. */
    no_of_screws: number | null;
    total_screws: number | null;
    fail_count: number | null;
    products: { item: string | null; product_name: string | null }[];
  };
  /** Worst first. Not in board order — re-sort before rendering a position map. */
  positions: ScrewPositionRow[];
  by_check: { torque_fails: number; angle_fails: number };
  screws_failed: number;
  boards_affected: number;
  records: number;
  max_position: number | null;
  /**
   * The derivation ran past the master's screw count. Either the sheet is stale
   * for this item or the encoding does not hold here — surfaced rather than
   * clamped, because a silently wrong position map points maintenance at the
   * wrong spindle.
   */
  position_exceeds_master: boolean;
  log: ScrewLogRow[];
};

export type ScrewPositionsQuery = {
  line: string;
  operation: string;
  /** Null pools every product run at the station. */
  item?: string | null;
  businessDate?: string | null;
  /** Production-day range. When set it REPLACES businessDate -- the endpoint
   *  ignores the single day once date_from/date_to are given. */
  range?: DateRange | null;
};

export const useScrewPositions = ({
  line,
  operation,
  item,
  businessDate,
  range = null,
}: ScrewPositionsQuery) => {
  const [data, setData] = useState<ScrewPositionsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPositions = async () => {
      try {
        const params = new URLSearchParams({ line, operation });
        if (item) params.set("item", item);
        if (businessDate) params.set("business_date", businessDate);
        // Sent after the single day on purpose: the endpoint ignores
        // business_date once either of these is present, so a range always wins.
        if (range?.from) params.set("date_from", range.from);
        if (range?.to) params.set("date_to", range.to);

        const res = await fetch(
          apiUrl(`/process/screw-defects/positions?${params.toString()}`),
        );
        // 404 is a real answer here — nothing ran at this station on this day —
        // and the endpoint says so in `detail`. Surfacing that beats a generic
        // failure message, which would read as a broken request.
        if (res.status === 404) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.detail ?? "No screws driven at this station on this day.",
          );
        }
        if (!res.ok) throw new Error("Failed to fetch screw positions");

        const json: ScrewPositionsResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching screw positions:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load the screw positions.",
        );
        setState("error");
      }
    };

    setState("loading");
    fetchPositions();
    return () => {
      cancelled = true;
    };
  }, [line, operation, item, businessDate, range?.from, range?.to]);

  return { data, state, error };
};

export default useScrewPositions;
