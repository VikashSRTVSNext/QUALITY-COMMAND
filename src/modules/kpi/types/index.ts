export interface KpiState {
  planVsActual: { plan: number; actual: number };
  hourlyAchievement: { actual: number; target: number };
  firstPassYield: { unit: number; module: number };
  factoryWip: { total: number; raw: number; semi: number; finished: number };
  readyToShip: { lots: number; totalUnits: number };
  headcount: { total: number; male: number; female: number; contractors: number };
  downtime: { minutes: number; diffPercentage: number };
  conditions: { temp: number; humidity: number };
}
export interface KpiStore extends KpiState {
  updateKpi: (data: Partial<KpiState>) => void;
}
