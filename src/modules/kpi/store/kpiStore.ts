import { create } from 'zustand';
import { KpiStore } from '../types';

export const useKpiStore = create<KpiStore>((set) => ({
  planVsActual: { plan: 12500, actual: 10842 },
  hourlyAchievement: { actual: 1205, target: 1150 },
  firstPassYield: { unit: 99.2, module: 97.6 },
  factoryWip: { total: 2340, raw: 1256, semi: 640, finished: 450 },
  readyToShip: { lots: 132, totalUnits: 6600 },
  headcount: { total: 352, male: 247, female: 91, contractors: 8 },
  downtime: { minutes: 42, diffPercentage: 18.3 },
  conditions: { temp: 27.6, humidity: 56 },

  updateKpi: (data) => set((state) => ({ ...state, ...data })),
}));
