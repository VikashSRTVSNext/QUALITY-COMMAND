// Deterministic replay of the three dashboard snapshot streams.
//
// ONE simulator, shared by every subscriber. That is the whole design, and it is
// what makes StrictMode safe: React double-invokes effects in development, so
// the dashboard opens three EventSources, closes them, and opens three more.
// A per-connection timer would mean two interleaved playbacks and every frame
// delivered twice — which looks like the backend double-sending and is
// miserable to diagnose.
//
// Instead the frame schedule belongs to this module. Connections subscribe and
// unsubscribe; the timer starts on the first subscriber and stops on the last.
// Frames are addressed to a stream, so a subscriber only sees its own.
//
// Playback is chronological by the `at` offset baked into the fixture, and the
// first frame of every stream is at 0 so the dashboard has data on first paint
// rather than after the first interval.

import { realtimeFixture } from "./fixtureStore";
import type { DemoSnapshotFrame } from "./types";

export type StreamName = DemoSnapshotFrame["stream"];

type Listener = (payload: unknown) => void;

interface Subscriber {
  stream: StreamName;
  onFrame: Listener;
}

const subscribers = new Set<Subscriber>();

let frames: DemoSnapshotFrame[] = [];
let loaded = false;

/** Playback speed. 2 runs twice as fast; 0.5 half. */
let speed = Number(import.meta.env.VITE_DEMO_SSE_SPEED ?? "1") || 1;

let timers: ReturnType<typeof setTimeout>[] = [];
let running = false;
let paused = false;
/** Where playback resumes from, in fixture-time ms. */
let cursor = 0;
let loopStartedAt = 0;

/**
 * The last frame delivered per stream.
 *
 * A connection opened mid-playback is replayed the latest frame immediately, so
 * a remount does not blank the dashboard until the next interval — the real
 * streams behave the same way, sending a snapshot on connect.
 */
const lastFrame = new Map<StreamName, unknown>();

export const loadFrames = async (): Promise<void> => {
  if (loaded) return;
  const fixture = await realtimeFixture();
  frames = (fixture?.frames ?? []) as DemoSnapshotFrame[];
  frames.sort((a, b) => a.at - b.at);
  loaded = true;
};

const deliver = (frame: DemoSnapshotFrame) => {
  lastFrame.set(frame.stream, frame.payload);
  for (const sub of subscribers) {
    if (sub.stream !== frame.stream) continue;
    try {
      sub.onFrame(frame.payload);
    } catch (err) {
      // One bad consumer must not stop the other two streams.
      console.error("[demo] snapshot consumer threw", err);
    }
  }
};

const clearTimers = () => {
  for (const t of timers) clearTimeout(t);
  timers = [];
};

/**
 * Schedule every frame at or after `fromMs`.
 *
 * One timer per frame rather than a single ticking interval: the fixture's
 * offsets are irregular and a fixed interval would either coalesce frames or
 * drift. The frame count is small (a dozen), so the timer count is too.
 *
 * Playback LOOPS. The demo is meant to be left open on a screen, and stopping
 * after ten seconds would make the dashboard look frozen.
 */
const schedule = (fromMs: number) => {
  clearTimers();
  if (frames.length === 0) return;
  const span = frames[frames.length - 1].at + 6000;
  loopStartedAt = Date.now() - fromMs / speed;

  for (const frame of frames) {
    if (frame.at < fromMs) continue;
    timers.push(
      setTimeout(() => deliver(frame), (frame.at - fromMs) / speed),
    );
  }
  // Re-arm at the end of the loop.
  timers.push(
    setTimeout(() => {
      cursor = 0;
      schedule(0);
    }, (span - fromMs) / speed),
  );
};

const elapsed = (): number =>
  Math.max(0, Math.round((Date.now() - loopStartedAt) * speed));

export const startSimulator = async (): Promise<void> => {
  await loadFrames();
  if (running) return;
  running = true;
  paused = false;
  cursor = 0;
  schedule(0);
};

export const stopSimulator = (): void => {
  clearTimers();
  running = false;
  paused = false;
  cursor = 0;
  lastFrame.clear();
};

export const pauseSimulator = (): void => {
  if (!running || paused) return;
  cursor = elapsed();
  clearTimers();
  paused = true;
};

export const resumeSimulator = (): void => {
  if (!running || !paused) return;
  paused = false;
  schedule(cursor);
};

export const setSimulatorSpeed = (next: number): void => {
  if (!Number.isFinite(next) || next <= 0) return;
  const at = running && !paused ? elapsed() : cursor;
  speed = next;
  if (running && !paused) schedule(at);
};

export const simulatorState = () => ({
  running,
  paused,
  speed,
  frames: frames.length,
  subscribers: subscribers.size,
  atMs: running && !paused ? elapsed() : cursor,
});

/**
 * Subscribe a connection to one stream. Returns the unsubscribe.
 *
 * The caller gets the latest frame for its stream immediately, if there is one.
 * Delivered asynchronously so a subscriber that opens inside a constructor is
 * not called back before it has finished wiring its handlers.
 */
export const subscribe = (
  stream: StreamName,
  onFrame: Listener,
): (() => void) => {
  const sub: Subscriber = { stream, onFrame };
  subscribers.add(sub);

  const seeded = lastFrame.get(stream);
  if (seeded !== undefined) {
    setTimeout(() => {
      if (subscribers.has(sub)) onFrame(seeded);
    }, 0);
  }

  return () => {
    subscribers.delete(sub);
  };
};

/** Test seam: deliver one frame now, without waiting for its slot. */
export const emitNow = (stream: StreamName): void => {
  const frame = frames.find((f) => f.stream === stream);
  if (frame) deliver(frame);
};
