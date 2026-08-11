import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  glowColor?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'none';
  triggerUpdate?: any;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
  glowColor = 'none',
  triggerUpdate,
}) => {
  const [pulsing, setPulsing] = React.useState(false);
  const isFirstMount = React.useRef(true);

  React.useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (triggerUpdate !== undefined) {
      setPulsing(true);
      const timer = setTimeout(() => setPulsing(false), 500);
      return () => clearTimeout(timer);
    }
  }, [triggerUpdate]);

  const glowClasses = {
    success: 'border-[#22c55e]/25 hover:border-[#22c55e]/60 hover:shadow-[0_0_20px_rgba(34, 197, 94,0.12),_inset_0_1px_1px_rgba(255,255,255,0.05)]',
    warning: 'border-[#eab308]/25 hover:border-[#eab308]/60 hover:shadow-[0_0_20px_rgba(234,179,8,0.12),_inset_0_1px_1px_rgba(255,255,255,0.05)]',
    danger: 'border-[#ff4c4c]/25 hover:border-[#ff4c4c]/60 hover:shadow-[0_0_20px_rgba(255, 76, 76,0.15),_inset_0_1px_1px_rgba(255,255,255,0.05)]',
    info: 'border-[#06b6d4]/25 hover:border-[#06b6d4]/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.12),_inset_0_1px_1px_rgba(255,255,255,0.05)]',
    primary: 'border-[#005aff]/25 hover:border-[#005aff]/60 hover:shadow-[0_0_20px_rgba(0,90,255,0.12),_inset_0_1px_1px_rgba(255,255,255,0.05)]',
    none: 'border-[#1d324b] hover:border-[#2b395e]/80 hover:shadow-[0_0_20px_rgba(56,189,248,0.05),_inset_0_1px_1px_rgba(255,255,255,0.05)]',
  };

  const pulseStyles = pulsing 
    ? 'border-[#005aff]/80 shadow-[0_0_25px_rgba(0,90,255,0.25),_inset_0_1px_1px_rgba(255,255,255,0.08)] scale-[1.008] duration-150' 
    : glowClasses[glowColor];

  return (
    <div className={`backdrop-blur-[12px] bg-[#0e1424]/85 border shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),_0_8px_32px_rgba(0,0,0,0.5)] rounded-[12px] p-5 flex flex-col h-full transition-all duration-300 ${pulseStyles} ${className}`}>
      {(title || headerAction) && (
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            {title && (
              <>
                <span className="w-[4px] h-[16.5px] bg-gradient-to-b from-[#005aff] to-[#38bdf8] rounded-full inline-block shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                <h3 className="text-[14px] font-extrabold text-[#e2e8f0] tracking-wider uppercase leading-none">{title}</h3>
              </>
            )}
            {subtitle && <p className="text-[11px] text-[#97a7bb]/70 ml-1">{subtitle}</p>}
          </div>
          {headerAction && <div className="flex items-center">{headerAction}</div>}
        </div>
      )}
      <div className="flex-grow flex flex-col justify-between min-h-0">
        {children}
      </div>
    </div>
  );
};
export default Card;
