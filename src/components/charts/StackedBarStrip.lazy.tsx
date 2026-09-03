import { Suspense, lazy } from "react";
import type { StackedBarStripProps } from "./StackedBarStrip";

const Strip = lazy(() => import("./StackedBarStrip"));

/**
 * StackedBarStrip, with Recharts split out of the page bundle.
 *
 * Import THIS, not the component itself, unless you have a reason not to.
 *
 * Recharts is ~109 kB gzipped — nearly three times the Quality page's own code —
 * and every current use of the strip is inside a drill-down modal that most
 * visits never open. Importing it directly puts that on the first paint of a
 * screen the floor leaves running all shift.
 *
 * The fallback is a blank box of exactly the strip's height rather than a
 * spinner: the chunk arrives while the modal is still fetching its data, so a
 * spinner would announce a wait that has already happened, and a zero-height
 * fallback would shift the table under the pointer.
 */
export const StackedBarStripLazy = (props: StackedBarStripProps) => (
  <Suspense
    fallback={<div style={{ height: props.height ?? 18 }} aria-hidden="true" />}
  >
    <Strip {...props} />
  </Suspense>
);

export default StackedBarStripLazy;
