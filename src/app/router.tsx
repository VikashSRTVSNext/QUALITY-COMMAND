import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './AppShell';
import { dashboardRegistry } from '../core/registry/dashboards';
import { productionDashboard } from '../dashboards/production/config';
import { qualityDashboard } from '../dashboards/quality/config';

// Drill-down pages are lazily loaded like the dashboards.
const LineDetailPage = React.lazy(() => import('../dashboards/production/LineDetailPage'));
const DefectDetailPage = React.lazy(() => import('../dashboards/quality/DefectDetailPage'));

// Register dashboards once. New dashboards: add a config + register here.
dashboardRegistry.register(productionDashboard);
dashboardRegistry.register(qualityDashboard);

const Loading = () => (
  <div className="w-full min-h-screen flex items-center justify-center bg-[#08111a] text-[#52607f]">
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

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/quality" replace /> },
      ...dashboardRoutes,
      { path: '/production/line/:lineId', element: lazy(<LineDetailPage />) },
      { path: '/quality/defect/:defectCode', element: lazy(<DefectDetailPage />) },
      { path: '*', element: <Navigate to="/quality" replace /> },
    ],
  },
]);

export default router;
