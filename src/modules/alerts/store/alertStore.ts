import { create } from 'zustand';

export interface Alert {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  module: string;
  message: string;
  recommendation: string;
  timeAgo: string;
  impact: string;
  acknowledged: boolean;
}

interface AlertStore {
  alerts: Alert[];
  activeCount: number;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (alertId: string) => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [
    {
      id: '1',
      type: 'CRITICAL',
      module: 'SMT',
      message: 'SMT Line 06 - Extended Downtime',
      recommendation: 'Rebalance production to adjacent SMT Line 05.',
      timeAgo: '2m ago',
      impact: '-850 units / shift',
      acknowledged: false,
    },
    {
      id: '2',
      type: 'WARNING',
      module: 'AOI',
      message: 'AOI Camera Calibration Overdue',
      recommendation: 'Schedule preventative calibration during next shift break.',
      timeAgo: '1h 12m ago',
      impact: 'Quality risk: moderate',
      acknowledged: false,
    },
    {
      id: '3',
      type: 'INFO',
      module: 'Customer Audit',
      message: 'Customer Audit Queue Growing',
      recommendation: 'Prioritize inspection queue - assign additional inspector.',
      timeAgo: '2h 10m ago',
      impact: 'PSI delay risk',
      acknowledged: false,
    },
  ],
  activeCount: 3,

  addAlert: (alert) => set((state) => {
    const updated = [alert, ...state.alerts].slice(0, 100);
    return {
      alerts: updated,
      activeCount: updated.filter(a => !a.acknowledged).length,
    };
  }),

  acknowledgeAlert: (alertId) => set((state) => {
    const updated = state.alerts.map(a => 
      a.id === alertId ? { ...a, acknowledged: true } : a
    );
    return {
      alerts: updated,
      activeCount: updated.filter(a => !a.acknowledged).length,
    };
  }),

  clearAll: () => set({ alerts: [], activeCount: 0 }),
}));
