// Turns one on-screen Recharts chart into a PNG for a slide.
//
// No libraries: the chart is already an SVG with real colour strings (palette.ts
// exists precisely because CSS variables do not resolve in SVG attributes), so
// it serialises to a self-contained image. That image is drawn on a canvas at
// 2x, under a title, the product + period line and the legend, all of which
// live in HTML on screen and would otherwise be lost. Nothing is fetched, so the
// canvas is never tainted and toBlob always works.

export type ExportLegendItem = {
  label: string;
  color: string;
  /** "box" (a bar series, the default), "line", "dashed" or "dot". */
  kind?: "box" | "line" | "dashed" | "dot";
};

export type ChartExportOptions = {
  title: string;
  /** Product and period, e.g. "ARDC (476708A.101) · WK41–WK45 · All shifts". */
  subtitle?: string;
  /** A totals line under the subtitle. */
  summary?: string;
  legend?: ExportLegendItem[];
  /** Small print under the chart. */
  note?: string;
  background: string;
  /** Text colours, so the image matches the screen it came from. */
  ink: string;
  inkMuted: string;
  inkDim: string;
  /** Pixel ratio. 2 keeps text crisp on a projector. */
  scale?: number;
};

const PAD = 24;
const FONT_FALLBACK = "Inter, 'Segoe UI', Roboto, Arial, sans-serif";

/** The biggest Recharts surface in the card: the chart, not an icon. */
const findChartSvg = (root: HTMLElement): SVGSVGElement | null => {
  const svgs = Array.from(root.querySelectorAll<SVGSVGElement>("svg.recharts-surface"));
  const area = (s: SVGSVGElement) => {
    const r = s.getBoundingClientRect();
    return r.width * r.height;
  };
  return svgs.sort((a, b) => area(b) - area(a))[0] ?? null;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The chart could not be drawn as an image."));
    img.src = src;
  });

/** Greedy word wrap; returns the lines. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/** Legend items laid out in rows: [x offset, row index] per item. */
const layoutLegend = (
  ctx: CanvasRenderingContext2D,
  items: ExportLegendItem[],
  maxWidth: number,
) => {
  const gap = 16;
  const swatch = 14;
  let x = 0;
  let row = 0;
  return items.map((it) => {
    const w = swatch + 6 + ctx.measureText(it.label).width;
    if (x > 0 && x + w > maxWidth) {
      x = 0;
      row += 1;
    }
    const pos = { item: it, x, row };
    x += w + gap;
    return pos;
  });
};

/**
 * Renders the chart inside `root` to a PNG blob.
 *
 * The SVG is cloned at its on-screen size, so the export is what the user is
 * looking at, selection highlights included. The hover cursor is dropped: it
 * is a pointer artefact, not part of the chart.
 */
export const renderChartPng = async (
  root: HTMLElement,
  opts: ChartExportOptions,
): Promise<Blob> => {
  const svg = findChartSvg(root);
  if (!svg) throw new Error("There is no chart on screen to export yet.");
  const box = svg.getBoundingClientRect();
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  if (!width || !height) throw new Error("The chart has no size to export.");

  const font = getComputedStyle(svg).fontFamily || FONT_FALLBACK;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // An image has no stylesheet: the font the page cascades into the SVG has to
  // be written on it, or every label falls back to the browser's serif.
  clone.style.fontFamily = font;
  clone.querySelectorAll(".recharts-tooltip-cursor, .recharts-active-dot").forEach((n) => n.remove());

  const xml = new XMLSerializer().serializeToString(clone);
  const chart = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);

  const scale = opts.scale ?? 2;
  const contentWidth = width;
  const canvasWidth = contentWidth + PAD * 2;

  // A measuring context first, so the canvas can be sized to its content.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("This browser cannot export images.");

  const titleFont = `800 18px ${font}`;
  const subFont = `600 12px ${font}`;
  const legendFont = `600 11px ${font}`;
  const noteFont = `400 10.5px ${font}`;

  measure.font = legendFont;
  const legend = layoutLegend(measure, opts.legend ?? [], contentWidth);
  const legendRows = legend.length ? Math.max(...legend.map((l) => l.row)) + 1 : 0;
  measure.font = noteFont;
  const noteLines = opts.note ? wrap(measure, opts.note, contentWidth) : [];

  let y = PAD;
  const titleY = y + 18;
  y = titleY + 6;
  const subY = opts.subtitle ? y + 14 : 0;
  if (opts.subtitle) y = subY + 4;
  const sumY = opts.summary ? y + 14 : 0;
  if (opts.summary) y = sumY + 4;
  y += 10;
  const chartY = y;
  y += height;
  const legendY = legendRows ? y + 12 : 0;
  if (legendRows) y = legendY + legendRows * 18;
  const noteY = noteLines.length ? y + 10 : 0;
  if (noteLines.length) y = noteY + noteLines.length * 14;
  const canvasHeight = y + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(canvasWidth * scale);
  canvas.height = Math.round(canvasHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export images.");
  ctx.scale(scale, scale);

  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.textBaseline = "alphabetic";

  ctx.font = titleFont;
  ctx.fillStyle = opts.ink;
  ctx.fillText(opts.title, PAD, titleY);
  if (opts.subtitle) {
    ctx.font = subFont;
    ctx.fillStyle = opts.inkMuted;
    ctx.fillText(opts.subtitle, PAD, subY);
  }
  if (opts.summary) {
    ctx.font = subFont;
    ctx.fillStyle = opts.inkDim;
    ctx.fillText(opts.summary, PAD, sumY);
  }

  ctx.drawImage(chart, PAD, chartY, width, height);

  if (legendRows) {
    ctx.font = legendFont;
    for (const { item, x, row } of legend) {
      const lx = PAD + x;
      const ly = legendY + row * 18;
      ctx.fillStyle = item.color;
      ctx.strokeStyle = item.color;
      const kind = item.kind ?? "box";
      if (kind === "box") {
        ctx.fillRect(lx, ly - 9, 11, 11);
      } else if (kind === "dot") {
        ctx.beginPath();
        ctx.arc(lx + 5.5, ly - 3.5, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = 2;
        ctx.setLineDash(kind === "dashed" ? [4, 3] : []);
        ctx.beginPath();
        ctx.moveTo(lx, ly - 3.5);
        ctx.lineTo(lx + 14, ly - 3.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = opts.inkMuted;
      ctx.fillText(item.label, lx + 20, ly);
    }
  }

  if (noteLines.length) {
    ctx.font = noteFont;
    ctx.fillStyle = opts.inkDim;
    noteLines.forEach((line, i) => ctx.fillText(line, PAD, noteY + i * 14));
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be created."))),
      "image/png",
    ),
  );
};

/** "ARDC 476708A.101 Defect category WK41–WK45" -> "ARDC_476708A.101_Defect-category_WK41-WK45.png" */
export const exportFileName = (...parts: (string | null | undefined)[]): string =>
  `${parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.trim().replace(/[–—]/g, "-").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-"))
    .join("_")}.png`;

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // After the click has been handled; revoking synchronously can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Puts the PNG on the clipboard, for a straight paste into a slide. */
export const copyPngToClipboard = async (render: () => Promise<Blob>) => {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Copying images is not supported here. Use Download instead.");
  }
  // The promise, not the blob: Safari only allows the write inside the click
  // that started it, and the render takes longer than that.
  await navigator.clipboard.write([new ClipboardItem({ "image/png": render() })]);
};
