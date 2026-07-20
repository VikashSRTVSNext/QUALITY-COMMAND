import { httpClient } from './httpClient';
import type { LineMetric, LineDetail, DefectItem, DefectDetail } from './types';
import { mockLines, mockLineDetail, mockDefects, mockDefectDetail } from './mocks';

// ── The single mock ⇄ real swap point ──────────────────────────────────────
// Flip this (or wire to import.meta.env.VITE_USE_MOCKS) when the backend is ready.
// Every dashboard/query reads through the fetchers below, so no component changes
// are needed to go live.
const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

function mock<T>(value: T): Promise<T> {
  // Resolve async to mimic a network round-trip (keeps loading states realistic).
  return new Promise((resolve) => setTimeout(() => resolve(value), 200));
}

async function get<T>(url: string): Promise<T> {
  const res = await httpClient.get<T>(url);
  return res.data;
}

export const endpoints = {
  productionLines: (): Promise<LineMetric[]> =>
    USE_MOCKS ? mock(mockLines) : get('/production/lines'),

  lineDetail: (id: string): Promise<LineDetail> =>
    USE_MOCKS ? mock(mockLineDetail(id)) : get(`/production/lines/${id}`),

  qualityDefects: (): Promise<DefectItem[]> =>
    USE_MOCKS ? mock(mockDefects) : get('/quality/defects'),

  defectDetail: (code: string): Promise<DefectDetail> =>
    USE_MOCKS ? mock(mockDefectDetail(code)) : get(`/quality/defects/${code}`),
};
