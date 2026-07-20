import React from 'react';

export type StatusType = 'Healthy' | 'At Risk' | 'Bottleneck' | 'Critical' | 'Offline' | 'Muted';

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normStatus = status.toLowerCase();

  let styles = 'bg-[#1e293b] text-[#94a3b8] border-[#334155]';
  let indicator = 'bg-[#64748b]';

  if (normStatus === 'healthy' || normStatus === 'online') {
    styles = 'bg-[#064e3b]/30 text-[#34d399] border-[#059669]/30 status-glow-success';
    indicator = 'bg-[#10b981] animate-soft-pulse';
  } else if (normStatus === 'at risk' || normStatus === 'warning') {
    styles = 'bg-[#78350f]/30 text-[#fbbf24] border-[#d97706]/30 status-glow-warning';
    indicator = 'bg-[#eab308] animate-soft-pulse';
  } else if (normStatus === 'bottleneck' || normStatus === 'critical' || normStatus === 'danger') {
    styles = 'bg-[#7f1d1d]/30 text-[#f87171] border-[#dc2626]/30 status-glow-danger';
    indicator = 'bg-[#ef4444] animate-soft-pulse';
  }

  return (
    <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold border tracking-wider gap-1.5 ${styles} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${indicator}`} />
      <span>{status}</span>
    </div>
  );
};
export default StatusBadge;
