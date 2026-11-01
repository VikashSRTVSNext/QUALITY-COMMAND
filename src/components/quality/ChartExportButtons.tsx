import { useEffect, useRef, useState, type RefObject } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import {
  copyPngToClipboard,
  downloadBlob,
  renderChartPng,
  type ChartExportOptions,
} from "../charts/exportChart";
import { palette } from "../../theme/palette";
import { REWORK_SURFACE } from "./reworkPalette";

type Props = {
  /** The card holding the chart. */
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
  /** Built at click time, so it always describes what is on screen. */
  options: () => Omit<ChartExportOptions, "background" | "ink" | "inkMuted" | "inkDim">;
  /** False while there is no chart to export (loading, empty, error). */
  disabled?: boolean;
};

type Status = "idle" | "busy" | "copied" | "saved" | "error";

/**
 * Download / Copy for one rework chart, as a PNG for a slide.
 *
 * Marked data-export-ignore so the buttons never appear in an export of the
 * card they sit on. The image uses the rework surface and text colours, so a
 * pasted chart matches the screen it was taken from.
 */
export const ChartExportButtons = ({ targetRef, filename, options, disabled = false }: Props) => {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const flash = (s: Status, message: string | null = null) => {
    setStatus(s);
    setError(message);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setStatus("idle");
      setError(null);
    }, s === "error" ? 4000 : 1600);
  };

  const render = () => {
    const root = targetRef.current;
    if (!root) return Promise.reject(new Error("The chart is not on screen."));
    return renderChartPng(root, {
      ...options(),
      background: REWORK_SURFACE.panel,
      ink: palette.ink,
      inkMuted: palette.inkMuted,
      inkDim: palette.inkDim,
    });
  };

  const run = async (kind: "download" | "copy") => {
    if (status === "busy") return;
    setStatus("busy");
    try {
      if (kind === "download") {
        downloadBlob(await render(), filename);
        flash("saved");
      } else {
        await copyPngToClipboard(render);
        flash("copied");
      }
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Export failed.");
    }
  };

  const btn =
    "inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[9.5px] font-bold " +
    "text-ink-muted hover:text-white hover:border-line-strong transition-colors " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <span data-export-ignore className="relative inline-flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        className={btn}
        disabled={disabled || status === "busy"}
        onClick={() => run("download")}
        title="Download this chart as a PNG"
        aria-label="Download chart as PNG"
      >
        {status === "busy" ? <Loader2 size={10} className="animate-spin" /> : status === "saved" ? <Check size={10} className="text-healthy" /> : <Download size={10} />}
        PNG
      </button>
      <button
        type="button"
        className={btn}
        disabled={disabled || status === "busy"}
        onClick={() => run("copy")}
        title="Copy this chart as an image, to paste into a slide"
        aria-label="Copy chart image"
      >
        {status === "copied" ? <Check size={10} className="text-healthy" /> : <Copy size={10} />}
        {status === "copied" ? "Copied" : "Copy"}
      </button>
      {status === "error" && error && (
        <span className="absolute right-0 top-full mt-1 z-30 w-[220px] rounded border border-warning/40 bg-panel px-2 py-1 text-[10px] font-bold text-warning shadow-lg">
          {error}
        </span>
      )}
    </span>
  );
};

export default ChartExportButtons;
