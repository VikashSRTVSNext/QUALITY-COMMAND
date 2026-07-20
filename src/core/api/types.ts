// Domain types shared across the data layer, drill-down pages, and widgets.

export interface LineMetric {
  id: string;
  name: string;
  plan: number;
  actual: number;
  achPct: number;
  spPct: number;
  downtime: string;
  status: 'Healthy' | 'At Risk' | 'Bottleneck';
  trend: number[];
}

export interface LineDetail extends LineMetric {
  shift: string;
  operators: number;
  oee: number;
  topDowntimeReasons: { reason: string; minutes: number }[];
  hourlyOutput: { hour: string; units: number }[];
}

export interface DefectItem {
  code: string;
  name: string;
  ppm: number;
}

export interface DefectDetail {
  code: string;
  name: string;
  ppm: number;
  affectedLines: string[];
  rootCauses: { cause: string; sharePct: number }[];
  trend: number[];
  recommendation: string;
}
