# Standalone demo mode

A fixture-backed build of this app that runs with **no backend, no database and
no network access**. Same components, same routing, same TypeScript contracts —
only the transport is replaced.

```bash
npm run demo:fixtures     # generate public/demo-data (needed once, already committed)
npm run dev:demo          # dev server on :3000, demo transport installed
npm run build:demo        # validate -> palette -> tsc -> vite build --mode demo  ->  dist-demo/
npm run preview:demo      # serve dist-demo/
npm run demo:validate     # fixture invariants (add --deep for the determinism check)
```

The build artifact in `dist-demo/` is fully static: any file server will do.

---

## 1. Architecture

```
 React components (UNCHANGED)
        │  fetch() / new EventSource()
        ▼
 ┌──────────────────────────────────────────────┐
 │ installDemoTransport.ts                      │  overrides globalThis.fetch
 │   · fetch shim      → demoApi route table    │  and globalThis.EventSource
 │   · EventSource     → DemoEventSource        │  before React mounts
 └──────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
 handlers/*.ts                   eventSimulator.ts
 (MSW-shaped, pure)              (one shared, deterministic replay)
        │                              │
        ▼                              │
 aggregations.ts  ── filter / sum / sort / paginate
        │                              │
        ▼                              ▼
 fixtureStore.ts  ── manifest, date re-anchoring, typed accessors
        │
        ▼
 fixtureLoader.ts ── fetch one partition, cache it, de-duplicate in flight
        │
        ▼
 public/demo-data/*.json   (1,267 partitions, generated, deterministic)
```

**Why a transport shim and not a service-layer refactor.** Every REST call in
this app resolves its host through `apiUrl()` in `src/core/api/config.ts`, and
all three streams through `DASHBOARD_STREAM_URLS` in the same file. That is
already a single choke point, so replacing the transport needs **zero changes to
the ~20 data hooks**. Rewriting those call sites to accept an injected client
would touch every one of them and risk regressing the live app, for no benefit
the demo can observe.

**This is not MSW.** It does not intercept at the network layer — no request is
made, so nothing appears in the browser's network panel. MSW can replace it
later without touching a component; see section 8.

### The two things worth understanding

**Dates slide, values don't.** `rangeError` in `dashboardFilters.ts` refuses any
day outside the last 30 ending *today*, and `rangeLatest()` reads the real
clock. A fixture set stamped with fixed dates would therefore be rejected by its
own date picker once it aged out. So the generator anchors a scenario to a fixed
day and `fixtureStore` shifts every date label by `today − anchorDate`. Metric
values never change; only their position on the calendar does. Verified: the
picker's bounds come back as exactly the fixture window.

**Nothing is loaded until it is asked for.** First paint reads 7 partitions
(~174 KB) out of 1,267. A 7-day range query plus a three-level drill-down brings
that to 41. The 19 MB-plus set is never in React state and never fully in
memory.

---

## 2. Files added

| File | Purpose |
|---|---|
| `scripts/lib/rng.mjs` | Seeded PRNG (mulberry32 + FNV-1a), weighted picks, exact-sum splits |
| `scripts/lib/clock.mjs` | Generator-side production-day and shift arithmetic |
| `scripts/lib/domain.mjs` | Products, steps, lines, testers, NC codes, shift weights |
| `scripts/generate-demo-fixtures.mjs` | Writes the whole fixture set |
| `scripts/validate-demo-fixtures.mjs` | 48,544 invariant assertions; first step of `build:demo` |
| `src/demo/types.ts` | Demo-layer types; re-exports the shipped contracts rather than redefining them |
| `src/demo/demoClock.ts` | Runtime date re-anchoring (`reanchor`) and production-day rules |
| `src/demo/fixtureLoader.ts` | Partition fetch, cache, in-flight de-duplication |
| `src/demo/fixtureStore.ts` | Manifest, window resolution, typed partition accessors |
| `src/demo/aggregations.ts` | Shared filter/roll-up/sort/paginate semantics |
| `src/demo/demoApi.ts` | Route table + matcher. **The MSW migration surface.** |
| `src/demo/handlers/dashboard.ts` | `/dashboard/*`, `/yield-recommendation/*` |
| `src/demo/handlers/process.ts` | `/process/*` drill-downs, DPMOI, screws, images |
| `src/demo/handlers/alerts.ts` | Alert acknowledgement, shift report |
| `src/demo/handlers/dashboard-report.ts` | Alert rows flattened for the report |
| `src/demo/handlers/legacy.ts` | Backstop for the legacy axios endpoints |
| `src/demo/installDemoTransport.ts` | Installs the shim; `bootstrapDemo()` |
| `src/demo/eventSimulator.ts` | One shared, deterministic snapshot replay |
| `src/demo/DemoEventSource.ts` | EventSource-compatible adapter |
| `.env.demo` | `VITE_DATA_MODE=demo` + the `.invalid` sentinel host |

**Files modified — three, all additive:**

- `src/main.tsx` — a guarded `bootstrapDemo()` branch. Vite inlines
  `VITE_DATA_MODE` as a literal, so in the live build this collapses to
  `if ('' === 'demo')` and both the branch and its dynamic import are dropped.
- `vite.config.ts` — now a function of `mode`; adds `publicDir` and
  `build.outDir`. The live values are unchanged.
- `package.json` — five new scripts. No new dependencies.

**No backend, database, migration, API or production service was modified.** The
only files touched outside `src/demo/`, `scripts/` and `public/demo-data/` are
the three above.

---

## 3. Endpoint → fixture map

Every path is relative to `API_BASE_URL`. `{day}` is a generator-side date;
`fixtureStore` translates today's dates into it.

| Method | Path | Fixture | Notes |
|---|---|---|---|
| GET | `/dashboard/product-yield` | `summaries/product-yield-{day}.json` | No dates → snapshot shape, **`meta` omitted entirely**. Dates → rows collapsed per product with `days` |
| GET | `/dashboard/kpis` | `summaries/kpis-{day}.json` (+ product-yield under a product filter) | Counts summed, percentage taken once. `customer_audit` null under a product filter |
| GET | `/dashboard/process-performance` | `summaries/process-performance-{day}.json` | `trend: null` on a range. Line filter narrows to that line's cards |
| GET | `/dashboard/process-filter-options` | `summaries/process-filter-options.json` | 12 steps + `KPI` |
| GET | `/dashboard/products` | `summaries/products-{day}.json` | Unioned across the window, volume summed |
| GET | `/dashboard/safety` | `summaries/safety.json` | |
| GET | `/dashboard/eri` | `summaries/eri.json` | |
| GET | `/yield-recommendation/current-day` | `summaries/yield-recommendation.json` | |
| GET | `/process/{step}/products` | `stations/{step}/products-{day}.json` | Sorted and paged server-side; unknown `sort` → 400 |
| GET | `/process/{step}/products/{item}/testers` | `stations/{step}/testers-{day}.json` | **501** for unmapped steps (e.g. `SMT_DEFECTS`) |
| GET | `/process/{step}/products/{item}/defects` | `events/{step}/defects-{day}.json` | Three shapes: MES NC log, SMT log, SPI pad log |
| GET | `/process/{step}/products/{item}/images` | generated | 404 for steps with no camera |
| GET | `/process/images/file` | generated SVG | Returned as a real `Blob` |
| GET | `/process/images/archive` | generated | |
| GET | `/process/dpmoi/breakdown` | `events/dpmoi/{day}.json` | |
| GET | `/process/dpmoi/detail` | `events/dpmoi/{day}.json` + AXI NC log | **404** "No DPMOI row for this board on this day." |
| GET | `/process/screw-defects/breakdown` | `events/screw-defects/{day}.json` | |
| GET | `/process/screw-defects/positions` | `events/screw-defects/{day}.json` | **404** "No screws driven at this station on this day." |
| GET | `/alerts/ack/detail` | `events/alerts-ack.json` | Tokens: `demo-token-open`, `demo-token-acked` |
| POST | `/alerts/ack/reply` | in-memory | Session-only; resets on reload |
| GET | `/alerts/shift-report` | `events/attention-{day}.json` | **CSV, not xlsx** — see limitations |
| GET | `/quality/defects/:code` | app's own mocks | Legacy axios layer |

### Parameter → fixture resolution

| Parameter | Effect |
|---|---|
| *(no dates)* | Current production day only — the snapshot path |
| `date_from` **or** `date_to` alone | That single day, **not** an open-ended range |
| both | Inclusive span, clamped to the fixture window |
| `business_date` | Single day; **ignored** when either range bound is present |
| `shift=A\|B\|C` | Reads `by_shift`; `shift=D` / absent reads the stored day row |
| `level=UNIT\|TRX\|PA` | Matched on `sub_module`, with TRX by exclusion |
| `product=` (repeatable) | Full dotted code, base code before the dot, or display name |
| `line=` (repeatable) | Narrows `process-performance` to that line's cards |
| `sort` / `order` / `page` / `page_size` | Server-side; worst-first by default |

---

## 4. SSE map

Three streams, replayed from `realtime/snapshots.json` (9 frames).

| Stream URL suffix | `DemoSnapshotFrame.stream` | Payload keys |
|---|---|---|
| `/dashboard/stream/process-performance` | `processPerformance` | `meta`, `process_performance` |
| `/dashboard/stream/product-yield` | `productYield` | `meta`, `product_yield` |
| `/dashboard/stream/other` | `other` | `meta`, `kpis`, `hftpy`, `shop_floor`, `attention`, `safety`, `sustainability`, `customer_complaints`, `eri`, `ci` |

- Event name `snapshot`, with `onmessage` as the fallback the app also wires.
  **A named `snapshot` event never also fires `onmessage`** — native EventSource
  doesn't, and the app points both at the same consumer, so firing both would
  process every payload twice.
- Frame 0 of each stream is at `t=0`, so nothing renders empty while waiting for
  an interval. Later frames are 6 s apart and the playback loops.
- Control: `startSimulator`, `stopSimulator`, `pauseSimulator`,
  `resumeSimulator`, `setSimulatorSpeed(n)`, `simulatorState()`.
  Speed also from `VITE_DEMO_SSE_SPEED`.
- **One simulator, shared.** Connections subscribe and unsubscribe; the timer
  starts on the first subscriber and stops on the last. This is what makes
  StrictMode safe — a per-connection timer would interleave two playbacks and
  deliver every frame twice.

---

## 5. Production-call safety

1. **Unmatched URLs throw.** `DemoRouteMissing` is raised and logged rather than
   falling through to the network — a demo that silently reached out would look
   fine until it was shown on a machine with no plant access.
2. **The host doesn't resolve.** `.env.demo` points the API at
   `http://demo.invalid/...` (`.invalid` is reserved, RFC 2606), so even a
   bypassed shim fails DNS instead of reaching a real service.
3. **No UI switch to a real backend exists.**
4. **Fixtures stay out of the live build.** `publicDir` is `false` outside demo
   mode, so the 35 MB set cannot ride along in `dist/`.

Measured: **0 requests to the sentinel host** across a full session exercising
all 15 tabs, 12 drill-downs, range filtering, and the acknowledgement flow.

---

## 6. Test results — actually run

Everything below was executed. Nothing here is projected.

### Fixture validation — pass
```
npm run demo:validate -- --deep
  · 1266 files, 35.24 MB on disk
  · 1,792 yield rows, 13,067 NC records checked
  · determinism: regenerated and compared sha256 over every file
Demo fixtures OK — 48,544 assertions passed.
```
Covers: manifest ↔ disk, production-day boundary vectors against the app's own
rule, `A+B+C` reconciling with the separately-stored `D` row, `fpy` derived from
counts, `spy ≥ fpy`, KPI summaries matching the yield rows they came from,
weighted ≠ naive mean on 29 of 30 days, newest day unaudited, process-performance
day row = sum of shift rows, trend buckets shift-tagged, level-two reconciling
with level-one, every timestamp inside its own production day with no timezone
suffix, and byte-identical regeneration.

### Typecheck — pass
`npx tsc --noEmit` → exit 0, with all 14 `src/demo` files in the program
(`strict`, `noUnusedLocals`, `noUnusedParameters`).

### Demo build — pass
`npm run build:demo` → `dist-demo/`, 2,317 modules, 14.0 s. The demo layer lands
in its own dynamic chunk, `installDemoTransport-*.js`, 31.65 kB (11.36 kB gzip).

### Live build unaffected — verified by comparison
Built the base commit `5f653bb` in a separate worktree and diffed:
- 15 files in both; identical names; **identical CSS hash**
- `assets/index.js` 339,300 → 339,277 bytes (−23)
- `index.html` differs only by the JS hash and one blank line
- `dist/demo-data` does not exist; `dist/` total 3.22 MB
- grep of the live bundle for `bootstrapDemo`, `DemoEventSource`, `demo-data`,
  `installDemoTransport` → **no matches**, confirming dead-code elimination

### Browser verification — pass
Dev server, Chromium, React StrictMode on.

| Check | Result |
|---|---|
| Dashboard first paint | All 12 process tiles with values and sparklines, 4 KPI cards, heat map, yield table, Attention Center, safety, sustainability, ERI |
| All 15 level tabs | Render rows: UNITS 6, TRX 5, PA 5, SPI 10, AXI 12, SMT 12, THERMAL 12, BURN-IN 12, LBTS 12, RTWP 12, IP 12, OTA 12, AUTO OGI 12, SCREW 3, DPMOI 30 |
| All 12 drill-downs | Open level two with real rows (testers 1–3 per step, SMT breakdown 22, SPI pad log 6, screw positions 12) |
| Level three (NC log) | Opens from a tester row |
| `no_target` product | Renders "No Target" / "—", not a red zero |
| FPY vs counts | Exact in every row, e.g. 171 tested / 8 failed → 95.32% |
| Date range via picker | Bounds `2026-09-21 … 2026-10-20` = fixture window; 7-day range summed correctly (AREA TRX 1,592 vs ~395 for one day) |
| Product filter on KPIs | TRX product → unit cards `null` (not 0), module cards populated, audit nulled |
| Line filter | SMT line → 3 cards, MAC line → 6, both → 9; rework/sample steps correctly excluded |
| Ack flow | 422 comment/cause/snooze, 404 unknown token, 409 already answered, 200 success, 409 on replay, detail reflects state |
| Error paths | 400 reversed range, 400 range > 30 days, 400 unknown sort, 501 unmapped testers — all with the backend's wording |
| Defect detail route | Renders |
| Console | **0 errors, 0 warnings** on a clean run |
| StrictMode duplicate events | `simulatorState().subscribers === 3` — one per stream, not 6. A leaked subscription would double it |
| Timer cleanup | Subscribers return to 3 after navigation; `close()` is idempotent |
| Reload determinism | Same tab's rows byte-identical across reload (`identical: true`); process tiles identical |

### Measured performance — real numbers
Worst case is the full 30-day span, cold cache:

| Query | Cold | Warm |
|---|---|---|
| 30-day product-yield | 232 ms | 1 ms |
| 30-day KPIs | 352 ms | 2 ms |
| 30-day process-performance | 269 ms | — |
| 30-day products | 136 ms | — |
| 30-day AXI step products | 146 ms | — |

| Metric | Value |
|---|---|
| Fixture set on disk | 35.24 MB, 1,267 files, 57,622 rows |
| Partitions at first paint | 7 (~174 KB) |
| After range query + 3-level drill-down | 41 of 1,267 (3.2%) |
| Slowest single partition fetch | 28 ms |
| JS heap, steady state | 36–50 MB |

### What was NOT tested
- No automated component or unit tests were added — the repo has no test
  framework and the brief excluded adding one. All UI results above are manual
  browser verification, driven through the real transport.
- Production build not served from a static host end-to-end; only
  `vite build --mode demo` and the dev server were exercised.
- Not tested on Firefox or Safari.
- `--volume` above 1 was never generated, so the 100k–1M row claim is a design
  property (partitioning + lazy loading + no full-set state), **not a measured
  one**. See limitations.

---

## 7. Limitations and known gaps

1. **The shift report is CSV, not xlsx.** The real endpoint returns a workbook.
   Building one needs a spreadsheet library and the brief excluded new
   dependencies, so the demo serves CSV and names the download `.csv` — rather
   than handing over a CSV wearing an `.xlsx` extension, which would fail to
   open and look like a corrupt file. The rest of the flow is real: same 400s,
   same error envelope, real blob, parsed `Content-Disposition`.
2. **Scale is designed for, not measured at, 1M rows.** The committed set is
   57,622 rows / 35 MB. The mechanisms that make a larger set work — per-(kind,
   day) partitioning, precomputed summaries, a shared cache, server-side paging,
   nothing held in React state — are all in place and exercised, but the honest
   statement is that only ~58k rows have actually been run. `--volume 20` would
   generate ~1.1M rows; the likely first pressure point is the unbounded
   partition cache in `fixtureLoader.ts`.
3. **Inspection images are generated SVG placeholders**, not photographs. Layout,
   paging and zoom work; the pixels are synthetic.
4. **Acknowledgements do not persist.** `/alerts/ack/reply` writes to a
   module-level map and resets on reload. There is no fixture to write back to
   and faking persistence would misrepresent what the demo is.
5. **Only the anchor day has SSE frames.** The snapshot is "today" by
   definition, so there is nothing to replay for a historical day.
6. **The date maths is duplicated** between `scripts/lib/clock.mjs` and
   `src/demo/demoClock.ts`, because the generator runs under bare `node` and
   cannot import TypeScript. The validator asserts both satisfy the same
   production-day vectors, so a silent drift fails the build.
7. **`npm run lint` fails repo-wide** with "ESLint couldn't find a configuration
   file". Pre-existing on `deployment/main`, unrelated to this work, not fixed
   here.
8. **The fixture set is committed** (35 MB). Keeping it in git is what makes the
   demo clone-and-run; regenerating is one command if that trade-off is
   unwanted.

---

## 8. Migrating to MSW

Nothing in `src/` outside `src/demo/` changes. The handlers are already
MSW-shaped: `(url, request, params) => { status, body, blob?, headers? }`.

**1. Install**
```bash
npm i -D msw
npx msw init public/ --save
```

**2. Adapt the route table** — `src/demo/mswHandlers.ts`:
```ts
import { http, HttpResponse } from 'msw';
import { DEMO_ROUTES } from './demoApi';
import { apiUrl } from '../core/api/config';
import { LEGACY_REST_BASE_URL } from '../core/api/config';

export const handlers = DEMO_ROUTES.map((route) => {
  const url = route.base === 'legacy'
    ? `${LEGACY_REST_BASE_URL}${route.path}`
    : apiUrl(route.path);

  const resolver = async ({ request, params }: any) => {
    const { status, body, blob, headers } =
      await route.handler(new URL(request.url), request, params as any);
    return blob
      ? new HttpResponse(blob, { status, headers })
      : HttpResponse.json(body, { status, headers });
  };

  return route.method === 'POST' ? http.post(url, resolver) : http.get(url, resolver);
});
```
MSW uses the same `:param` syntax, so every pattern transfers unchanged.

**3. Replace the fetch install** in `installDemoTransport.ts` — delete
`installFetch()` and start the worker instead:
```ts
const { setupWorker } = await import('msw/browser');
const { handlers } = await import('./mswHandlers');
await setupWorker(...handlers).start({
  serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  onUnhandledRequest: 'error',   // keeps guard rail #1
});
```

**4. Keep three things as they are.**
- `installEventSource()` stays. MSW does not intercept EventSource; the
  simulator and `DemoEventSource` are still required.
- `fixtureLoader.ts` captures the native `fetch` at module load. Under MSW that
  matters even more: fixture requests must not be intercepted. Add
  `http.get('*/demo-data/*', () => passthrough())` if `onUnhandledRequest` is
  `'error'`.
- `bootstrapDemo()` must still `await` before React mounts, so the manifest is
  loaded and the worker is active before the first request.

**5. What you gain / lose.** Gain: requests become real and visible in the
network panel, and the same handlers work in Node for tests. Lose: a service
worker must be registered and served, which adds a moving part to a build whose
selling point is that it is static.

---

## 9. Regenerating

```bash
node scripts/generate-demo-fixtures.mjs \
  --days 30 --volume 1 --seed qcc-demo-v1 --out public/demo-data
```

| Flag | Default | Effect |
|---|---|---|
| `--days` | `30` | Production days. 30 is the picker's ceiling |
| `--volume` | `1` | Multiplier on every board count. Raise to stress-test |
| `--seed` | `qcc-demo-v1` | Changes every number deterministically |
| `--anchor` | today | The scenario's last day |
| `--out` | `public/demo-data` | |

Same seed → byte-identical output, asserted by `demo:validate --deep`.
