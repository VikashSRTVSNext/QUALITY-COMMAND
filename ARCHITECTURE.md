# Factory Command Center — Architecture

> Target architecture for a multi-dashboard command center with drill-down views.
> Dashboards today: **Production** (Plant Overview) and **Quality**. More coming.

## Principles

1. **Dashboards are compositions, not pages.** A dashboard = a declarative config
   (which widgets, which data source, where each drills to) + reusable widgets.
   Adding dashboard #3 should be *one config file + existing widgets*, not a new 1,500-line file.
2. **The URL is the state.** Routing (incl. drill-down) is driven by `react-router`.
   Drill-downs are nested routes → deep-linkable, shareable, refresh-safe, back-button works.
3. **One data layer.** Server/telemetry data flows through **TanStack Query**; live
   WebSocket updates are pushed into the same query cache. UI-only state lives in **zustand**.
4. **Swap mock → real in one place.** Every dashboard reads from a query hook backed by a
   fetcher in `core/api/endpoints`. Today those fetchers return mock data; flip a flag /
   swap the fetcher body to hit the real backend — no component changes.

## Folder structure

```
src/
  app/
    providers.tsx        # QueryClientProvider + StrictMode wrappers
    router.tsx           # route tree (dashboards + nested drill-down routes)
    AppShell.tsx         # persistent chrome (Header) + <Outlet/>
  core/
    api/
      httpClient.ts      # axios instance (existing)
      queryClient.ts     # TanStack QueryClient singleton
      endpoints.ts       # typed fetchers — the ONLY place mock⇄real is decided
    websocket/
      SocketManager.ts   # existing, hardened
      socketBridge.ts    # pushes socket messages into the query cache
    registry/
      dashboards.ts      # DashboardConfig type + registered dashboards
  data/
    queries/             # useX() hooks wrapping useQuery, keyed for drill-down
  widgets/               # reusable, prop-driven, self-fetching UI blocks
    Sparkline.tsx        # single shared implementation (kills the copy-paste)
    ...
  dashboards/
    production/
      config.ts          # DashboardConfig
      ProductionPage.tsx # composes widgets
      LineDetailPage.tsx # drill-down: /production/line/:lineId
    quality/
      config.ts
      QualityPage.tsx
      DefectDetailPage.tsx # drill-down: /quality/defect/:defectCode
  components/, modules/, theme/   # existing (migrate into widgets/ over time)
```

## Routing & drill-down

| Route | View |
|-------|------|
| `/` | redirect → `/production` |
| `/production` | Production dashboard |
| `/production/line/:lineId` | **Drill-down** — full-page line detail (back to dashboard via breadcrumb) |
| `/quality` | Quality dashboard |
| `/quality/defect/:defectCode` | **Drill-down** — full-page defect root-cause detail |

Drill-down chosen style: **full page** with breadcrumb back. A widget triggers
`navigate(config.drillTo(item))`; the detail route reads the param and fetches via
`useQuery(['defect', defectCode])`.

## Data layer contract

```ts
// core/api/endpoints.ts — the swap point
export const endpoints = {
  productionLines: () => fetchJson<LineMetric[]>('/production/lines'),
  lineDetail: (id) => fetchJson<LineDetail>(`/production/lines/${id}`),
  qualityKpis: () => fetchJson<QualityKpi[]>('/quality/kpis'),
  defectDetail: (code) => fetchJson<DefectDetail>(`/quality/defects/${code}`),
};
// USE_MOCKS=true → fetchJson returns local fixtures; false → httpClient hits the API.
```

- **Fetched data:** `useQuery` with `refetchInterval` for polling dashboards.
- **Live data:** `socketBridge` calls `queryClient.setQueryData(key, updater)` so a
  WebSocket tick updates the same cache the components already read.
- **UI state** (selected shift, filters, open panels): zustand stores under each feature.

## Migration status

- [x] Phase 0 — Security fixes (see SECURITY-REPORT.md)
- [x] Phase 1 — Router foundation (react-router, AppShell, nested routes)
- [x] Phase 2 — Data layer (QueryClient, endpoints, mock fetchers, socket bridge)
- [x] Phase 3 — Dashboard registry + config-driven dashboards
- [x] Phase 4 — Shared widget kit (Sparkline extracted; more to follow)
- [x] Phase 5 — Drill-down full-page views (line detail, defect detail)
- [ ] Ongoing — migrate remaining inline chart/SVG code into `widgets/`, add real API
