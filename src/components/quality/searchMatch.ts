/**
 * Search matching for the filter dropdowns.
 *
 * Forgiving on purpose, because the values are codes people type from memory:
 *
 *   - Every WORD of the query must appear, in any order and in any field, so
 *     "aknb 105" finds "AKNB (093802A.105)" and "7b smt" finds "SMT line 07B".
 *   - Case, spaces and punctuation are ignored on both sides, so "smt07b",
 *     "093802a105" and "mac line 2" all hit.
 *   - Null and missing fields are skipped, never dereferenced. The option lists
 *     come straight from the API, and a product with no name on the Target sheet
 *     arrives as `product: null` — which used to throw on the first keystroke.
 */
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const matchesSearch = (
  query: string,
  fields: (string | null | undefined)[],
): boolean => {
  const words = query.split(/\s+/).map(compact).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .map(compact)
    .join("|");
  return words.every((w) => haystack.includes(w));
};
