import { useEffect, useState } from "react";
import { X, ImageOff, RefreshCw } from "lucide-react";
import {
  useArchiveManifest,
  unitImageUrl,
  type UnitArchive,
  type UnitImages,
} from "./useUnitImages";

type Props = {
  sfc: string;
  unit: UnitImages;
  /** Product name or item code, for the header. */
  subject?: string | null;
  onClose: () => void;
};

const fmtTime = (iso: string | null) =>
  iso ? iso.slice(11, 19) : "—";

const fmtBytes = (n: number | null | undefined) =>
  n == null ? "—" : n > 1_000_000
    ? `${(n / 1_048_576).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;

/** A path segment that is a per-image verdict rather than a folder name. */
const VERDICT = /^(OK|NG|NOK|PASS|FAIL)$/i;

/**
 * Pull the meaning out of one zip entry's path.
 *
 * The entries are not flat filenames. A real one looks like
 *   FB_FISTO_FALCON_ALLIED_CAP_QA/OK/2015-04-06_04-52-41/<file>.jpg
 * so the path carries the INSPECTION POINT that took the picture and, crucially,
 * that point's own verdict. Rendering the raw string just truncates to
 * "FB_FISTO_FALCON_ALLIED_CAP_..." on every tile, which reads as noise and
 * throws away the one field worth having.
 *
 * Everything here is defensive: the layout is not documented anywhere, it is
 * already known to differ between products (one writes a single flat
 * `{SFC}_0.png`), and the timestamp segment is often nonsense — 2015 dates
 * appear on units built in 2026, so the cell's clock is not to be trusted. A
 * flat name simply yields no station and no verdict, and the tile falls back to
 * the filename.
 */
const parseEntry = (entry: string) => {
  const parts = entry.split("/").filter(Boolean);
  const file = parts[parts.length - 1] ?? entry;
  const verdict = parts.find((p) => VERDICT.test(p))?.toUpperCase() ?? null;
  // The first segment, when there is one, names the inspection point.
  const station = parts.length > 1 ? parts[0] : null;
  return { file, station, verdict };
};

/**
 * The prefix every station name in this archive shares, so it can be dropped.
 *
 * Each tile is labelled FB_FISTO_FALCON_<something>, and the constant two thirds
 * is what pushes the part that differs off the end of the tile. Computed from
 * the entries rather than hardcoded, because the prefix is a property of
 * whichever cell wrote the archive and there is more than one.
 */
const commonPrefix = (names: string[]): string => {
  if (names.length < 2) return "";
  let prefix = names[0];
  for (const n of names.slice(1)) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) return "";
  }
  // Only trim at a separator, or "CAP" and "CHAIN" would collapse to "C".
  const cut = Math.max(prefix.lastIndexOf("_"), prefix.lastIndexOf("-"));
  return cut > 0 ? prefix.slice(0, cut + 1) : "";
};

/**
 * The inspection images the cell captured for one unit.
 *
 * Sits above the NC log rather than inside it — a unit's images are a different
 * subject from its failure record, and on this line the two frequently do not
 * describe the same event at all.
 *
 * THE LABELLING HERE IS LOAD-BEARING. A rejected attempt is the CAMERA refusing
 * to read a unit, after which the unit is re-imaged and usually accepted; MES
 * records a clean pass and never sees a failure. Calling that "failed" in the
 * UI would tell a supervisor a unit failed inspection when it did not, and the
 * numbers would contradict the yield card sitting behind this modal. Hence
 * "rejected / accepted by the camera" throughout, and the footnote explaining
 * why the count will not match the NC log.
 */
export const UnitImageViewer = ({ sfc, unit, subject, onClose }: Props) => {
  // Default to the LAST attempt: it is the one that decided the unit, and for a
  // single-attempt unit it is the only one.
  const [selected, setSelected] = useState<UnitArchive>(
    unit.archives[unit.archives.length - 1],
  );
  const [zoomed, setZoomed] = useState<string | null>(null);
  const manifest = useArchiveManifest(selected?.key ?? null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // CAPTURE phase, and stopPropagation, because DrilldownModalShell keeps
      // its own Escape listener on window and registered it FIRST -- it mounts
      // with the drill-down, this viewer opens later. In the bubble phase the
      // shell would therefore win, and one keypress would close this viewer AND
      // step the drill-down back a level. A capture listener on window runs
      // ahead of every bubble listener whatever the registration order, so
      // stopping propagation here keeps Escape addressed to the topmost layer.
      e.stopPropagation();
      // Zoom first, so a mistyped key does not throw away the whole viewer --
      // the same rule the shell follows for its own back/close.
      if (zoomed) setZoomed(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, zoomed]);

  const images = manifest.data?.entries.filter((e) =>
    e.content_type.startsWith("image/"),
  );

  // Computed once per archive, not per tile.
  const stationPrefix = commonPrefix(
    (images ?? [])
      .map((e) => parseEntry(e.entry).station)
      .filter((s): s is string => Boolean(s)),
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:p-8 bg-page/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1200px] max-h-[90vh] bg-panel/95 border border-line-soft rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- header ---- */}
        <div className="flex justify-between items-center bg-white/[0.04] px-6 py-4 border-b border-line-modal flex-shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[15px] font-black text-white font-mono tracking-wide">
              {sfc}
            </span>
            {subject && (
              <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider truncate">
                {subject}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-ink-dim" />
              {unit.attempts}{" "}
              {unit.attempts === 1 ? "capture" : "captures"}
            </span>
            {unit.retries > 0 && (
              <span
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-warning border border-warning/40 rounded px-1.5 py-0.5"
                title="The camera rejected this unit and re-imaged it. This is NOT a test failure — MES records these units as passing."
              >
                <RefreshCw size={10} />
                {unit.retries} re-imaged
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="bg-raised hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none flex-shrink-0"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* ---- attempt list ---- */}
          {unit.archives.length > 1 && (
            <div className="w-[230px] flex-shrink-0 border-r border-line-modal overflow-auto py-2">
              <div className="px-3 pb-2 text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
                Captures · oldest first
              </div>
              {unit.archives.map((a, i) => {
                const active = a.key === selected?.key;
                const rejected = a.result === "FAIL";
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setSelected(a)}
                    className={`w-full text-left px-3 py-2 border-l-2 transition-colors cursor-pointer ${
                      active
                        ? "bg-white/[0.05] border-info"
                        : "border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-ink-dim tabular-nums">
                        {i + 1}
                      </span>
                      <span
                        className={`text-[9.5px] font-black uppercase tracking-wider ${
                          rejected ? "text-warning" : "text-healthy"
                        }`}
                      >
                        {rejected ? "rejected" : "accepted"}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-ink-muted tabular-nums mt-0.5">
                      {fmtTime(a.captured_at)}
                      {a.captured_at_approximate && (
                        <span
                          className="ml-1 text-ink-dim"
                          title="Upload time — this archive carries no timestamp in its name. Accurate to about two minutes."
                        >
                          ~
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ---- images ---- */}
          <div className="flex-1 overflow-auto p-5">
            {manifest.state === "loading" && (
              <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
                Opening archive…
              </div>
            )}
            {manifest.state === "error" && (
              <div className="py-16 text-center text-[12px] font-bold text-critical">
                Could not read this archive.
              </div>
            )}
            {manifest.state === "ready" && images && (
              images.length === 0 ? (
                <div className="py-16 text-center">
                  <ImageOff
                    size={22}
                    className="text-ink-dim mx-auto mb-2"
                  />
                  <div className="text-[12px] font-bold text-ink-dim">
                    The archive holds no images.
                  </div>
                </div>
              ) : (
                <>
                  {/* Auto-fit rather than a fixed column count: one product
                      writes a single PNG, another writes five JPEGs, and a
                      fixed grid would strand the single image in a corner. */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
                    {images.map((e) => {
                      const p = parseEntry(e.entry);
                      // A verdict that is not OK/PASS is the inspection point
                      // that actually objected -- on a rejected capture, this is
                      // the tile worth looking at first.
                      const flagged =
                        p.verdict != null && !/^(OK|PASS)$/.test(p.verdict);
                      return (
                        <button
                          key={e.entry}
                          type="button"
                          onClick={() =>
                            setZoomed(unitImageUrl(selected.key, e.entry))
                          }
                          className={`group relative bg-page border rounded-lg overflow-hidden cursor-zoom-in transition-colors ${
                            flagged
                              ? "border-warning/60 hover:border-warning"
                              : "border-line hover:border-line-strong"
                          }`}
                          title={`${e.entry} · ${fmtBytes(e.bytes)}`}
                        >
                          {/* Loaded at full size and constrained by CSS: there is
                              no thumbnail endpoint, and at ~200 KB an image that
                              is worth opening is worth fetching once. Lazy so a
                              nine-image archive does not fetch all nine before
                              anyone scrolls. */}
                          <img
                            src={unitImageUrl(selected.key, e.entry)}
                            alt={`${sfc} — ${p.station ?? p.file}`}
                            loading="lazy"
                            className="w-full h-[170px] object-cover bg-black/40"
                          />
                          {p.verdict && (
                            <span
                              className={`absolute top-1.5 right-1.5 text-[9px] font-black uppercase tracking-wider rounded px-1.5 py-0.5 ${
                                flagged
                                  ? "bg-warning text-page"
                                  : "bg-page/80 text-ink-dim"
                              }`}
                              title={`This inspection point recorded ${p.verdict}.`}
                            >
                              {p.verdict}
                            </span>
                          )}
                          <div className="flex items-center justify-between px-2 py-1.5 border-t border-line gap-2">
                            {/* The station, with the prefix every tile shares
                                trimmed off -- otherwise the part that differs is
                                the part that gets truncated away. */}
                            <span className="text-[10px] font-mono text-ink-muted truncate">
                              {p.station
                                ? p.station.slice(stationPrefix.length) ||
                                  p.station
                                : p.file}
                            </span>
                            <span className="text-[9.5px] font-bold text-ink-dim tabular-nums flex-shrink-0">
                              {fmtBytes(e.bytes)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {/* ---- footnote ---- */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-line-modal text-[10.5px] text-ink-dim leading-relaxed">
          Images are what the inspection cell captured for this unit.{" "}
          <span className="text-ink-muted font-bold">
            A “rejected” capture is the camera declining to read the unit, not a
            failed test
          </span>{" "}
          — the unit is re-imaged and usually accepted, and MES records it as a
          pass. So this count will not match the NC log, and the two are not
          meant to. Captures also arrive within about two minutes of the test,
          ahead of the log beside them.
        </div>
      </div>

      {/* ---- zoom ---- */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/85 cursor-zoom-out"
          onClick={(e) => {
            e.stopPropagation();
            setZoomed(null);
          }}
        >
          <img
            src={zoomed}
            alt={sfc}
            className="max-w-full max-h-full object-contain"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(null);
            }}
            className="absolute top-5 right-5 bg-raised/90 hover:bg-critical text-ink-muted hover:text-white border border-line-strong rounded-lg p-2 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default UnitImageViewer;
