import { useEffect, useState } from "react";

type Props = {
  active: boolean;
  /** Absolute by default, so appearing and disappearing never nudges the
   *  content under it. Pass false where the parent is not positioned. */
  absolute?: boolean;
  className?: string;
};

/**
 * A 2px indeterminate progress bar for requests of unpredictable length.
 *
 * Indeterminate rather than a percentage because nothing here can report
 * progress: these are single SQL queries that return all at once, and a fake
 * percentage that jumps 0 -> 100 is worse than none.
 *
 * It is DELIBERATELY not the only signal. The global prefers-reduced-motion rule
 * in index.css freezes every animation on this dashboard, which would leave this
 * as a static segment reading like a stalled bar — so callers pair it with text
 * (see `useSlowHint`). The bar is the glance; the words are the meaning.
 */
export const LoadingBar = ({ active, absolute = true, className = "" }: Props) => {
  if (!active) return null;
  return (
    <div
      className={`${absolute ? "absolute inset-x-0 top-0" : "relative"} h-[2px] overflow-hidden bg-line/40 z-20 ${className}`}
      role="progressbar"
      aria-busy="true"
      // No aria-valuenow: the work genuinely has no measurable progress, and an
      // invented value would be read out as fact.
      aria-label="Loading"
    >
      <div className="h-full w-full bg-info animate-indeterminate" />
    </div>
  );
};

/**
 * How long the current request has been running, bucketed for copy.
 *
 * "slow" exists because some of these queries genuinely take upwards of a
 * minute on a high-volume day. Silence for that long reads as a hung screen, so
 * the UI says it is still working rather than letting the operator guess.
 *
 * Resets whenever `active` goes false, so a fast request after a slow one does
 * not inherit the warning.
 */
export const useSlowHint = (active: boolean, slowAfterMs = 8000) => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), slowAfterMs);
    return () => clearTimeout(t);
  }, [active, slowAfterMs]);

  return slow;
};

export default LoadingBar;
