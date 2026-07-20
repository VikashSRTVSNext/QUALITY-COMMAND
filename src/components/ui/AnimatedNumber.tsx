import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number; // duration in ms
  formatter?: (val: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 500,
  formatter = (v) => Math.round(v).toLocaleString(),
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [trend, setTrend] = useState<'up' | 'down' | null>(null);
  const startValueRef = useRef(value);
  const targetValueRef = useRef(value);
  const startTimeRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value > prevValueRef.current) {
      setTrend('up');
      const timer = setTimeout(() => setTrend(null), 1000);
      return () => clearTimeout(timer);
    } else if (value < prevValueRef.current) {
      setTrend('down');
      const timer = setTimeout(() => setTrend(null), 1000);
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value]);

  useEffect(() => {
    startValueRef.current = displayValue;
    targetValueRef.current = value;
    startTimeRef.current = null;

    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
      
      const current = startValueRef.current + (targetValueRef.current - startValueRef.current) * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  const trendColorClass = trend === 'up' 
    ? 'text-[#10b981] transition-colors duration-200' 
    : trend === 'down' 
    ? 'text-[#ef4444] transition-colors duration-200' 
    : 'transition-colors duration-1000';

  return <span className={`${trendColorClass} ${className}`}>{formatter(displayValue)}</span>;
};
export default AnimatedNumber;
