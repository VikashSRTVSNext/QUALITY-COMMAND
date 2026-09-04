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
};

export type UnitArchive = {
  /** S3 key. Opaque to the UI — pass it straight back to the image endpoints. */
  key: string;
  sfc: string;
  /** PASS or FAIL, but see UnitImages.retries — FAIL is a CAMERA verdict. */
  result: string;
  captured_at: string | null;
  /** True when the time came from the upload rather than the filename. About
   *  two thirds of archives carry no timestamp in their name, so this is the
   *  common case, not an edge one. Accurate to a couple of minutes. */
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
  item: string;
  /** Item code minus its revision suffix — the bucket's folder name. */
  item_folder: string;
  business_date: string;
  window: { from: string; to: string };
  prefixes: string[];
  units: number;
  archives: number;
  /** Units the camera rejected at least once. Exists nowhere else in the
   *  dashboard: MES records every one of them as a clean pass. */
  retried_units: number;
  /** Archives found in the two calendar folders but belonging to the adjacent
   *  production day. Reported rather than hidden so a supervisor checking the
   *  folder by hand does not think rows went missing. */
  outside_window: number;
  by_sfc: Record<string, UnitImages>;
};

export type ArchiveEntry = {
  entry: string;
  bytes: number;
  content_type: string;
};

export type ArchiveManifest = {
  key: string;
  archive_bytes: number;
  entries: ArchiveEntry[];
  images: number;
};

/** Direct URL for one image inside one archive. Safe in an <img src>. */
export const unitImageUrl = (key: string, entry: string) =>
  apiUrl(
    `/process/images/file?key=${encodeURIComponent(key)}` +
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
        const qs = businessDate
          ? `?business_date=${encodeURIComponent(businessDate)}`
          : "";
        const res = await fetch(
          apiUrl(
            `/process/${encodeURIComponent(step)}/products/` +
              `${encodeURIComponent(item)}/images${qs}`,
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
  }, [step, item, businessDate]);

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
export const useArchiveManifest = (key: string | null) => {
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
          apiUrl(`/process/images/archive?key=${encodeURIComponent(key)}`),
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
  }, [key]);

  return { data, state };
};

export type ProductImagesQuery = ReturnType<typeof useProductImages>;
