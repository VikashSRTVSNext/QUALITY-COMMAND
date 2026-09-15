import { isNum } from "../../core/format";
import { CATEGORY_COLOR } from "./useProductDefects";
import type { SmtLogRow } from "./useSmtDefects";

const TH =
  "px-2.5 py-2 text-left text-[9.5px] font-black uppercase tracking-wider " +
  "text-ink-dim whitespace-nowrap sticky top-0 bg-panel z-10 border-b border-line";
const TD = "px-2.5 py-1.5 align-top";

/** Time only — the production day is in the modal header, and repeating it on
 *  every row costs width the two comment columns need more. */
const fmtTime = (iso: string | null) => (iso ? iso.slice(11, 19) : "—");

type Props = {
  rows: SmtLogRow[];
  /** Narrows to one board, client-side. Every board's records are already in the
   *  response, so picking one costs no request. */
  sfc: string | null;
  /** True when a server-side filter is on, so the empty state can say which kind
   *  of "nothing" this is. */
  filtered: boolean;
};

/**
 * The SMT defect log — the plant's OP_RES_NCLOG screen, column for column.
 *
 * One row per defect RECORD, not per board: a board that failed three ways is
 * three rows and one failed board. Distinct SFCs here equal the failed-board
 * count in the summary above, which is the reconciliation worth being able to
 * make by eye.
 *
 * The two comment columns come from two different records joined on SFC +
 * failure id + attempt, so either can be present without the other: `comment` is
 * what the operator wrote at the rework station, `failure_comments` is the
 * measurement that tripped the test. They are kept apart rather than merged
 * because only one of them is the machine's own evidence.
 */
export const SmtLogTable = ({ rows, sfc, filtered }: Props) => {
  const shown = sfc ? rows.filter((r) => r.sfc === sfc) : rows;

  if (shown.length === 0) {
    return (
      <div className="py-12 text-center text-[12px] font-bold text-ink-dim">
        {sfc
          ? `No defect records for board ${sfc}.`
          : filtered
            ? "No records match this filter."
            : "No defect records for this product on this day."}
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          <th className={`${TH} text-right`}>#</th>
          <th className={TH}>SFC</th>
          <th className={TH}>Time</th>
          <th className={`${TH} text-center`}>V</th>
          <th className={TH}>Failure ID</th>
          <th className={`${TH} text-center`}>NC</th>
          <th className={TH}>Ref des</th>
          <th className={TH}>Component</th>
          <th className={TH}>Resource</th>
          <th className={`${TH} text-center`}>T.P</th>
          <th className={TH}>Closed by</th>
          <th className={TH}>Comment</th>
          <th className={TH}>Failure comments</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-line/45 font-mono">
        {shown.map((r) => {
          const tone = r.category ? CATEGORY_COLOR[r.category] : undefined;
          return (
            <tr
              key={`${r.sfc}-${r.failure_id}-${r.times_processed}-${r.slno}`}
              className="hover:bg-white/[0.04]"
            >
              <td className={`${TD} text-right text-ink-dim tabular-nums`}>
                {r.slno}
              </td>
              <td className={`${TD} text-white font-bold whitespace-nowrap`}>
                {r.sfc}
              </td>
              <td className={`${TD} text-ink-muted tabular-nums whitespace-nowrap`}>
                {fmtTime(r.date_time)}
              </td>
              <td className={`${TD} text-center text-ink-dim`}>
                {r.verified_state ?? "—"}
              </td>
              <td className={`${TD} text-ink-secondary`}>
                {r.failure_id ?? "—"}
              </td>
              <td className={`${TD} text-center whitespace-nowrap`}>
                {r.nc ? (
                  <span
                    className="rounded px-1.5 py-0.5 border font-bold"
                    style={{
                      color: tone ?? "#8fa0b5",
                      borderColor: `${tone ?? "#8fa0b5"}55`,
                      backgroundColor: `${tone ?? "#8fa0b5"}14`,
                    }}
                    title={r.nc_description ?? r.nc}
                  >
                    {r.nc}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className={`${TD} text-white`}>{r.ref_des ?? "—"}</td>
              <td className={`${TD} text-ink-muted`}>{r.component ?? "—"}</td>
              <td className={`${TD} text-ink-muted whitespace-nowrap`}>
                {r.resource ?? "—"}
              </td>
              <td className={`${TD} text-center text-ink-dim tabular-nums`}>
                {isNum(r.times_processed) ? r.times_processed : "—"}
              </td>
              <td className={`${TD} text-ink-dim whitespace-nowrap`}>
                {r.nc_closed_by ?? "—"}
              </td>
              {/* Both comments wrap rather than truncate: the measurement text is
                  the evidence, and a clipped one is worse than a tall row. */}
              <td
                className={`${TD} text-ink-secondary min-w-[180px] max-w-[260px] whitespace-normal break-words`}
              >
                {r.comment ?? "—"}
              </td>
              <td
                className={`${TD} text-ink-dim min-w-[180px] max-w-[300px] whitespace-normal break-words`}
              >
                {r.failure_comments ?? "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default SmtLogTable;
