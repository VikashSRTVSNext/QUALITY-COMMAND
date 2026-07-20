import React from 'react';

// A dashboard is declarative: an id, route, title, required role, and the
// page component that composes widgets. Adding a new dashboard = one entry here
// plus its page/config under src/dashboards/<id>/. Drill-down routes are nested
// under each dashboard's route (see app/router.tsx).
export interface DashboardConfig {
  id: string;
  path: string;                    // top-level route, e.g. "/production"
  title: string;
  navLabel: string;                // shown in the header nav
  minRole: 'operator' | 'supervisor' | 'director';
  page: React.LazyExoticComponent<React.ComponentType<any>>;
}

class DashboardRegistry {
  private registry = new Map<string, DashboardConfig>();

  public register(config: DashboardConfig): void {
    if (this.registry.has(config.id)) {
      console.warn(`Dashboard "${config.id}" already registered. Overwriting.`);
    }
    this.registry.set(config.id, config);
  }

  public get(id: string): DashboardConfig | undefined {
    return this.registry.get(id);
  }

  public all(): DashboardConfig[] {
    return Array.from(this.registry.values());
  }
}

export const dashboardRegistry = new DashboardRegistry();
