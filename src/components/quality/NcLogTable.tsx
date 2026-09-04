import { Camera, RefreshCw } from "lucide-react";
import { isNum } from "../../core/format";
import {
  CATEGORY_COLOR,
  type NcLogRow,
  type ProductDefectsQuery,
} from "./useProductDefects";
import type { UnitImages } from "./useUnitImages";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";

/** Time only. The date is in the modal header, and repeating it on every row
 *  costs width the failure comment needs more. */
const fmtTime = (iso: string | null) => (iso ? iso.slice(11, 19) : "—");

const TH =
  "px-2.5 py-2 text-left text-[9.5px] font-black uppercase tracking-wider " +
  "text-ink-dim whitespace-nowrap sticky top-0 bg-panel z-10 border-b border-line";
const TD = "px-2.5 py-1.5 align-top";

/**
 * The NC log — the deepest level of the process drill-down.
 *
 * One row per failure EVENT: the measurement that tripped the test, and what the
 * operator did about it. Assembled from the two records the plant's own report
 * joins — the failure at the test operation and the disposition at the rework
 * operation — so it reads row-for-row like the MES NC log screen.
 *
 * Extracted from the modal so the same table serves the whole product and a
 * single (tester, cause) cell without duplicating it.
 */
type Props = {
  query: ProductDefectsQuery;
  /** The plant's NC log screen has these two controls, so this one does too —
   *  they are the whole reason our row count differs from theirs. */
  firstAttemptOnly: boolean;
  onFirstAttemptOnly: (v: boolean) => void;
  verifiedOnly: boolean;
  onVerifiedOnly: (v: boolean) => void;
  /**
   * sfc -> what the inspection cell photographed, for the whole product and day.
   *
   * Passed in whole rather than fetched per row: it is one request for the
   * product, so badging every row costs nothing extra.
   *
   * MOST ROWS WILL NOT BE IN IT, and that is expected rather than a gap. The
   * cell's idea of a failure and the NC log's are unrelated — a unit can fail
   * here and never be photographed, and the units the camera did reject are
   * usually recorded by MES as clean passes. Absent = no badge, nothing more.
   */
  images?: Record<string, UnitImages>;
  /** Open the viewer for one unit. Omitted = badges render but do not click. */
  onOpenImages?: (sfc: string) => void;
};

const TOGGLE_ON =
  "bg-tab-active text-white border-tab-border/50";
const TOGGLE_OFF = "bg-page text-ink-dim border-line hover:bg-line";

export const NcLogTable = ({
  query,
  firstAttemptOnly,
  onFirstAttemptOnly,
  verifiedOnly,
  onVerifiedOnly,
  images,
  onOpenImages,
}: Props) => {
  const { data, state, error } = query;
  const parent = data?.parent;
  // Only the categories that occurred. Seven always-present columns of mostly
  // 0.00% is the plant report's format; it is not a useful summary here.
  const active = (data?.categories ?? []).filter((c) => c.units > 0);
  const filtered = Boolean(data?.filter?.resource || data?.filter?.category);

  if (state === "loading") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
        Loading NC log…
      </div>
    );
  }

  // 501: the step has no verified rework mapping, so its dispositions cannot be
  // located. Held apart from an error and from an empty log, both of which would
  // mislead here.
  if (state === "unsupported") {
    return (
      <div className="py-16 px-8 text-center">
        <div className="text-[12px] font-bold text-warning mb-1.5">
          No NC log available for this step
        </div>
        <div className="text-[11px] text-ink-dim max-w-[60ch] mx-auto leading-relaxed">
          {error}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-critical">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      {/* ---- cause summary. Always the PRODUCT's figures, even when the rows
              below are filtered to one tester — otherwise the denominators the
              slice is measured against would move with the filter. ---- */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-line-modal flex-shrink-0 bg-page/40">
        {active.length === 0 && (
          <span className="text-[11px] font-bold text-ink-dim">
            No dispositioned failures
          </span>
        )}
        {active.map((c) => (
          <span
            key={c.code}
            className="flex items-baseline gap-1.5 rounded-md border px-2.5 py-1"
            style={{
              borderColor: `${CATEGORY_COLOR[c.code] ?? "#8fa0b5"}55`,
              backgroundColor: `${CATEGORY_COLOR[c.code] ?? "#8fa0b5"}14`,
            }}
            title={`${c.units} unit(s) dispositioned as ${c.label}, as a share of the ${parent?.done ?? 0} units started. Product-wide, not affected by any filter below.`}
          >
            <span
              className="text-[10px] font-black uppercase tracking-wider"
              style={{ color: CATEGORY_COLOR[c.code] ?? "#8fa0b5" }}
            >
              {c.label}
            </span>
            <span className="text-[12px] font-mono font-bold text-white tabular-nums">
              {fmtPct(c.pct_of_done)}
            </span>
            <span className="text-[10px] font-bold text-ink-dim">{c.units}u</span>
          </span>
        ))}

        {/* Read this first. Dispositions are typed in by hand after the failure,
            so an open one carries no category — which is why the percentages can
            sum to less than the failure rate. */}
        {data.undispositioned.events > 0 && (
          <span
            className="flex items-baseline gap-1.5 rounded-md border border-info/40 bg-info/10 px-2.5 py-1"
            title="Failures with no disposition entered yet. The reason is typed in minutes to hours after the failure, so the category split is incomplete until these are closed."
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-info">
              Awaiting reason
            </span>
            <span className="text-[12px] font-mono font-bold text-white tabular-nums">
              {data.undispositioned.units}u
            </span>
          </span>
        )}

        {data.uncategorised.length > 0 && (
          <span
            className="text-[10px] font-bold text-ink-dim"
            title={data.uncategorised
              .map((u) => `${u.nc}: ${u.units} unit(s)`)
              .join(", ")}
          >
            + {data.uncategorised.length} NC code(s) with no category in the master
          </span>
        )}

        {data.carried_over.events > 0 && (
          <span
            className="text-[10px] font-bold text-ink-dim"
            title="Rework happening today on units whose first pass was on an earlier day. Excluded from the percentages, which describe this day's first-pass failures only."
          >
            {data.carried_over.units} unit(s) carried over from an earlier day
          </span>
        )}

        {/* The plant's two filters. Both OFF by default here, deliberately: their
            screen hides later attempts and unverified records, which makes its log
            shorter than the floor actually is. Turn both on to reconcile
            row-for-row with the MES portal. */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-ink-dim">
            {data.selection.units}u · {data.selection.events} events
          </span>
          <button
            type="button"
            onClick={() => onFirstAttemptOnly(!firstAttemptOnly)}
            className={`border text-[9.5px] font-bold px-2 py-0.5 rounded uppercase transition-colors cursor-pointer ${
              firstAttemptOnly ? TOGGLE_ON : TOGGLE_OFF
            }`}
            title="Show only first attempts (T.P = 1), as the plant's screen does by default"
          >
            T.P 1
          </button>
          <button
            type="button"
            onClick={() => onVerifiedOnly(!verifiedOnly)}
            className={`border text-[9.5px] font-bold px-2 py-0.5 rounded uppercase transition-colors cursor-pointer ${
              verifiedOnly ? TOGGLE_ON : TOGGLE_OFF
            }`}
            title="Show only verified records (V.STATE = V), as the plant's screen does. An unverified row is a real failure awaiting sign-off."
          >
            Verified
          </button>
        </div>
      </div>

      {/* ---- the log ---- */}
      <div className="flex-1 overflow-auto">
        {data.nc_log.length === 0 ? (
          <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
            {filtered
              ? "No failure events match this selection."
              : `No failures for this product on ${data.business_date}.`}
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr>
                <th className={TH}>#</th>
                <th className={TH}>SFC</th>
                <th className={TH}>Time</th>
                <th className={TH} title="Verified state">
                  V.St
                </th>
                <th className={TH}>Failure ID</th>
                <th className={TH}>NC</th>
                <th className={TH}>Category</th>
                <th className={TH} title="Times processed — the attempt number">
                  T.P
                </th>
                <th className={TH}>Ref Des</th>
                <th className={TH}>Resource</th>
                <th className={TH}>Closed By</th>
                <th className={TH}>Action Taken</th>
                <th className={TH}>Failure Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/45">
              {data.nc_log.map((r: NcLogRow) => {
                const colour = r.category
                  ? (CATEGORY_COLOR[r.category] ?? "#8fa0b5")
                  : null;
                // Listed for parity with the MES portal, dimmed because it is not
                // part of today's first-pass yield and so not in the percentages.
                const carried = !r.first_pass_unit;
                // A unit can appear on many rows (one per failure event) but has
                // one set of captures, so this is looked up per row and rendered
                // per row -- the badge repeats with the serial, which is right:
                // it belongs to the unit, not to the event.
                const shot = images?.[r.sfc];
                return (
                  <tr
                    key={r.slno}
                    className={`hover:bg-white/[0.03] ${carried ? "opacity-55" : ""}`}
                  >
                    <td className={`${TD} text-ink-dim tabular-nums`}>{r.slno}</td>
                    <td className={`${TD} text-white font-bold`}>
                      {r.sfc}
                      {carried && (
                        <span
                          className="ml-1.5 text-[8.5px] font-black uppercase tracking-wider text-ink-dim border border-line-strong rounded px-1 py-px align-middle"
                          title="First pass was on an earlier day — rework carried over. Excluded from this day's percentages."
                        >
                          prev day
                        </span>
                      )}
                      {/* Only where the cell actually photographed this unit.
                          No badge is the common case on some products and does
                          NOT mean the image is missing — many units are never
                          imaged at all. A placeholder on every row would read
                          as "images should be here", which is wrong. */}
                      {shot && (
                        <button
                          type="button"
                          onClick={() => onOpenImages?.(r.sfc)}
                          disabled={!onOpenImages}
                          className={`ml-1.5 inline-flex items-center gap-1 align-middle border rounded px-1 py-px transition-colors ${
                            shot.retries > 0
                              ? "text-warning border-warning/40 hover:bg-warning/10"
                              : "text-info border-info/40 hover:bg-info/10"
                          } ${onOpenImages ? "cursor-pointer" : "cursor-default"}`}
                          title={
                            shot.retries > 0
                              ? `${shot.attempts} captures — the camera rejected this unit ` +
                                `${shot.retries} time(s) before accepting it. That is a ` +
                                `re-image, NOT a failed test: MES records these as passes.`
                              : `${shot.attempts} capture(s) from the inspection cell.`
                          }
                        >
                          <Camera size={9} />
                          {shot.retries > 0 && (
                            <>
                              <RefreshCw size={8} />
                              <span className="text-[8.5px] font-black tabular-nums">
                                {shot.retries}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    <td className={`${TD} text-ink-muted tabular-nums`}>
                      {fmtTime(r.date_time)}
                    </td>
                    {/* Amber for anything not yet verified. This column used to
                        be flat grey, which was fine while the log was only ever
                        reached from a cause cell -- every row was V by
                        construction. It is now also reached from the Pending
                        column, where the whole point is which rows are NOT V. */}
                    <td
                      className={`${TD} ${
                        r.verified_state === "V"
                          ? "text-ink-dim"
                          : "text-warning font-bold"
                      }`}
                      title={
                        r.verified_state === "V"
                          ? "Verified — counted in the cause columns"
                          : "Not yet verified — a real failure awaiting sign-off, so it is counted in Failed but not in any cause column"
                      }
                    >
                      {r.verified_state ?? "—"}
                    </td>
                    <td className={`${TD} text-ink-secondary`}>
                      {r.failure_id ?? "—"}
                    </td>
                    <td
                      className={`${TD} font-bold`}
                      style={{ color: colour ?? undefined }}
                      title={r.nc_description ?? undefined}
                    >
                      {r.nc ?? "—"}
                    </td>
                    <td className={TD}>
                      {r.category ? (
                        <span
                          className="text-[9.5px] font-black uppercase tracking-wider rounded px-1.5 py-0.5 border"
                          style={{
                            color: colour ?? undefined,
                            borderColor: `${colour}55`,
                            backgroundColor: `${colour}14`,
                          }}
                        >
                          {r.category}
                        </span>
                      ) : (
                        <span
                          className="text-[9.5px] font-bold text-ink-dim"
                          title={
                            r.comment
                              ? "This NC code has no category in the NC master"
                              : "No disposition entered yet"
                          }
                        >
                          {r.comment ? "unmapped" : "open"}
                        </span>
                      )}
                    </td>
                    {/* An attempt above 1 means the unit came back. Emphasised,
                        because a repeat is the signal worth chasing. */}
                    <td
                      className={`${TD} tabular-nums ${
                        (r.times_processed ?? 1) > 1
                          ? "text-warning font-bold"
                          : "text-ink-dim"
                      }`}
                    >
                      {r.times_processed ?? "—"}
                    </td>
                    <td className={`${TD} text-ink-secondary`}>
                      {r.ref_des ?? "—"}
                    </td>
                    <td className={`${TD} text-ink-muted`}>{r.resource ?? "—"}</td>
                    <td className={`${TD} text-ink-dim`}>
                      {r.nc_closed_by ?? "—"}
                    </td>
                    <td className={`${TD} text-ink-secondary font-sans`}>
                      {r.comment ?? (
                        <span className="text-ink-dim italic">not yet entered</span>
                      )}
                    </td>
                    {/* The raw measurement, unformatted on purpose: it is the
                        tester's own string and an engineer reads it as-is. */}
                    <td className={`${TD} text-ink-dim whitespace-pre-wrap`}>
                      {r.failure_comments ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- footer: what the two grains mean ---- */}
      {data.nc_log.length > 0 && (
        <div className="flex-shrink-0 px-6 py-2.5 border-t border-line-modal bg-page/40 text-[10px] text-ink-dim leading-relaxed">
          {filtered ? (
            <>
              {data.selection.events} event(s) across {data.selection.units} unit(s)
              in this selection, out of{" "}
              {data.nc_log_events + data.carried_over.events} for the whole product.
              A cause cell counts units; this list shows their events.
            </>
          ) : (
            <>
              {data.nc_log.length} event(s) listed, matching the MES portal.{" "}
              {data.nc_log_events} of them belong to this day&apos;s{" "}
              {parent?.failed ?? 0} first-pass failure(s) and drive the percentages
              above
              {data.carried_over.events > 0 && (
                <>
                  ; the other {data.carried_over.events} are rework on{" "}
                  {data.carried_over.units} unit(s) whose first pass was earlier,
                  marked <span className="text-ink-muted">prev day</span>
                </>
              )}
              .
            </>
          )}{" "}
          One unit failing several measurements, or coming back for a retest,
          produces several rows — so events exceed units, and the two are not meant
          to match.
          <span className="text-ink-dim/70">
            {" "}
            Test {data.operations.test.join(", ")} · rework{" "}
            {data.operations.rework.join(", ")}.
          </span>
        </div>
      )}
    </>
  );
};

export default NcLogTable;
