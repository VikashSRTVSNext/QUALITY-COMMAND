// Seeded pseudo-random generator for the demo fixtures. Generator-side only.
//
// mulberry32: 32-bit state, one multiply-xorshift round. Chosen because only
// determinism and a decent spread matter here, not cryptographic quality.
//
// Why a seeded PRNG at all: the demo must produce the SAME numbers on every
// regeneration. Math.random() would give a plausible-looking dashboard that
// silently changed between screenshots, making any reported figure
// unreproducible and any "the totals don't add up" report impossible to chase.
//
// Plain .mjs, not TypeScript: this runs under `node` with no transpiler, the
// same way scripts/check-palette.mjs does. Nothing in src/ imports it — the
// runtime reads pre-generated JSON and never re-derives a number.

/**
 * FNV-1a over a string, used to turn a human-readable key into a seed.
 *
 * So a seed can be written as `${seed}|${date}|${shift}|${item}` and every
 * fixture row gets its own independent stream that does not move when an
 * unrelated row is added. Deriving every stream from one global sequence would
 * mean inserting a product shifted every number after it.
 */
export const hashSeed = (key) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 keeps it unsigned; Math.imul can return negatives.
  return h >>> 0;
};

export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A generator for a named stream. The key IS the identity of the stream. */
export const rngFor = (...parts) => mulberry32(hashSeed(parts.join("|")));

/** Integer in [min, max], inclusive. */
export const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

/** Float in [min, max), rounded to `digits`. */
export const float = (rng, min, max, digits = 2) => {
  const v = min + rng() * (max - min);
  const p = 10 ** digits;
  return Math.round(v * p) / p;
};

export const pick = (rng, items) => items[Math.floor(rng() * items.length)];

/** True with probability `p`. */
export const chance = (rng, p) => rng() < p;

/**
 * Deterministic weighted pick over [value, weight] pairs.
 *
 * Used for defect codes and dispositions, where a flat distribution would make
 * every Pareto chart a straight line — the whole point of those charts is that
 * a few causes dominate.
 */
export const weighted = (rng, items) => {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of items) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return items[items.length - 1][0];
};

/**
 * Split `total` into `buckets` parts that sum EXACTLY to total.
 *
 * The last bucket takes the remainder rather than its own draw. Independent
 * draws per shift would miss the day total by a few boards, and "the shift rows
 * don't add up to the day" is precisely the class of bug the demo must not
 * invent — even though the real D row is stored separately, the counts still
 * have to reconcile.
 */
export const splitInto = (rng, total, buckets) => {
  if (buckets <= 0) return [];
  if (buckets === 1) return [total];
  const weights = Array.from({ length: buckets }, () => 0.5 + rng());
  const sum = weights.reduce((a, w) => a + w, 0);
  const out = [];
  let used = 0;
  for (let i = 0; i < buckets - 1; i++) {
    const n = Math.round((total * weights[i]) / sum);
    out.push(n);
    used += n;
  }
  out.push(Math.max(0, total - used));
  return out;
};

/**
 * Split `total` across shifts by fixed weights, summing exactly.
 *
 * Fixed rather than random weights because shift A really is the fullest and C
 * the thinnest, and that imbalance is what makes a weighted range total differ
 * visibly from a naive average of the daily percentages — the distinction the
 * KPI contract is most emphatic about.
 */
export const splitByWeight = (total, weights) => {
  const keys = Object.keys(weights);
  const sum = keys.reduce((a, k) => a + weights[k], 0);
  const out = {};
  let used = 0;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      out[k] = Math.max(0, total - used);
    } else {
      const n = Math.round((total * weights[k]) / sum);
      out[k] = n;
      used += n;
    }
  });
  return out;
};
