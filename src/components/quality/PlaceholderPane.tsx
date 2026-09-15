/**
 * Stand-in for a Product Yield tab whose endpoint does not exist yet.
 *
 * Used by the SPI and SMT DEFECTS @ MFT tabs so the strip already shows every
 * SMT metric a tile has. Swap this for a real pane once the API lands — the tab
 * wiring in ProductYieldPanel does not need to change.
 */
export const PlaceholderPane = ({ label }: { label: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-1 py-16 text-center">
    <span className="text-[12px] font-bold text-ink-dim">
      {label} breakdown is coming soon.
    </span>
    <span className="text-[11px] text-ink-muted">
      Per-product data for this step is not wired to an endpoint yet.
    </span>
  </div>
);

export default PlaceholderPane;
