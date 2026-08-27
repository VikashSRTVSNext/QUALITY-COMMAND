import { Fragment } from "react";
import { isNum } from "../../core/format";
import { CATEGORY_COLOR } from "./useProductDefects";
import type { CauseCell, TesterRow, ProductTestersResponse } from "./useProductTesters";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";
const fmtNum = (v: number | null | undefined) => (isNum(v) ? String(v) : "—");

const TH =
  "px-2 py-2 text-[9.5px] font-black uppercase tracking-wider text-ink-dim " +
  "whitespace-nowrap sticky top-0 bg-panel z-10 border-b border-line";
const TD = "px-2 py-1.5 whitespace-nowrap";

/** Yield colouring, same 5-point band the rest of the dashboard uses against a
 *  100% expectation: a tester at 91% is a genuine miss, not a near one. */
const yieldColour = (pct: number | null) => {
  if (!isNum(pct)) return undefined;
  if (pct >= 100) return "#22c55e";
  if (pct >= 95) return "#eab308";
  return "#ff4c4c";
};

type Props = {
  data: ProductTestersResponse;
  /** Opens the NC log for one tester, optionally narrowed to one cause. */
  onDrill: (resource: string | null, category: string | null) => void;
};

/**
 * Per-tester yield and failure cause for one product — the middle level.
 *
 * Mirrors the plant's "ONLINE TESTER [RESOURCE] YIELD REPORT": one row per
 * tester, day figures plus an A/B/C shift split, then the failure-cause columns.
 * The yield half is verified cell-for-cell against that screen.
 *
 * Every cell is a way in. Clicking a tester opens its whole NC log; clicking a
 * cause cell opens just that cause's units. That matters more than usual here,
 * because the cause rule is still being confirmed against the plant's report — a
 * percentage you can open and count is checkable even while the rule is not
 * settled.
 */
export const TesterYieldTable = ({ data, onDrill }: Props) => {
  const { testers, totals } = data;
  // The columns the plant's report shows, in its order. Rendered even when empty
  // so the table lines up with the report a supervisor is comparing against.
  const causeCodes: CauseCell[] = totals.causes;

  // Failed units still waiting on an operator's verification.
  //
  // Its own column, OUTSIDE the "Failure cause" group, because it is not a cause
  // -- it is the reason the cause columns can be short. Cause counts are
  // verified-only, and that review lands a median of 28 minutes after the test
  // (p90 ~3 hours), so MES shows a failure well before it can appear above. A
  // blank breakdown reads as a broken dashboard; "3 pending" reads as the floor
  // still working.
  const pendingCell = (row: TesterRow | null) => {
    const totalsPending = totals.pending_units ?? 0;
    const units = row ? row.pending_units ?? 0 : totalsPending;
    const undisposed = row
      ? row.undispositioned_units ?? 0
      : totals.undispositioned_units ?? 0;
    const waiting = units + undisposed;

    if (waiting === 0) {
      // Everything reviewed. Flat grey, never green: a completed review is the
      // normal state, not an achievement.
      return (
        <td
          className={`${TD} text-center text-ink-dim/50 tabular-nums border-l border-line/60`}
          title="Every failure here has been reviewed"
        >
          —
        </td>
      );
    }
    const colour = "#eab308";
    return (
      <td className={`${TD} text-center tabular-nums border-l border-line/60`}>
        <button
          type="button"
          onClick={() => onDrill(row?.resource ?? null, null)}
          className="rounded px-1.5 py-0.5 border font-bold hover:brightness-125 focus-visible:outline focus-visible:outline-1 cursor-pointer"
          style={{
            color: colour,
            borderColor: `${colour}55`,
            backgroundColor: `${colour}14`,
          }}
          title={
            `${waiting} failed unit(s) awaiting review` +
            (undisposed ? ` (${undisposed} with nothing entered yet)` : "") +
            ` — open the NC log${row ? ` for ${row.resource}` : ""}`
          }
        >
          {waiting}u
        </button>
      </td>
    );
  };

  const causeCell = (row: TesterRow | null, code: string) => {
    const source = row ? row.causes : totals.causes;
    const cell = source.find((c) => c.code === code);
    const units = cell?.units ?? 0;
    const colour = CATEGORY_COLOR[code] ?? "#8fa0b5";
    if (units === 0) {
      // Zero is rendered flat and grey, never coloured: a red 0.00% reads as a
      // problem, and most of these columns are structurally zero for a given step
      // (RTWP rework only ever raises FCR, SQA and MOD_REJ).
      return (
        <td key={code} className={`${TD} text-center text-ink-dim/50 tabular-nums`}>
          0.00%
        </td>
      );
    }
    return (
      <td key={code} className={`${TD} text-center tabular-nums`}>
        <button
          type="button"
          onClick={() => onDrill(row?.resource ?? null, code)}
          className="rounded px-1.5 py-0.5 border font-bold hover:brightness-125 focus-visible:outline focus-visible:outline-1 cursor-pointer"
          style={{
            color: colour,
            borderColor: `${colour}55`,
            backgroundColor: `${colour}14`,
          }}
          title={`${units} unit(s) — open the NC log for ${cell?.label ?? code}${
            row ? ` on ${row.resource}` : " across all testers"
          }`}
        >
          {fmtPct(cell?.pct_of_tested)}
          <span className="text-ink-dim font-normal ml-1">{units}u</span>
        </button>
      </td>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className={`${TH} text-left`} rowSpan={2}>
                Resource
              </th>
              <th className={`${TH} text-center border-l border-line`} colSpan={4}>
                Day
              </th>
              {(["A", "B", "C"] as const).map((s) => (
                <th
                  key={s}
                  className={`${TH} text-center border-l border-line`}
                  colSpan={2}
                >
                  Shift {s}
                </th>
              ))}
              <th
                className={`${TH} text-center border-l border-line`}
                colSpan={causeCodes.length}
              >
                Failure cause
              </th>
              <th className={`${TH} text-center border-l border-line`}>
                Review
              </th>
            </tr>
            <tr>
              <th className={`${TH} text-right border-l border-line`}>Tested</th>
              <th className={`${TH} text-right`}>FTP</th>
              <th className={`${TH} text-right`}>Failed</th>
              <th className={`${TH} text-right`}>FTPY %</th>
              {(["A", "B", "C"] as const).map((s) => (
                <Fragment key={s}>
                  <th className={`${TH} text-right border-l border-line`}>
                    Tested
                  </th>
                  <th className={`${TH} text-right`}>FTPY</th>
                </Fragment>
              ))}
              {causeCodes.map((c, i) => (
                <th
                  key={c.code}
                  className={`${TH} text-center ${i === 0 ? "border-l border-line" : ""}`}
                  title={c.code}
                >
                  {c.label}
                </th>
              ))}
              <th
                className={`${TH} text-center border-l border-line`}
                title="Failed units with no verified disposition yet — these are counted by MES but cannot appear in a cause column until an operator signs them off"
              >
                Pending
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line/45 font-mono">
            {testers.map((t) => (
              <tr key={t.resource} className="hover:bg-white/[0.04]">
                <td className={`${TD} text-left`}>
                  <button
                    type="button"
                    onClick={() => onDrill(t.resource, null)}
                    className="text-white font-bold hover:text-info focus-visible:outline focus-visible:outline-1 cursor-pointer"
                    title={`Open the whole NC log for ${t.resource}`}
                  >
                    {t.resource}
                  </button>
                </td>
                <td className={`${TD} text-right text-ink-muted tabular-nums border-l border-line/60`}>
                  {fmtNum(t.tested)}
                </td>
                <td className={`${TD} text-right text-ink-muted tabular-nums`}>
                  {fmtNum(t.ftp)}
                </td>
                <td
                  className={`${TD} text-right tabular-nums font-bold ${
                    (t.failed ?? 0) > 0 ? "text-critical" : "text-ink-dim"
                  }`}
                >
                  {fmtNum(t.failed)}
                </td>
                <td
                  className={`${TD} text-right tabular-nums font-black`}
                  style={{ color: yieldColour(t.ftpy_pct) }}
                >
                  {fmtPct(t.ftpy_pct)}
                </td>
                {(["A", "B", "C"] as const).map((s) => {
                  const f = t.shifts[s];
                  // A shift the tester did not run is dashed, not 0.00% — zero
                  // yield and no production must not look alike.
                  const idle = !f.tested;
                  return (
                    <Fragment key={s}>
                      <td
                        className={`${TD} text-right text-ink-muted tabular-nums border-l border-line/60`}
                      >
                        {idle ? "—" : fmtNum(f.tested)}
                      </td>
                      <td
                        className={`${TD} text-right tabular-nums`}
                        style={{ color: idle ? undefined : yieldColour(f.ftpy_pct) }}
                      >
                        {idle ? (
                          <span className="text-ink-dim/50">—</span>
                        ) : (
                          fmtPct(f.ftpy_pct)
                        )}
                      </td>
                    </Fragment>
                  );
                })}
                {causeCodes.map((c) => causeCell(t, c.code))}
                {pendingCell(t)}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-line-strong bg-page/60 font-mono">
              <td className={`${TD} text-left text-[10px] font-black uppercase tracking-wider text-ink-dim`}>
                Total
              </td>
              <td className={`${TD} text-right text-white font-bold tabular-nums border-l border-line/60`}>
                {fmtNum(totals.tested)}
              </td>
              <td className={`${TD} text-right text-white font-bold tabular-nums`}>
                {fmtNum(totals.ftp)}
              </td>
              <td
                className={`${TD} text-right tabular-nums font-bold ${
                  (totals.failed ?? 0) > 0 ? "text-critical" : "text-ink-dim"
                }`}
              >
                {fmtNum(totals.failed)}
              </td>
              <td
                className={`${TD} text-right tabular-nums font-black`}
                style={{ color: yieldColour(totals.ftpy_pct) }}
              >
                {fmtPct(totals.ftpy_pct)}
              </td>
              {/* Shift columns are left blank in the total row on purpose: the
                  plant's report totals the day only, and a per-shift total would
                  invite reading the three as a partition of it. */}
              <td className={`${TD} border-l border-line/60`} colSpan={6} />
              {causeCodes.map((c) => causeCell(null, c.code))}
              {pendingCell(null)}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex-shrink-0 px-6 py-2.5 border-t border-line-modal bg-page/40 text-[10px] text-ink-dim leading-relaxed">
        Click a resource for its whole NC log, or a cause cell for just those
        units.{" "}
        {/* Stated because the arithmetic looks wrong otherwise: the tester rows
            deliberately do not sum to the total. */}
        Per-tester cause counts do not sum to the total — a unit that ran three
        machines counts at each one but is a single unit for the product.
        {/* Split out rather than reported as one "no cause" number, because the
            two halves need different actions: a pending review resolves itself,
            an unmapped NC code needs someone to add it to the master. */}
        {(totals.pending_units ?? 0) + (totals.undispositioned_units ?? 0) > 0 ? (
          <>
            {" "}
            <span className="text-warning">
              {(totals.pending_units ?? 0) +
                (totals.undispositioned_units ?? 0)}{" "}
              of {totals.failed_units ?? totals.failed} failed unit(s) are still
              awaiting review
            </span>
            , so they are counted in Failed but not yet in any cause column. MES
            shows these immediately; a verified disposition follows a median of
            ~28 minutes later.
          </>
        ) : null}
        {/* Read straight from the server, NOT derived by subtracting from
            uncaused_units: that field is a SUM over testers (a unit that ran two
            machines counts twice) while these three are DISTINCT counts, so the
            subtraction mixed two different countings and could go negative. */}
        {(totals.unmapped_units ?? 0) > 0 ? (
          <>
            {" "}
            <span className="text-warning">
              {totals.unmapped_units} verified failure(s) carry an NC code with no
              category
            </span>
            , so they are missing from the columns above — that is a gap in the NC
            code master, not a pending review.
          </>
        ) : null}
        <span className="text-ink-dim/70"> Cause rule: {data.cause_rule}.</span>
      </div>
    </>
  );
};

export default TesterYieldTable;
