import type { LineMetric, LineDetail, DefectItem, DefectDetail } from './types';
import qualityData from '../../data/qualityData.json';

// Mock fixtures used while USE_MOCKS is on. Kept separate from endpoints.ts so
// deleting this file (once the real backend lands) is a clean, obvious change.

export const mockLines: LineMetric[] = [
  { id: 'FA-01', name: 'FA Line 01', plan: 1440, actual: 1421, achPct: 99, spPct: 98.7, downtime: '5m', status: 'Healthy', trend: [95, 96, 98, 97, 99, 99] },
  { id: 'FA-02', name: 'FA Line 02', plan: 1440, actual: 1234, achPct: 86, spPct: 95.2, downtime: '18m', status: 'At Risk', trend: [90, 92, 88, 89, 87, 86] },
  { id: 'FA-03', name: 'FA Line 03', plan: 1400, actual: 1140, achPct: 81, spPct: 92.1, downtime: '32m', status: 'At Risk', trend: [85, 87, 86, 84, 82, 81] },
  { id: 'FA-04', name: 'FA Line 04', plan: 1440, actual: 1412, achPct: 98, spPct: 98.1, downtime: '7m', status: 'Healthy', trend: [96, 97, 98, 97, 98, 98] },
  { id: 'FA-05', name: 'FA Line 05', plan: 1380, actual: 1345, achPct: 97, spPct: 97.5, downtime: '8m', status: 'Healthy', trend: [94, 95, 96, 95, 96, 97] },
  { id: 'FA-06', name: 'FA Line 06', plan: 1400, actual: 890, achPct: 64, spPct: 78.4, downtime: '65m', status: 'Bottleneck', trend: [88, 85, 80, 75, 70, 64] },
  { id: 'FA-07', name: 'FA Line 07', plan: 1400, actual: 400, achPct: 29, spPct: 54.2, downtime: '88m', status: 'Bottleneck', trend: [70, 65, 55, 45, 35, 29] },
  { id: 'FA-08', name: 'FA Line 08', plan: 1400, actual: 400, achPct: 29, spPct: 54.2, downtime: '88m', status: 'Bottleneck', trend: [68, 60, 52, 44, 34, 29] },
  { id: 'FA-09', name: 'FA Line 09', plan: 1400, actual: 400, achPct: 29, spPct: 54.2, downtime: '88m', status: 'Bottleneck', trend: [71, 62, 53, 45, 36, 29] },
];

export function mockLineDetail(id: string): LineDetail {
  const base = mockLines.find((l) => l.id === id) ?? mockLines[0];
  return {
    ...base,
    shift: 'Shift A (06:15 – 14:15)',
    operators: 24,
    oee: Math.round(base.achPct * 0.92),
    topDowntimeReasons: [
      { reason: 'Changeover', minutes: Math.round(parseInt(base.downtime) * 0.4) },
      { reason: 'Material starvation', minutes: Math.round(parseInt(base.downtime) * 0.35) },
      { reason: 'Minor stops', minutes: Math.round(parseInt(base.downtime) * 0.25) },
    ],
    hourlyOutput: Array.from({ length: 8 }, (_, i) => ({
      hour: `${6 + i}:00`,
      units: Math.round(base.actual / 8 + (base.trend[i % base.trend.length] - 90) * 2),
    })),
  };
}

// Derive defect codes from the existing quality dataset so mock + UI stay in sync.
const paretoItems: { name: string; ppm: number }[] = qualityData.defectPareto.items;
const toCode = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

export const mockDefects: DefectItem[] = paretoItems.map((it) => ({
  code: toCode(it.name),
  name: it.name,
  ppm: it.ppm,
}));

export function mockDefectDetail(code: string): DefectDetail {
  const item = mockDefects.find((d) => d.code === code) ?? mockDefects[0];
  return {
    code: item.code,
    name: item.name,
    ppm: item.ppm,
    affectedLines: ['FA Line 03', 'FA Line 06', 'FA Line 07'],
    rootCauses: [
      { cause: 'Stencil aperture wear', sharePct: 42 },
      { cause: 'Reflow profile drift', sharePct: 33 },
      { cause: 'Solder paste shelf life', sharePct: 25 },
    ],
    trend: [item.ppm * 0.7, item.ppm * 0.85, item.ppm * 0.9, item.ppm, item.ppm * 0.95, item.ppm * 0.88].map(Math.round),
    recommendation: `Prioritize stencil inspection on affected lines; verify reflow zone ${item.name.length % 5 + 3} setpoint.`,
  };
}
