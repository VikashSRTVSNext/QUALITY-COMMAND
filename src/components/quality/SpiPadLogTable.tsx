import { isNum } from "../../core/format";
import type { SpiPadRow } from "./useSpiDefects";

const TH =
  "px-2 py-2 text-[9.5px] font-black uppercase tracking-wider text-ink-dim " +
  "whitespace-nowrap sticky top-0 bg-panel z-10 border-b border-line text-left";
const TD = "px-2 py-1.5 whitespace-nowrap align-top";

/** Bare numbers, no unit suffix. Volume, height and area read as percentages of
 *  the programmed target and the offsets as millimetres, but the source
 *  documents neither — so the UI states no unit until the SPI engineer does. */
const fmtNum = (v: number | null | undefined, digits = 2) =>
  isNum(v) ? v.toFixed(digits) : "—";

/** How far from nominal a measurement sits. 100 is the programmed target, so the
 *  interesting thing is the distance from it in either direction — over-printed
 *  and starved are both defects and neither is "better". */
const measureTone = (v: number | null) => {
  if (!isNum(v)) return undefined;
  const drift = Math.abs(v - 100);
  if (drift >= 50) return "#ff4c4c";
  if (drift >= 25) return "#eab308";
  return undefined;
};

type Props = {
  rows: SpiPadRow[];
  /** Narrows the rows to one board, client-side. Every board's pads are already
   *  in the payload, so this costs no request. */
  sfc: string | null;
  /** True when a server-side filter is on, so the empty state can say which kind
   *  of "nothing" this is. */
  filtered: boolean;
};

/**
 * The pad log — one row per inspected deposit of solder paste.
 *
 * The deepest level of the SPI drill-down, and the only place the machine's own
 * measurements appear. Everything above it counts pads; this says what was
 * actually wrong with each one.
 *
 * Cleared rows are kept and styled down rather than hidden. They are not in the
 * defect counts above, so dropping them would make the table agree with the
 * chart at the cost of hiding a pad an operator released by hand — which is
 * exactly what an engineer reading a failed board came to see.
 */
export const SpiPadLogTable = ({ rows, sfc, filtered }: Props) => {
  const shown = sfc ? rows.filter((r) => r.sfc === sfc) : rows;

  if (shown.length === 0) {
    return (
      <div className="py-12 text-center text-[12px] font-bold text-ink-dim">
        {sfc
          ? `No pads logged for board ${sfc}.`
          : filtered
            ? "No pads match this filter."
            : "No pads logged for these boards."}
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          <th className={`${TH} text-right`}>#</th>
          <th className={TH}>SFC</th>
          <th className={`${TH} text-center`}>Side</th>
          <th className={TH}>Machine</th>
          <th className={`${TH} text-right`}>Pad</th>
          <th className={TH}>Component</th>
          <th className={`${TH} text-center`}>Pin</th>
          <th className={TH}>Result</th>
          <th className={`${TH} text-right`}>Volume</th>
          <th className={`${TH} text-right`}>Height</th>
          <th className={`${TH} text-right`}>Area</th>
          <th className={`${TH} text-right`}>Off X</th>
          <th className={`${TH} text-right`}>Off Y</th>
          <th className={`${TH} text-right`}>Pos X</th>
          <th className={`${TH} text-right`}>Pos Y</th>
          <th className={`${TH} text-right`}>Pad size</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-line/45 font-mono">
        {shown.map((r) => (
          <tr
            key={`${r.sfc}-${r.pcb_side}-${r.pad_id}-${r.slno}`}
            // Released pads are dimmed as a whole row: they are in this table but
            // not in the counts above, and the row has to say so at a glance or
            // the two look like they disagree by mistake.
            className={`hover:bg-white/[0.04] ${
              r.cleared ? "opacity-45" : ""
            }`}
          >
            <td className={`${TD} text-right text-ink-dim tabular-nums`}>
              {r.slno}
            </td>
            <td className={`${TD} text-white font-bold`}>{r.sfc}</td>
            {/* No time column: a pad row carries no timestamp of its own. The
                board's inspection time is on its boards[] row above. */}
            <td className={`${TD} text-center text-ink-muted`}>
              {r.pcb_side ?? "—"}
            </td>
            <td className={`${TD} text-ink-muted`}>{r.tester_id ?? "—"}</td>
            <td className={`${TD} text-right text-ink-muted tabular-nums`}>
              {r.pad_id ?? "—"}
            </td>
            <td className={`${TD} text-white`}>{r.component ?? "—"}</td>
            <td className={`${TD} text-center text-ink-muted`}>
              {r.pin ?? "—"}
            </td>
            <td className={TD}>
              <span className="text-ink-secondary">
                {r.defect_result_name ?? r.result_name ?? "—"}
              </span>
              {r.cleared && (
                <span
                  className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-black uppercase tracking-wider border border-ink-dim/40 text-ink-dim"
                  title="Flagged by the machine, then released by an operator. Present here but not counted in the defect breakdown above."
                >
                  Released
                </span>
              )}
            </td>
            <td
              className={`${TD} text-right tabular-nums font-bold`}
              style={{ color: measureTone(r.volume) }}
            >
              {fmtNum(r.volume)}
            </td>
            <td
              className={`${TD} text-right tabular-nums`}
              style={{ color: measureTone(r.height) }}
            >
              {fmtNum(r.height)}
            </td>
            <td
              className={`${TD} text-right tabular-nums`}
              style={{ color: measureTone(r.area) }}
            >
              {fmtNum(r.area)}
            </td>
            <td className={`${TD} text-right text-ink-muted tabular-nums`}>
              {fmtNum(r.offset_x, 3)}
            </td>
            <td className={`${TD} text-right text-ink-muted tabular-nums`}>
              {fmtNum(r.offset_y, 3)}
            </td>
            <td className={`${TD} text-right text-ink-dim tabular-nums`}>
              {fmtNum(r.pos_x, 1)}
            </td>
            <td className={`${TD} text-right text-ink-dim tabular-nums`}>
              {fmtNum(r.pos_y, 1)}
            </td>
            <td className={`${TD} text-right text-ink-dim tabular-nums`}>
              {isNum(r.pad_width) && isNum(r.pad_height)
                ? `${fmtNum(r.pad_width, 0)} × ${fmtNum(r.pad_height, 0)}`
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default SpiPadLogTable;
