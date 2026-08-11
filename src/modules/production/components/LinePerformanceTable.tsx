import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../../components/ui/StatusBadge';
import MiniSparkline from '../../../components/ui/MiniSparkline';
import { Award, AlertTriangle } from 'lucide-react';

// Map "FA Line 03" → "FA-03" to match the line id used by the data layer.
const lineId = (name: string) => {
  const n = name.match(/(\d+)/)?.[1] ?? '';
  return `FA-${n.padStart(2, '0')}`;
};

interface LineMetric {
  name: string;
  plan: number;
  actual: number;
  achPct: number;
  spPct: number;
  downtime: string;
  status: 'Healthy' | 'At Risk' | 'Bottleneck';
  trend: number[];
}

export const LinePerformanceTable: React.FC = () => {
  const navigate = useNavigate();
  const lines: LineMetric[] = [
    { name: 'FA Line 01', plan: 1440, actual: 1421, achPct: 99, spPct: 98.7, downtime: '5m', status: 'Healthy', trend: [95, 96, 98, 97, 99, 99] },
    { name: 'FA Line 02', plan: 1440, actual: 1234, achPct: 86, spPct: 95.2, downtime: '18m', status: 'At Risk', trend: [90, 92, 88, 89, 87, 86] },
    { name: 'FA Line 03', plan: 1400, actual: 1140, achPct: 81, spPct: 92.1, downtime: '32m', status: 'At Risk', trend: [85, 87, 86, 84, 82, 81] },
    { name: 'FA Line 04', plan: 1440, actual: 1412, achPct: 98, spPct: 98.1, downtime: '7m', status: 'Healthy', trend: [96, 97, 98, 97, 98, 98] },
    { name: 'FA Line 05', plan: 1380, actual: 1345, achPct: 97, spPct: 97.5, downtime: '8m', status: 'Healthy', trend: [94, 95, 96, 95, 96, 97] },
    { name: 'FA Line 06', plan: 1400, actual: 890, achPct: 64, spPct: 78.4, downtime: '65m', status: 'Bottleneck', trend: [88, 85, 80, 75, 70, 64] },
    { name: 'FA Line 07', plan: 1400, actual: 400, achPct: 29, spPct: 54.2, downtime: '88m', status: 'Bottleneck', trend: [70, 65, 55, 45, 35, 29] },
    { name: 'FA Line 08', plan: 1400, actual: 400, achPct: 29, spPct: 54.2, downtime: '88m', status: 'Bottleneck', trend: [68, 60, 52, 44, 34, 29] },
    { name: 'FA Line 09', plan: 1400, actual: 400, achPct: 29, spPct: 54.2, downtime: '88m', status: 'Bottleneck', trend: [71, 62, 53, 45, 36, 29] },
  ];

  return (
    <div className="w-full h-full p-4 flex flex-col justify-between gap-4">
      {/* Header and Switcher Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center border-l-2 border-[#005aff] pl-2">
            Line Performance Overview
          </h3>
          <div className="flex items-center gap-3 text-[10px] text-[#52607f] font-bold">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> Healthy
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" /> At Risk
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff4c4c]" /> Bottleneck
            </span>
          </div>
        </div>
        
        <div className="flex gap-2 text-[10px] font-bold">
          <button className="bg-[#080c14] border border-[#005aff] text-white px-3 py-1 rounded">
            Final Assembly Lines
          </button>
          <button className="bg-[#080c14] border border-[#1d324b] text-[#52607f] hover:text-white px-3 py-1 rounded transition-colors">
            SMT Lines
          </button>
        </div>
      </div>

      {/* Grid Layout Table */}
      <div className="flex-grow overflow-y-auto overflow-x-auto my-1 max-h-[750px]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[14px] text-[#52607f] uppercase font-bold tracking-wider">
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d]">LINE</th>
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d] text-right">PLAN</th>
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d] text-right">ACTUAL</th>
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d] text-right">ACHV%</th>
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d] text-right">SPY%</th>
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d] text-right">DOWNTIME</th>
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d] pl-6">STATUS</th>
              <th className="py-3 px-3 sticky top-0 bg-[#0e1424] z-10 border-b border-[#1a243d] text-right pr-4">TREND (24 HRS)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a243d]/30 text-[16px] font-semibold">
            {lines.map((line) => {
              let achColor = 'text-white';
              if (line.achPct >= 95) achColor = 'text-[#22c55e]';
              else if (line.achPct >= 80) achColor = 'text-[#eab308]';
              else achColor = 'text-[#ff4c4c]';

              const spColor = line.spPct >= 96 ? 'text-[#22c55e]/80' : 'text-[#eab308]/80';
              
              const downtimeVal = parseInt(line.downtime);
              const downtimeColor = downtimeVal >= 20 ? 'text-[#ff4c4c]' : 'text-[#94a3b8]';

              const sparklineColor = line.status === 'Healthy' ? '#22c55e' : line.status === 'At Risk' ? '#eab308' : '#ff4c4c';
              const sparklineFill = line.status === 'Healthy' ? 'rgba(34, 197, 94, 0.05)' : line.status === 'At Risk' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255, 76, 76, 0.05)';

              return (
                <tr
                  key={line.name}
                  onClick={() => navigate(`/production/line/${lineId(line.name)}`)}
                  className="even:bg-[#131b2e]/20 odd:bg-[#0e1424]/10 hover:bg-[#1a243d]/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 font-bold text-[#f8fafc]">{line.name}</td>
                  <td className="py-3 px-3 text-[#52607f] text-right">{line.plan.toLocaleString()}</td>
                  <td className="py-3 px-3 text-white font-bold text-right">{line.actual.toLocaleString()}</td>
                  <td className={`py-3 px-3 font-bold text-right ${achColor}`}>{line.achPct}%</td>
                  <td className={`py-3 px-3 font-bold text-right ${spColor}`}>{line.spPct}%</td>
                  <td className={`py-3 px-3 font-bold text-right ${downtimeColor}`}>{line.downtime}</td>
                  <td className="py-3 px-3 pl-6">
                    <StatusBadge status={line.status} />
                  </td>
                  <td className="py-3 px-3 flex justify-end items-center pr-2">
                    <MiniSparkline 
                      data={line.trend} 
                      strokeColor={sparklineColor}
                      fillColor={sparklineFill}
                      width={90} 
                      height={24} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Cards */}
      <div className="grid grid-cols-2 gap-4 border-t border-[#1a243d] pt-3">
        <div className="bg-[#22c55e]/5 border border-[#22c55e]/25 p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-[#22c55e]/10 rounded-full flex items-center justify-center">
              <Award size={16} className="text-[#22c55e]" />
            </span>
            <div>
              <div className="text-[10px] text-[#22c55e] uppercase font-bold tracking-wider">Top Performer</div>
              <div className="text-xs font-black text-white mt-0.5">FA Line 01</div>
            </div>
          </div>
          <span className="text-xs font-black text-[#22c55e]">99% Achievement</span>
        </div>

        <div className="bg-[#ff4c4c]/5 border border-[#ff4c4c]/25 p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-[#ff4c4c]/10 rounded-full flex items-center justify-center">
              <AlertTriangle size={16} className="text-[#ff4c4c]" />
            </span>
            <div>
              <div className="text-[10px] text-[#ff4c4c] uppercase font-bold tracking-wider">Needs Attention</div>
              <div className="text-xs font-black text-white mt-0.5">FA Line 07</div>
            </div>
          </div>
          <span className="text-xs font-black text-[#ff4c4c]">29% Achievement</span>
        </div>
      </div>
    </div>
  );
};

export default LinePerformanceTable;
