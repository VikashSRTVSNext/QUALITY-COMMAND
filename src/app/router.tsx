import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './AppShell';
import { dashboardRegistry } from '../core/registry/dashboards';
import { qualityDashboard } from '../dashboards/quality/config';

// Drill-down pages are lazily loaded like the dashboards.
const DefectDetailPage = React.lazy(() => import('../dashboards/quality/DefectDetailPage'));

// The landing page for an Attention Center alert email. Not a dashboard: it is
// opened cold from a mail client, by someone who is not signed in, and answers
// exactly one alert. Registered here rather than in the dashboard registry so
// nothing about it depends on the dashboard chrome.
const AlertAckPage = React.lazy(() => import('../components/alerts/AlertAckPage'));

// Register dashboards once. New dashboards: add a config + register here.
dashboardRegistry.register(qualityDashboard);

const Loading = () => (
  <div className="w-full min-h-screen flex items-center justify-center bg-page text-ink-dim">
    Loading…
  </div>
);

const lazy = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

// Build dashboard routes from the registry; drill-down children are declared
// alongside their parent dashboard.
const dashboardRoutes = dashboardRegistry.all().map((d) => {
  const Page = d.page;
  return { path: d.path, element: lazy(<Page />) };
});

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { path: '/', element: <Navigate to="/quality" replace /> },
        ...dashboardRoutes,
        { path: '/quality/defect/:defectCode', element: lazy(<DefectDetailPage />) },
        // BEFORE the catch-all, or a mailed link would be redirected to the
        // dashboard and the alert would never open. This is a cold deep link —
        // it has to work on first load, not only via client-side navigation.
        { path: '/alerts/ack', element: lazy(<AlertAckPage />) },
        { path: '*', element: <Navigate to="/quality" replace /> },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);

export default router;
