import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../../core/api/endpoints';

// Stable query keys — also used by the socket bridge to target cache updates.
export const queryKeys = {
  productionLines: ['production', 'lines'] as const,
  lineDetail: (id: string) => ['production', 'lines', id] as const,
  qualityDefects: ['quality', 'defects'] as const,
  defectDetail: (code: string) => ['quality', 'defects', code] as const,
};

export function useProductionLines() {
  return useQuery({
    queryKey: queryKeys.productionLines,
    queryFn: endpoints.productionLines,
    refetchInterval: 10_000, // polling dashboard; live ticks arrive via socket bridge
  });
}

export function useLineDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.lineDetail(id),
    queryFn: () => endpoints.lineDetail(id),
    enabled: !!id,
  });
}

export function useQualityDefects() {
  return useQuery({
    queryKey: queryKeys.qualityDefects,
    queryFn: endpoints.qualityDefects,
    refetchInterval: 15_000,
  });
}

export function useDefectDetail(code: string) {
  return useQuery({
    queryKey: queryKeys.defectDetail(code),
    queryFn: () => endpoints.defectDetail(code),
    enabled: !!code,
  });
}
