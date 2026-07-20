import React from 'react';
import type { DashboardConfig } from '../../core/registry/dashboards';

export const productionDashboard: DashboardConfig = {
  id: 'production',
  path: '/production',
  title: 'Plant Overview',
  navLabel: 'PLANT OVERVIEW',
  minRole: 'operator',
  page: React.lazy(() => import('./ProductionPage')),
};
