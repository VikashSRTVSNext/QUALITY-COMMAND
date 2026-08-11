import React from 'react';

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  width = 120,
  height = 36,
  strokeColor = '#22c55e', // success emerald
  fillColor = 'rgba(34, 197, 94, 0.08)',
  strokeWidth = 1.5,
}) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height * 0.8 - height * 0.1; // padding 10%
    return { x, y };
  });

  const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
  const closedPathD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Fill Area */}
      <path d={closedPathD} fill={fillColor} className="transition-all duration-500 ease-in-out" />
      {/* Stroke Line */}
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500 ease-in-out" />
    </svg>
  );
};
export default MiniSparkline;
