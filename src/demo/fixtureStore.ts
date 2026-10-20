// The demo's view of the fixture set: the manifest, the date re-anchoring, and
// typed accessors for each partition kind.
//
// Everything above this layer works in TODAY'S dates. Everything on disk is in
// the generator's anchor dates. This module is the only place that knows both,
// which is what keeps the offset from leaking into 20 handlers.

import {
  anchorOffset,
  daysBetween,
  reanchor,
  shiftDay,
  todayLabel,
} from "./demoClock";
import { loadFixture, loadFixtureOrNull } from "./fixtureLoader";
import type { FixtureManifest } from "./types";

let manifest: FixtureManifest | null = null;
let offset = 0;
/** Generator-side labels, newest last. */
let sourceDays: string[] = [];
/** Today-side labels, newest last. Same order, same length. */
let liveDays: string[] = [];

export const loadManifest = async (): Promise<FixtureManifest> => {
  if (manifest) return manifest;
  const m = await loadFixture<FixtureManifest>("manifest.json");
  manifest = m;
  offset = anchorOffset(m.anchorDate);
  sourceDays = m.days;
  liveDays = m.days.map((d) => shiftDay(d, offset));
  return m;
};

const ready = (): FixtureManifest => {
  if (!manifest) {
    // bootstrapDemo awaits loadManifest before React mounts, so reaching this
    // means the transport was installed without bootstrapping.
    throw new Error("demo fixture manifest not loaded — call bootstrapDemo() first");
  }
  return manifest;
};

/** Days the demo can answer for, in today's calendar, newest last. */
export const availableDays = (): string[] => {
  ready();
  return liveDays;
};

/** The newest production day the demo has data for: today. */
export const latestDay = (): string => {
  ready();
  return liveDays[liveDays.length - 1];
};

export const earliestDay = (): string => {
  ready();
  return liveDays[0];
};

/**
 * A live date label -> the generator's label for the same day, or null when it
 * falls outside the scenario.
 *
 * Null is a real answer, not an error: a request for a day the fixtures do not
 * cover must come back as an empty window, which is how the app distinguishes
 * "nothing ran" from "the request broke".
 */
export const toSourceDay = (liveDay: string): string | null => {
  ready();
  const source = shiftDay(liveDay, -offset);
  return sourceDays.includes(source) ? source : null;
};

/** Live days covered by an inclusive range, clamped to what exists. */
export const daysInRange = (from: string, to: string): string[] => {
  ready();
  if (daysBetween(from, to) < 0) return [];
  return liveDays.filter((d) => d >= from && d <= to);
};

/**
 * Resolve the window a request is asking about.
 *
 * Mirrors the backend's omission rules exactly:
 *  - neither date -> the current production day
 *  - one date     -> that single day, NOT an open range
 *  - both         -> the inclusive span
 */
export const resolveWindow = (
  dateFrom: string | null,
  dateTo: string | null,
): { from: string; to: string; days: string[] } => {
  ready();
  if (!dateFrom && !dateTo) {
    const today = latestDay();
    return { from: today, to: today, days: [today] };
  }
  const from = dateFrom ?? dateTo!;
  const to = dateTo ?? dateFrom!;
  return { from, to, days: daysInRange(from, to) };
};

/**
 * The window immediately before `days`, same length.
 *
 * Used for delta_vs_previous, which compares a week against the week before it
 * rather than against yesterday. Clamped to the scenario, so `previous` can be
 * shorter than the requested window near the oldest day — the response reports
 * its own from/to and the UI labels itself from those.
 */
export const previousWindow = (
  from: string,
  to: string,
): { from: string; to: string; days: string[] } => {
  ready();
  const length = daysBetween(from, to) + 1;
  const prevTo = shiftDay(from, -1);
  const prevFrom = shiftDay(from, -length);
  return { from: prevFrom, to: prevTo, days: daysInRange(prevFrom, prevTo) };
};

// ── Typed partition accessors ───────────────────────────────────────────────
//
// Each returns data already re-anchored to today's dates, so a handler never
// sees a generator label. `reanchor` walks the parsed object and rewrites every
// date-shaped string and key — see demoClock.ts for why that is shape-agnostic
// rather than per-endpoint.

const loadDay = async <T>(kind: string, liveDay: string): Promise<T | null> => {
  const source = toSourceDay(liveDay);
  if (!source) return null;
  const raw = await loadFixtureOrNull<T>(kind.replace("{day}", source));
  return raw == null ? null : reanchor(raw, offset);
};

export interface YieldDayFixture {
  rows: {
    id: number;
    product: string;
    item: string;
    sub_module: string;
    tested: number;
    failed: number;
    fpy: number | null;
    spy: number | null;
    target_yield: number | null;
    status: string;
    ai_recommendation: string | null;
    shift: string;
  }[];
}

export const yieldDay = (day: string) =>
  loadDay<YieldDayFixture>("summaries/product-yield-{day}.json", day);

export interface KpiDayFixture {
  business_date: string;
  by_shift: (Record<string, number | null> & { shift: string })[];
  day: Record<string, number | null>;
  customer_audit: number | null;
}

export const kpiDay = (day: string) =>
  loadDay<KpiDayFixture>("summaries/kpis-{day}.json", day);

export const processPerformanceDay = (day: string) =>
  loadDay<{ steps: Record<string, any> }>(
    "summaries/process-performance-{day}.json",
    day,
  );

export const productsDay = (day: string) =>
  loadDay<{ products: any[] }>("summaries/products-{day}.json", day);

export const stepProductsDay = (step: string, day: string) =>
  loadDay<any>(`stations/${step}/products-{day}.json`, day);

export const stepTestersDay = (step: string, day: string) =>
  loadDay<{ byItem: Record<string, any> }>(
    `stations/${step}/testers-{day}.json`,
    day,
  );

export const stepDefectsDay = (step: string, day: string) =>
  loadDay<{ byItem: Record<string, any> }>(
    `events/${step}/defects-{day}.json`,
    day,
  );

export const dpmoiDay = (day: string) =>
  loadDay<any>("events/dpmoi/{day}.json", day);

export const screwDefectsDay = (day: string) =>
  loadDay<any>("events/screw-defects/{day}.json", day);

export const attentionDay = (day: string) =>
  loadDay<{ alerts: any[] }>("events/attention-{day}.json", day);

/** Single-file fixtures. Re-anchored the same way. */
const loadSingle = async <T>(rel: string): Promise<T | null> => {
  ready();
  const raw = await loadFixtureOrNull<T>(rel);
  return raw == null ? null : reanchor(raw, offset);
};

export const safetyFixture = () => loadSingle<any>("summaries/safety.json");
export const eriFixture = () => loadSingle<any>("summaries/eri.json");
export const yieldRecommendationFixture = () =>
  loadSingle<any>("summaries/yield-recommendation.json");
export const processFilterOptionsFixture = () =>
  loadSingle<any>("summaries/process-filter-options.json");
export const alertAckFixture = () =>
  loadSingle<Record<string, any>>("events/alerts-ack.json");
export const realtimeFixture = () =>
  loadSingle<{ frames: any[] }>("realtime/snapshots.json");

/** Diagnostics for the dev banner and the README. */
export const storeInfo = () => {
  const m = ready();
  return {
    seed: m.seed,
    anchorDate: m.anchorDate,
    offsetDays: offset,
    today: todayLabel(),
    days: liveDays.length,
    window: `${earliestDay()} .. ${latestDay()}`,
    rows: m.stats.totalRows,
    bytes: m.stats.bytes,
  };
};
