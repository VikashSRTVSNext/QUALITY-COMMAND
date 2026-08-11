import React from 'react';

interface SparklineProps {
  data: number[];
  stroke?: string;
  width?: number;
  height?: number;
  /** Stretch to container width (viewBox scales); ignores `width` for layout. */
  fluid?: boolean;
  className?: string;
}

/**
 * Single shared sparkline. Replaces the duplicated renderSparkline /
 * renderFullSparkline helpers that were copy-pasted across layouts.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  data,
  stroke = '#22c55e',
  width = 80,
  height = 24,
  fluid = false,
  className,
}) => {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((p, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={fluid ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? 'none' : 'xMidYMid meet'}
      className={className ?? 'overflow-visible'}
    >
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={points} />
    </svg>
  );
};

export default Sparkline;
