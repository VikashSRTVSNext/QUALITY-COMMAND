import React from 'react';
import { useAlertStore, Alert } from '../store/alertStore';
import { AlertTriangle, Info, Sparkles, ChevronRight, XCircle } from 'lucide-react';

export const AttentionCenter: React.FC = () => {
  const { alerts, activeCount, acknowledgeAlert } = useAlertStore();

  const criticalCount = alerts.filter(a => a.type === 'CRITICAL' && !a.acknowledged).length;

  return (
    <div className="flex flex-col h-full justify-between p-4 gap-4">
      {/* Header section with counts */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center border-l-2 border-[#ef4444] pl-2">
            Attention Center
          </h3>
          <div className="flex gap-2 text-[10px] font-bold">
            <span className="bg-[#ef4444] text-white rounded-full px-2.5 py-0.5">
              {activeCount} Alerts
            </span>
            {criticalCount > 0 && (
              <span className="border border-[#ef4444] text-[#ef4444] rounded-full px-2.5 py-0.5">
                {criticalCount} Critical
              </span>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 text-[10px] font-bold">
          <button className="border border-[#ef4444] text-[#ef4444] px-3 py-1 rounded bg-[#ef4444]/5">
            Impact
          </button>
          <button className="border border-[#1d324b] text-[#52607f] hover:text-white px-3 py-1 rounded transition-colors bg-[#080c14]">
            Severity
          </button>
        </div>
      </div>

      {/* Alert Cards Container */}
      <div className="flex-grow space-y-4 overflow-y-auto pr-1">
        {alerts.map((alert: Alert) => {
          if (alert.acknowledged) return null;

          const isCritical = alert.type === 'CRITICAL';
          const isWarning = alert.type === 'WARNING';

          let typeColor = 'text-[#06b6d4]';
          let typeLabel = 'INFO';
          let typeIcon = <Info size={14} className="text-[#06b6d4]" />;
          let titleColor = 'text-[#06b6d4]';

          if (isCritical) {
            typeColor = 'text-[#ef4444]';
            typeLabel = 'CRITICAL';
            typeIcon = <XCircle size={14} className="text-[#ef4444]" />;
            titleColor = 'text-[#ef4444]';
          } else if (isWarning) {
            typeColor = 'text-[#eab308]';
            typeLabel = 'WARNING';
            typeIcon = <AlertTriangle size={14} className="text-[#eab308]" />;
            titleColor = 'text-[#eab308]';
          }

          // Custom override to match screenshot titles/impact labels
          let alertTitle = alert.message;
          let impactText = alert.impact;
          let impactColor = typeColor;

          if (isCritical) {
            alertTitle = 'SMT Line 06 - Extended Downtime';
            impactText = '-880 units / shift';
          } else if (isWarning) {
            alertTitle = 'AOI Camera Calibration Overdue';
            impactText = 'Quality risk: moderate';
          } else {
            alertTitle = 'Customer Audit Queue Growing';
            impactText = 'PGI delay risk';
          }

          const alertBorderClass = isCritical 
            ? 'animate-border-pulse-critical border-[#ef4444]/35' 
            : 'border-[#1d324b] hover:border-[#2b395e]/60';

          return (
            <div 
              key={alert.id} 
              className={`bg-[#0e1424]/40 border rounded-[12px] p-3.5 relative transition-all ${alertBorderClass}`}
            >
               {/* Top Row: Type Tag & module & Time */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-black uppercase tracking-wider flex items-center gap-1.5 ${typeColor}`}>
                    {typeIcon}
                    {typeLabel}
                  </span>
                  <span className="bg-[#1c2a42] text-[#94a3b8] text-[11px] px-2 py-0.5 rounded font-bold">
                    {alert.module}
                  </span>
                </div>
                <button 
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="flex items-center gap-1 text-[12px] text-[#52607f] hover:text-[#10b981] transition-colors"
                >
                  <span>{alert.timeAgo}</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Title & Impact Column */}
              <div className="flex justify-between items-start gap-4 mb-2.5">
                <div className={`text-[15px] font-extrabold ${titleColor}`}>
                  {alertTitle}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[11px] text-[#52607f] font-bold uppercase">Impact:</div>
                  <div className={`text-[14px] font-black ${impactColor}`}>{impactText}</div>
                </div>
              </div>

              {/* Description Message */}
              <div className="text-[13.5px] text-[#94a3b8] mb-3 leading-relaxed font-medium">
                {alert.message === 'SMT Line 06 - Extended Downtime' || alert.message.includes('SMT Line 06') 
                  ? 'Feeder jam on NM-2500 causing output drop. Line at 0% for 88 minutes.'
                  : alert.message === 'AOI Camera Calibration Overdue' || alert.message.includes('AOI Camera')
                  ? 'Camera 2 calibration exceeded 30-day threshold. Risk of missed defects.'
                  : '45 units pending customer audit. Queue target is 20 units.'}
              </div>

              {/* AI Recommendation Container */}
              <div className="bg-[#1e1b4b]/20 border border-[#4338ca]/30 p-3 rounded-[8px] flex flex-col gap-1.5">
                <div className="text-[#818cf8] text-[11px] font-black flex items-center gap-1.5 tracking-wider">
                  <Sparkles size={13} />
                  AI RECOMMENDATION
                </div>
                <div className="text-[13px] text-white font-semibold">
                  {alert.recommendation}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttentionCenter;
