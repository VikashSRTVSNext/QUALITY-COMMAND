import React from 'react';
import type { DashboardConfig } from '../../core/registry/dashboards';

// Shared helper: turn a defect display name into its route code.
// Mirrors the transform in core/api/mocks.ts so links + fixtures stay in sync.
export const defectCode = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

export const qualityDashboard: DashboardConfig = {
  id: 'quality',
  path: '/quality',
  title: 'Quality Command Center',
  navLabel: 'QUALITY CENTER',
  minRole: 'operator',
  page: React.lazy(() => import('./QualityPage')),
};
