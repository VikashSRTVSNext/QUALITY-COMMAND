import { useEffect } from "react";
import ProcessProductsTable from "./ProcessProductsTable";
import { fmtPct, isNum, useProcessProducts } from "./useProcessProducts";

// Which steps a tile can drill into. An explicit allowlist, so no tile becomes
// clickable by accident.
//
// Keys are mart step names (the endpoint's path segment), NOT tile labels — the
// two differ for most steps, so each entry names its tile. ProcessMetricCard
// does the tile -> step lookup via API_KEY_BY_TILE in metrics.ts.
//
// SPI, DPMOI and SMT_DEFECTS can never appear here: they are not built from the
// production log, so they have no per-product breakdown.
// Tile click-through is OFF for now. The same per-product data is reachable from
// the step tabs in the Product Yield panel, so opening a modal from the tile is
// redundant. Set this back to true to restore it — nothing else was removed, and
// DRILLDOWN_STEPS below is still the list the tabs are checked against.
export const TILE_DRILLDOWN_ENABLED = false;

export const DRILLDOWN_STEPS: Record<string, true> = {
  AXI: true, // tile "AXI - S"
  AUTO_OGI: true, // tile "AUTO OGI"
  BURN_IN: true, // tile "BURN-IN - S"
  IP: true,
  LBTS: true, // tile "LBTS - S"
  OTA_TEST: true, // tile "OTA"
  RTWP: true,
  THERMAL_AVI: true, // tile "THERMAL AVI"
};

type Props = {
  /** Mart step name, e.g. "RTWP" — the endpoint's path segment. */
  step: string;
  /** Tile label, so the header matches the card that was clicked. */
  title: string;
  shift: string | null;
  onClose: () => void;
};

// The drill-down opened by clicking a Process Performance tile.
//
// Chrome only: the backdrop, the panel, the header showing the step's own figure
// and the Escape/close handling. The table itself is ProcessProductsTable, which
// the Product Yield panel also renders inline.
export const ProcessProductsModal: React.FC<Props> = ({
  step,
  title,
  shift,
  onClose,
}) => {
  const query = useProcessProducts(step, shift);
  const { data, cardValue } = query;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-page/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px] max-h-[85vh] bg-panel/95 border border-line-soft rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center bg-white/[0.04] px-6 py-4 border-b border-line-modal flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[16px] font-black text-white uppercase tracking-wider">
              {title}
            </span>
            <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider">
              By Product
            </span>
            {isNum(cardValue) && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
                <span className="w-1 h-1 rounded-full bg-ink-dim" />
                Card {fmtPct(cardValue)}
                {isNum(data?.target) && (
                  <span className="text-ink-dim">
                    {" "}
                    / Tgt {data!.target}
                    {data!.target_unit === "percent" ? "%" : ""}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-ink-dim">
              {data?.business_date ?? ""}
              {shift ? ` · Shift ${shift}` : " · Full Day"}
            </span>
            <button
              onClick={onClose}
              className="bg-raised hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <ProcessProductsTable query={query} />
      </div>
    </div>
  );
};

export default ProcessProductsModal;
