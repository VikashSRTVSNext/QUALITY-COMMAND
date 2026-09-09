import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

/**
 * Steps whose cells photograph the units they inspect.
 *
 * Kept in step with the backend's IMAGE_PREFIXES map. A step having a yield card
 * does NOT mean it has a camera: the bucket also holds prefixes for
 * ROBOT_INSPECTION_*, CAMERA_INSPECTION_IN04, HA1_FISTO_IN04, MOD_OGI_TEST_IN04
 * and DIGITAL_SELF_INSPECTION_03_IN04, none of which map to a PROCESS_STEPS
 * entry and so have no drill-down to hang images off.
 *
 * The endpoint answers 404 for an unlisted step, so this list only exists to
 * avoid offering a click the UI knows will not resolve.
 */
export const IMAGE_STEPS: Record<string, true> = {
  THERMAL_AVI: true,
  AUTO_OGI: true,
  // X-ray inspection. A SEPARATE bucket with its own credentials and a key
  // layout sharing nothing with the AVI cells'. Its archives carry no PASS/FAIL
  // verdict at all, so `result` is null and `retries` is always 0.
  AXI: true,
};

/** Which bucket an archive came from. The two are separate stores with separate
 *  credentials, and a key alone does not say which — so it travels with the
 *  archive and goes back on every image request. */
export type ImageStoreName = "avi" | "axi";

export type UnitArchive = {
  /** S3 key. Opaque to the UI — pass it straight back to the image endpoints. */
  key: string;
  sfc: string;
  /**
   * PASS or FAIL for the AVI store — but see UnitImages.retries, FAIL there is
   * a CAMERA verdict, not a test result.
   *
   * NULL for AXI, whose filenames are the bare serial and carry no verdict at
   * all. Null means "this store does not record one", never "it passed", so it
   * must not be rendered as a verdict.
   */
  result: string | null;
  /** AXI only: which machine took it, AXI1 or AXI2. */
  machine?: string | null;
  captured_at: string | null;
  /** True when the time came from the upload rather than the filename. About
   *  two thirds of AVI archives carry no timestamp in their name, and NO AXI
   *  archive does — so for AXI this is always true. Accurate to a couple of
   *  minutes. */
  captured_at_approximate: boolean;
  bytes: number | null;
};

export type UnitImages = {
  /** How many times the cell imaged this unit. */
  attempts: number;
  /**
   * Attempts the CAMERA rejected before it accepted the unit.
   *
   * NOT failures in the MES sense, and the distinction is the whole reason this
   * panel is not wired to the NC log's failed units. A rejected attempt is
   * re-imaged seconds later and usually passes; MES records a clean pass and
   * never sees a failure. Measured example: K9263623049 was rejected at
   * 03:02:01, 03:05:34 and 03:08:43 and accepted at 03:12:10 — one unit, four
   * archives, zero MES failures.
   *
   * Never label this "failed" in the UI. It means the cell had trouble reading
   * the unit, which is a genuine signal — it just is not the same signal as a
   * failed test.
   */
  retries: number;
  /** Oldest first, so the sequence reads as the retry story it is. */
  archives: UnitArchive[];
};

export type ProductImagesResponse = {
  step: string;
  store: ImageStoreName;
  item: string;
  /** The folder the archives were read from — item code minus its revision for
   *  AVI, whichever candidate resolved for AXI, null when none did. */
  item_folder: string | null;
  business_date: string;
  window: { from: string; to: string };
  prefixes: string[];
  units: number;
  archives: number;
  /** Units the camera rejected at least once. Exists nowhere else in the
   *  dashboard: MES records every one of them as a clean pass. Always 0 for
   *  AXI, whose archives carry no verdict. */
  retried_units: number;
  /** Archives found in the two calendar folders but belonging to the adjacent
   *  production day. Reported rather than hidden so a supervisor checking the
   *  folder by hand does not think rows went missing. */
  outside_window: number;
  by_sfc: Record<string, UnitImages>;

  // --- AXI only -----------------------------------------------------------
  // AXI names its product folders by at least four conventions and none is
  // documented, so the backend resolves the folder by listing what exists and
  // reports its working. When nothing matched, `available_folders` carries the
  // folders that were actually there — which is the difference between "no
  // images today" and "we looked in the wrong place".
  product_name?: string | null;
  folder_candidates?: string[];
  matched_folders?: { machine: string; year: number; folder: string }[];
  available_folders?: Record<string, string[]>;
};

export type ArchiveEntry = {
  entry: string;
  bytes: number;
  content_type: string;
};

export type ArchiveManifest = {
  key: string;
  store: ImageStoreName;
  archive_bytes: number;
  entries: ArchiveEntry[];
  images: number;
};

/** Direct URL for one image inside one archive. Safe in an <img src>.
 *
 *  `store` is required, not defaulted: the two buckets have separate
 *  credentials and a key alone does not say which it belongs to, so a wrong or
 *  omitted store is a 403 rather than a wrong picture. */
export const unitImageUrl = (
  store: ImageStoreName,
  key: string,
  entry: string,
) =>
  apiUrl(
    `/process/images/file?store=${encodeURIComponent(store)}` +
      `&key=${encodeURIComponent(key)}` +
      `&entry=${encodeURIComponent(entry)}`,
  );

type State = "idle" | "loading" | "ready" | "error" | "unsupported" | "off";

/**
 * Which units the inspection cell photographed for this product and day.
 *
 * ONE request per product, not one per unit: the response is a whole
 * sfc -> archives map, so the NC log can badge every row it has an image for
 * without a request each. The images themselves are fetched only when someone
 * opens a unit.
 *
 * Deliberately NOT joined to the NC log's failed units. The two systems do not
 * mean the same thing by failure (see UnitImages.retries), so a unit can have
 * images and no NC row, or an NC row and no images. Both are normal.
 *
 * This map is also FRESHER than the log beside it — archives land within about
 * two minutes of the test, while a disposition reaches the NC log a median of
 * 28 minutes later. So expect `units` here to exceed what the log shows, and do
 * not treat the difference as missing data.
 *
 * `null` step or item idles without fetching, so the caller can keep it mounted.
 */
export const useProductImages = (
  step: string | null,
  item: string | null,
  businessDate?: string | null,
  /** Target-sheet product name, e.g. "AHEGG Z". AXI only, and only to resolve a
   *  folder — it names most folders after the product ("AHEGG.Z") rather than
   *  the item code. Harmless to pass for the AVI steps, which ignore it. */
  productName?: string | null,
) => {
  const [data, setData] = useState<ProductImagesResponse | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!step || !item) {
      setState("idle");
      setData(null);
      return;
    }
    // Cheaper than a 404 round-trip, and it keeps the badge column from
    // flickering in on steps that will never have one.
    if (!IMAGE_STEPS[step]) {
      setState("unsupported");
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchImages = async () => {
      try {
        const params = new URLSearchParams();
        if (businessDate) params.set("business_date", businessDate);
        if (productName) params.set("product_name", productName);
        const qs = params.toString();
        const res = await fetch(
          apiUrl(
            `/process/${encodeURIComponent(step)}/products/` +
              `${encodeURIComponent(item)}/images${qs ? `?${qs}` : ""}`,
          ),
        );

        // 503 = the image store is not configured, or the API cannot reach the
        // on-prem gateway (it resolves only inside the plant network). Held
        // apart from "error" so the UI can stay silent rather than showing a
        // failure for something the operator cannot act on.
        if (res.status === 503) {
          if (cancelled) return;
          setState("off");
          setData(null);
          return;
        }
        // 404 = this step has no camera. A real answer, not a fault.
        if (res.status === 404) {
          if (cancelled) return;
          setState("unsupported");
          setData(null);
          return;
        }
        if (!res.ok) throw new Error(`Failed to fetch images for ${item}`);

        const json: ProductImagesResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Error fetching unit images for ${step}/${item}:`, err);
        setError("Could not load inspection images.");
        setState("error");
      }
    };

    setState("loading");
    setData(null);
    fetchImages();
    return () => {
      cancelled = true;
    };
  }, [step, item, businessDate, productName]);

  return { data, state, error };
};

/**
 * What is inside one archive.
 *
 * Read from the zip rather than assumed, because the layout varies by product
 * and there is no rule to derive it from: one product writes a single
 * `{SFC}_0.png` of ~41 KB, another writes five files named `0.jpg`..`4.jpg`
 * totalling ~900 KB. Entry name, count, format and size all differ, so the
 * viewer has to ask.
 */
export const useArchiveManifest = (
  store: ImageStoreName,
  key: string | null,
) => {
  const [data, setData] = useState<ArchiveManifest | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!key) {
      setState("idle");
      setData(null);
      return;
    }
    let cancelled = false;

    const fetchManifest = async () => {
      try {
        const res = await fetch(
          apiUrl(
            `/process/images/archive?store=${encodeURIComponent(store)}` +
              `&key=${encodeURIComponent(key)}`,
          ),
        );
        if (!res.ok) throw new Error(`Failed to read archive ${key}`);
        const json: ArchiveManifest = await res.json();
        if (cancelled) return;
        setData(json);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Error reading archive ${key}:`, err);
        setState("error");
      }
    };

    setState("loading");
    setData(null);
    fetchManifest();
    return () => {
      cancelled = true;
    };
  }, [store, key]);

  return { data, state };
};

export type ProductImagesQuery = ReturnType<typeof useProductImages>;
