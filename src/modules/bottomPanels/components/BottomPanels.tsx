import React, { useEffect, useRef } from "react";
import Card from "../../../components/ui/Card";
import * as echarts from "echarts";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowLeftRight,
  Clock,
  Inbox,
  Boxes,
} from "lucide-react";

export const WarehousePanel: React.FC = () => {
  return (
    <Card title="Warehouse Operations">
      <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-6 h-full pt-1 min-h-0">
        
        {/* Storage Utilization (Left Column) */}
        <div className="flex flex-col justify-between h-full border-r border-[#1d324b]/40 pr-6 min-h-0">
          <div className="text-[10px] text-[#52607f] uppercase font-black tracking-widest mb-2">
            Storage Utilization
          </div>
          
          {/* Radial progress ring */}
          <div className="flex-grow flex items-center justify-center relative my-1">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#121c33]"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#005aff] status-glow-primary"
                  strokeWidth="3.2"
                  strokeDasharray="72, 100"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-[20px] font-black text-white leading-none">
                  72%
                </span>
                <span className="text-[10px] text-[#52607f] uppercase font-bold tracking-wider mt-1">
                  Utilized
                </span>
              </div>
            </div>
          </div>

          {/* Bottom boxes */}
          <div className="grid grid-cols-2 gap-3 mt-2 text-left">
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2.5 flex flex-col justify-center">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">
                Total Capacity
              </span>
              <span className="text-[16px] font-black text-white mt-1.5 leading-none">
                12,500
              </span>
              <span className="text-[#52607f] text-[9px] font-semibold mt-0.5">
                Pallets
              </span>
            </div>
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2.5 flex flex-col justify-center">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">
                Available Space
              </span>
              <span className="text-[16px] font-black text-white mt-1.5 leading-none">
                3,500
              </span>
              <span className="text-[#52607f] text-[9px] font-semibold mt-0.5">
                Pallets
              </span>
            </div>
          </div>
        </div>

        {/* Material Flow (Center Column) */}
        <div className="flex flex-col justify-between h-full border-r border-[#1d324b]/40 pr-6 min-h-0">
          <div className="text-[10px] text-[#52607f] uppercase font-black tracking-widest">
            Material Flow
          </div>
          
          <div className="flex-grow flex flex-col justify-center gap-2.5">
            {/* Box 1 */}
            <div className="bg-[#0b1220]/50 border border-[#1d324b]/40 p-2.5 rounded-lg flex items-center gap-3">
              <div className="w-[32px] h-[32px] bg-[#005aff]/10 border border-[#005aff]/30 rounded-lg flex items-center justify-center text-[#005aff] flex-shrink-0">
                <ArrowDownToLine size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider">Inbound Today</div>
                <div className="text-[14px] font-extrabold text-white mt-0.5">
                  18 <span className="text-[#52607f] text-[10px] font-semibold ml-0.5">Trucks</span>
                </div>
              </div>
            </div>

            {/* Box 2 */}
            <div className="bg-[#0b1220]/50 border border-[#1d324b]/40 p-2.5 rounded-lg flex items-center gap-3">
              <div className="w-[32px] h-[32px] bg-[#005aff]/10 border border-[#005aff]/30 rounded-lg flex items-center justify-center text-[#005aff] flex-shrink-0">
                <ArrowUpToLine size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider">Outbound Today</div>
                <div className="text-[14px] font-extrabold text-white mt-0.5">
                  24 <span className="text-[#52607f] text-[10px] font-semibold ml-0.5">Trucks</span>
                </div>
              </div>
            </div>

            {/* Box 3 */}
            <div className="bg-[#0b1220]/50 border border-[#1d324b]/40 p-2.5 rounded-lg flex items-center gap-3">
              <div className="w-[32px] h-[32px] bg-[#005aff]/10 border border-[#005aff]/30 rounded-lg flex items-center justify-center text-[#005aff] flex-shrink-0">
                <ArrowLeftRight size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider">TO (Transfer Order)</div>
                <div className="text-[14px] font-extrabold text-white mt-0.5">
                  12 <span className="text-[#52607f] text-[10px] font-semibold ml-0.5">Items</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Warehouse Health (Right Column) */}
        <div className="flex flex-col justify-between h-full min-h-0">
          <div className="text-[10px] text-[#52607f] uppercase font-black tracking-widest">
            Warehouse Health
          </div>
          
          <div className="flex-grow flex flex-col justify-center gap-2">
            {/* Item 1 */}
            <div className="bg-[#0b1220]/30 border-l-[3px] border-l-[#ef4444] border border-[#1d324b]/40 p-2 rounded flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-[26px] h-[26px] bg-[#ef4444]/10 rounded flex items-center justify-center text-[#ef4444] flex-shrink-0">
                  <AlertCircle size={14} />
                </div>
                <span className="text-[#94a3b8] text-[11px] font-bold truncate">Blocked Materials</span>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col">
                <span className="text-[#ef4444] text-[14px] font-black leading-none">7</span>
                <span className="text-[#52607f] text-[8px] uppercase font-semibold mt-0.5">Items</span>
              </div>
            </div>

            {/* Item 2 */}
            <div className="bg-[#0b1220]/30 border-l-[3px] border-l-[#eab308] border border-[#1d324b]/40 p-2 rounded flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-[26px] h-[26px] bg-[#eab308]/10 rounded flex items-center justify-center text-[#eab308] flex-shrink-0">
                  <Clock size={14} />
                </div>
                <span className="text-[#94a3b8] text-[11px] font-bold truncate">Slow moving items</span>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col">
                <span className="text-[#eab308] text-[14px] font-black leading-none">12</span>
                <span className="text-[#52607f] text-[8px] uppercase font-semibold mt-0.5">Items</span>
              </div>
            </div>

            {/* Item 3 */}
            <div className="bg-[#0b1220]/30 border-l-[3px] border-l-[#f97316] border border-[#1d324b]/40 p-2 rounded flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-[26px] h-[26px] bg-[#f97316]/10 rounded flex items-center justify-center text-[#f97316] flex-shrink-0">
                  <Inbox size={14} />
                </div>
                <span className="text-[#94a3b8] text-[11px] font-bold truncate">SFC Ageing (&gt;7 Days)</span>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col">
                <span className="text-[#f97316] text-[14px] font-black leading-none">32</span>
                <span className="text-[#52607f] text-[8px] uppercase font-semibold mt-0.5">Lots</span>
              </div>
            </div>

            {/* Item 4 */}
            <div className="bg-[#0b1220]/30 border-l-[3px] border-l-[#06b6d4] border border-[#1d324b]/40 p-2 rounded flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-[26px] h-[26px] bg-[#06b6d4]/10 rounded flex items-center justify-center text-[#06b6d4] flex-shrink-0">
                  <Boxes size={14} />
                </div>
                <span className="text-[#94a3b8] text-[11px] font-bold truncate">WIP Status</span>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col">
                <span className="text-[#06b6d4] text-[14px] font-black leading-none">542</span>
                <span className="text-[#52607f] text-[8px] uppercase font-semibold mt-0.5">Lots</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
};

export const MaterialCommandPanel: React.FC = () => {
  return (
    <Card title="Material Command Center">
      <div className="flex flex-col h-full justify-between pt-1 min-h-0">
        
        {/* Top 2-Column Split */}
        <div className="grid grid-cols-2 gap-6 flex-grow min-h-0 items-center">
          
          {/* Material Availability (Left Column) */}
          <div className="flex flex-col justify-between h-full border-r border-[#1d324b]/40 pr-6 min-h-0">
            <div className="text-[10px] text-[#52607f] uppercase font-black tracking-widest mb-2">
              Material Availability
            </div>
            
            <div className="flex-grow flex items-center justify-center relative my-1">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#121c33]"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#10b981] status-glow-success"
                    strokeWidth="3.2"
                    strokeDasharray="94, 100"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[20px] font-black text-[#10b981] leading-none">
                    94%
                  </span>
                  <span className="text-[10px] text-[#10b981] uppercase font-bold tracking-wider mt-1">
                    Available
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* At Risk Components (Right Column) */}
          <div className="flex flex-col justify-between h-full min-h-0 pl-2">
            <div className="flex justify-between items-center text-[10px] text-[#52607f] uppercase font-black tracking-widest mb-2">
              <span>At Risk Components</span>
              <div className="flex gap-10 font-bold pr-2">
                <span>ETA</span>
                <span>Stock</span>
              </div>
            </div>

            <div className="flex-grow flex flex-col justify-center gap-2">
              {/* Row 1 */}
              <div className="flex justify-between items-center text-[11px] font-bold">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.5)] flex-shrink-0" />
                  <span className="text-[#94a3b8]">Solder Paste</span>
                </div>
                <div className="flex gap-8 items-center text-right font-mono">
                  <span className="text-[#94a3b8] w-12">5.0 hrs</span>
                  <div className="flex items-center gap-1.5 w-10 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                    <span className="text-[#10b981]">320</span>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex justify-between items-center text-[11px] font-bold">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-[#f97316] shadow-[0_0_8px_rgba(249,115,22,0.5)] flex-shrink-0" />
                  <span className="text-[#94a3b8]">Thermal Gel</span>
                </div>
                <div className="flex gap-8 items-center text-right font-mono">
                  <span className="text-[#94a3b8] w-12">1.8 hrs</span>
                  <div className="flex items-center gap-1.5 w-10 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
                    <span className="text-[#10b981]">280</span>
                  </div>
                </div>
              </div>

              {/* Row 3 */}
              <div className="flex justify-between items-center text-[11px] font-bold">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.5)] flex-shrink-0" />
                  <span className="text-[#94a3b8]">Packing Material</span>
                </div>
                <div className="flex gap-8 items-center text-right font-mono">
                  <span className="text-[#94a3b8] w-12">6.5 hrs</span>
                  <div className="flex items-center gap-1.5 w-10 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
                    <span className="text-[#10b981]">415</span>
                  </div>
                </div>
              </div>

              {/* Row 4 */}
              <div className="flex justify-between items-center text-[11px] font-bold">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)] flex-shrink-0" />
                  <span className="text-[#94a3b8]">SFC Labels</span>
                </div>
                <div className="flex gap-8 items-center text-right font-mono">
                  <span className="text-[#94a3b8] w-12">2.2 hrs</span>
                  <div className="flex items-center gap-1.5 w-10 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span className="text-[#10b981]">210</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sparkline Section */}
        <div className="mt-4 flex flex-col gap-1.5 flex-shrink-0 border-t border-[#1d324b]/40 pt-3.5">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-[#52607f] uppercase tracking-wider">Material Consumption (24H)</span>
            <span className="text-[#10b981] flex items-center gap-1">
              ▲ 6.8% <span className="text-[#52607f] uppercase">vs Yesterday</span>
            </span>
          </div>

          <div className="w-full h-12 mt-1 relative overflow-hidden rounded">
            <svg className="w-full h-full" viewBox="0 0 500 50" preserveAspectRatio="none">
              <defs>
                <linearGradient id="materialChartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,40 Q 40,32 80,35 T 160,37 T 240,25 T 320,15 T 400,20 T 500,24 L 500,50 L 0,50 Z"
                fill="url(#materialChartGrad)"
              />
              <path
                d="M 0,40 Q 40,32 80,35 T 160,37 T 240,25 T 320,15 T 400,20 T 500,24"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
              />
            </svg>
          </div>
        </div>

      </div>
    </Card>
  );
};

// ==========================================
// 3. Quality Control Center
// ==========================================
export const QualityPanel: React.FC = () => {
  return (
    <Card title="Quality Control Center">
      <div className="flex flex-col h-full justify-between pt-1 min-h-0">
        
        {/* Top metrics grids */}
        <div className="flex flex-col gap-2.5 flex-shrink-0">
          {/* Row 1: 4 columns */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Process Audit Index</span>
              <span className="text-[16px] font-black text-[#10b981] mt-1.5 leading-none">92.4%</span>
            </div>
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">OBA (Out of Box)</span>
              <span className="text-[16px] font-black text-[#10b981] mt-1.5 leading-none">98.1%</span>
            </div>
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Customer Audit</span>
              <span className="text-[14px] font-black text-[#10b981] mt-1.5 leading-none">Scheduled</span>
            </div>
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Rework Queue</span>
              <span className="text-[16px] font-black text-[#ef4444] mt-1.5 leading-none">27</span>
            </div>
          </div>

          {/* Row 2: 3 columns */}
          <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-2">
            {/* HFTFPY */}
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col justify-between">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none mb-1.5">HFTFPY (Shift)</span>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#52607f] text-[8px] uppercase font-semibold">Unit</span>
                  <span className="text-[13px] font-extrabold text-[#10b981] leading-none">92.4%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#52607f] text-[8px] uppercase font-semibold">Module</span>
                  <span className="text-[13px] font-extrabold text-[#10b981] leading-none">95.6%</span>
                </div>
              </div>
            </div>
            {/* LBTS */}
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">LBTS</span>
              <span className="text-[16px] font-black text-[#10b981] mt-1.5 leading-none">99.2%</span>
            </div>
            {/* Burn In */}
            <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
              <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Burn In</span>
              <span className="text-[16px] font-black text-[#10b981] mt-1.5 leading-none">99.2%</span>
            </div>
          </div>
        </div>

        {/* Bottom Split Layout */}
        <div className="grid grid-cols-2 gap-6 flex-grow min-h-0 mt-4 border-t border-[#1d324b]/40 pt-4">
          
          {/* Quality Flow (Left Column) */}
          <div className="flex flex-col justify-between h-full border-r border-[#1d324b]/40 pr-6 min-h-0">
            <div className="text-[10px] text-[#52607f] uppercase font-black tracking-widest mb-2">
              Quality Flow (Today)
            </div>
            
            <div className="flex-grow flex flex-col justify-between gap-2.5 mt-1">
              {/* Item 1 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-[#94a3b8]">
                  <span>Units Started</span>
                  <span className="text-white font-mono">2,340</span>
                </div>
                <div className="w-full h-2 bg-[#121c33] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-[#94a3b8]">
                  <span>AOI Passed</span>
                  <span className="text-white font-mono">2,291 <span className="text-[#52607f] text-[9.5px] font-semibold">(97.9%)</span></span>
                </div>
                <div className="w-full h-2 bg-[#121c33] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: '97.9%' }} />
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-[#94a3b8]">
                  <span>Test Passed</span>
                  <span className="text-white font-mono">2,259 <span className="text-[#52607f] text-[9.5px] font-semibold">(96.6%)</span></span>
                </div>
                <div className="w-full h-2 bg-[#121c33] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: '96.6%' }} />
                </div>
              </div>

              {/* Item 4 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-[#94a3b8]">
                  <span>Final Inspection Passed</span>
                  <span className="text-white font-mono">2,239 <span className="text-[#52607f] text-[9.5px] font-semibold">(95.1%)</span></span>
                </div>
                <div className="w-full h-2 bg-[#121c33] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: '95.1%' }} />
                </div>
              </div>

              {/* Item 5 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-[#94a3b8]">
                  <span>Shipped</span>
                  <span className="text-white font-mono">2,198 <span className="text-[#52607f] text-[9.5px] font-semibold">(96.0%)</span></span>
                </div>
                <div className="w-full h-2 bg-[#121c33] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: '96%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Rework Analysis (Right Column) */}
          <div className="flex flex-col justify-between h-full min-h-0 pl-2">
            <div className="text-[10px] text-[#52607f] uppercase font-black tracking-widest mb-2">
              Rework Analysis
            </div>
            
            <div className="flex-grow flex items-center justify-between gap-4 mt-2">
              {/* Donut Chart */}
              <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
                <svg width="100%" height="100%" viewBox="0 0 42 42" className="transform -rotate-90">
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#121c33" strokeWidth="4.5" />
                  
                  {/* Segment 1: AOI Rework (33%) - Blue */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#3b82f6" strokeWidth="4.5" 
                          strokeDasharray="33 67" strokeDashoffset="25" />
                          
                  {/* Segment 2: Test Rework (30%) - Orange */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f97316" strokeWidth="4.5" 
                          strokeDasharray="30 70" strokeDashoffset="92" />
                          
                  {/* Segment 3: Assembly Rework (22%) - Green */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#10b981" strokeWidth="4.5" 
                          strokeDasharray="22 78" strokeDashoffset="62" />

                  {/* Segment 4: Final Rework (15%) - Red */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ef4444" strokeWidth="4.5" 
                          strokeDasharray="15 85" strokeDashoffset="40" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[20px] font-black text-white leading-none">27</span>
                  <span className="text-[9px] text-[#52607f] uppercase font-bold tracking-wider mt-1">In Rework</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex flex-col gap-2 flex-grow pr-1">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                    <span className="text-[#94a3b8]">AOI Rework</span>
                  </div>
                  <span className="text-[#3b82f6] font-mono">33%</span>
                </div>
                
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                    <span className="text-[#94a3b8]">Test Rework</span>
                  </div>
                  <span className="text-[#f97316] font-mono">30%</span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    <span className="text-[#10b981]">Assembly Rework</span>
                  </div>
                  <span className="text-[#10b981] font-mono">22%</span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <span className="text-[#ef4444] font-mono">Final Rework</span>
                  </div>
                  <span className="text-[#ef4444] font-mono">15%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
};

// ==========================================
// 4. Capacity Utilization (ECharts Panel)
// ==========================================
export const CapacityPanel: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    let chart = echarts.getInstanceByDom(chartRef.current);
    if (chart) {
      chart.dispose();
    }
    
    chart = echarts.init(chartRef.current, "dark");

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { 
        trigger: "axis",
        backgroundColor: "rgba(8, 12, 20, 0.9)",
        borderColor: "#1d324b",
        textStyle: { color: "#fff" }
      },
      grid: { left: "2%", right: "2%", top: "8%", bottom: "10%", containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: ["-7h", "-6h", "-5h", "-4h", "-3h", "-2h", "-1h", "Now"],
        axisLine: { lineStyle: { color: "#1d324b" } },
        axisTick: { show: false },
        axisLabel: { color: "#52607f", fontSize: 10, fontWeight: "bold" },
      },
      yAxis: {
        type: "value",
        min: 50,
        max: 100,
        interval: 10,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#1d324b/30", type: "dashed" } },
        axisLabel: { 
          color: "#52607f", 
          fontSize: 10, 
          fontWeight: "bold",
          formatter: "{value}%"
        },
      },
      series: [
        {
          name: "Built-up Area",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: [62, 64, 65, 67, 66, 68, 67, 68],
          lineStyle: { color: "#3b82f6", width: 2.5 },
          itemStyle: { color: "#3b82f6" }
        },
        {
          name: "Manpower",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: [70, 74, 76, 75, 78, 77, 79, 78],
          lineStyle: { color: "#a78bfa", width: 2.5 },
          itemStyle: { color: "#a78bfa" }
        },
        {
          name: "Machines",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: [72, 71, 73, 75, 74, 76, 75, 76],
          lineStyle: { color: "#10b981", width: 2.5 },
          itemStyle: { color: "#10b981" }
        },
        {
          name: "Storage Utilization",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: [68, 69, 70, 71, 72, 73, 72, 72],
          lineStyle: { color: "#f97316", width: 2.5 },
          itemStyle: { color: "#f97316" }
        },
        {
          name: "Utilities / AQI Health",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: [85, 87, 89, 90, 91, 90, 92, 92],
          lineStyle: { color: "#ec4899", width: 2.5 },
          itemStyle: { color: "#ec4899" }
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, []);

  return (
    <Card title="Capacity Utilization">
      <div className="flex flex-col h-full justify-between pt-1 min-h-0">
        
        {/* Top Metric Header Row */}
        <div className="flex justify-between items-center gap-4 flex-shrink-0 mb-4 bg-[#0b1220]/20 p-2 rounded-lg border border-[#1d324b]/20">
          {/* Built-up Area */}
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] text-[#52607f] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              <span className="truncate">Built-up Area</span>
            </div>
            <span className="text-[16px] font-black text-[#3b82f6] mt-1 leading-none">68%</span>
            <span className="text-[8px] text-[#52607f] font-bold mt-0.5">UTILIZED</span>
          </div>

          {/* Manpower */}
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] text-[#52607f] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#a78bfa]" />
              <span className="truncate">Manpower</span>
            </div>
            <span className="text-[16px] font-black text-[#a78bfa] mt-1 leading-none">78%</span>
            <span className="text-[8px] text-[#52607f] font-bold mt-0.5">UTILIZED</span>
          </div>

          {/* Machines */}
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] text-[#52607f] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span className="truncate">Machines</span>
            </div>
            <span className="text-[16px] font-black text-[#10b981] mt-1 leading-none">76%</span>
            <span className="text-[8px] text-[#52607f] font-bold mt-0.5">UTILIZED</span>
          </div>

          {/* Storage Utilization */}
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] text-[#52607f] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#f97316]" />
              <span className="truncate">Storage Utilization</span>
            </div>
            <span className="text-[16px] font-black text-[#f97316] mt-1 leading-none">72%</span>
            <span className="text-[8px] text-[#52607f] font-bold mt-0.5">UTILIZED</span>
          </div>

          {/* Utilities / AQI Health */}
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] text-[#52607f] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#ec4899]" />
              <span className="truncate">Utilities / AQI Health</span>
            </div>
            <span className="text-[16px] font-black text-[#ec4899] mt-1 leading-none">92%</span>
            <span className="text-[8px] text-[#52607f] font-bold mt-0.5">UTILIZED</span>
          </div>
        </div>

        {/* ECharts Container */}
        <div ref={chartRef} className="w-full flex-grow min-h-[160px]" />

        {/* Bottom Total Capacity Bar */}
        <div className="bg-[#0b1220]/60 border border-[#1d324b]/60 rounded-lg p-2.5 flex justify-between items-center text-[11px] font-bold flex-shrink-0 mt-3">
          <span className="text-[#94a3b8] uppercase tracking-wider">Total Capacity</span>
          <span className="text-white font-mono text-[12px]">
            <strong className="text-[#3b82f6] text-[13px] font-black mr-1">12,500</strong> Pallets
          </span>
        </div>

      </div>
    </Card>
  );
};

// ==========================================
// 5. Energy Monitoring
// ==========================================
export const EnergyPanel: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    let chart = echarts.getInstanceByDom(chartRef.current);
    if (chart) {
      chart.dispose();
    }
    
    chart = echarts.init(chartRef.current, "dark");

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { 
        trigger: "axis",
        backgroundColor: "rgba(8, 12, 20, 0.9)",
        borderColor: "#1d324b",
        textStyle: { color: "#fff" }
      },
      grid: { left: "2%", right: "2%", top: "8%", bottom: "10%", containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: ["-8h", "", "-6h", "", "-4h", "", "-2h", "", "Now"],
        axisLine: { lineStyle: { color: "#1d324b" } },
        axisTick: { show: false },
        axisLabel: { color: "#52607f", fontSize: 10, fontWeight: "bold" },
      },
      yAxis: {
        type: "value",
        min: 2000,
        max: 8000,
        interval: 2000,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#1d324b/30", type: "dashed" } },
        axisLabel: { 
          color: "#52607f", 
          fontSize: 10, 
          fontWeight: "bold",
          formatter: (val: number) => val >= 1000 ? (val / 1000) + 'k' : val
        },
      },
      series: [
        {
          name: "Consumption Trend",
          type: "line",
          smooth: true,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 8,
          data: [4000, 4500, 4200, 4700, 4400, 4900, 5200, 5800, 6000],
          lineStyle: { color: "#10b981", width: 2.5 },
          itemStyle: { color: "#10b981", borderColor: "#0e1424", borderWidth: 1 }
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, []);

  return (
    <Card title="Energy Monitoring">
      <div className="flex flex-col h-full justify-between pt-1 min-h-0">
        
        {/* Top Metric Header Row */}
        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 flex-shrink-0 mb-4 bg-[#0b1220]/20 p-3 rounded-lg border border-[#1d324b]/20">
          {/* Today Consumption */}
          <div className="flex flex-col border-r border-[#1d324b]/40 pr-2">
            <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider">Today Consumption</span>
            <div className="flex items-baseline gap-1 mt-1 leading-none">
              <span className="text-[18px] font-black text-[#10b981]">4,850</span>
              <span className="text-[10px] text-[#52607f] font-bold">kWh</span>
            </div>
          </div>

          {/* Target */}
          <div className="flex flex-col border-r border-[#1d324b]/40 pr-2">
            <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider">Target</span>
            <div className="flex items-baseline gap-1 mt-1 leading-none">
              <span className="text-[18px] font-black text-white">5,200</span>
              <span className="text-[10px] text-[#52607f] font-bold">kWh</span>
            </div>
          </div>

          {/* vs Yesterday */}
          <div className="flex flex-col items-end">
            <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider">vs Yesterday</span>
            <span className="text-[#ef4444] text-[16px] font-black mt-1 leading-none flex items-center gap-1">
              ▼ 4.6%
            </span>
          </div>
        </div>

        {/* ECharts Container */}
        <div ref={chartRef} className="w-full flex-grow min-h-[160px]" />

        {/* Bottom CO2 Avoided Bar */}
        <div className="bg-[#0b1220]/60 border border-[#1d324b]/60 rounded-lg p-2.5 flex justify-between items-center text-[11px] font-bold flex-shrink-0 mt-3">
          <span className="text-[#94a3b8] uppercase tracking-wider">CO₂ Avoided</span>
          <span className="text-white font-mono text-[12px]">
            <strong className="text-[#10b981] text-[13px] font-black mr-1">2.34</strong> Ton
          </span>
        </div>

      </div>
    </Card>
  );
};

// ==========================================
// 6. Shipment Readiness
// ==========================================
export const ShipmentPanel: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    let chart = echarts.getInstanceByDom(chartRef.current);
    if (chart) {
      chart.dispose();
    }
    
    chart = echarts.init(chartRef.current, "dark");

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { 
        trigger: "axis",
        backgroundColor: "rgba(8, 12, 20, 0.9)",
        borderColor: "#1d324b",
        textStyle: { color: "#fff" }
      },
      grid: { left: "2%", right: "2%", top: "8%", bottom: "10%", containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: ["-8h", "-7h", "-6h", "-5h", "-4h", "-3h", "-2h", "-1h", "Now"],
        axisLine: { lineStyle: { color: "#1d324b" } },
        axisTick: { show: false },
        axisLabel: { color: "#52607f", fontSize: 10, fontWeight: "bold" },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 300,
        interval: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#1d324b/30", type: "dashed" } },
        axisLabel: { color: "#52607f", fontSize: 10, fontWeight: "bold" },
      },
      series: [
        {
          name: "Ready to Ship",
          type: "line",
          smooth: true,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 8,
          data: [220, 255, 250, 235, 248, 252, 245, 260, 250],
          lineStyle: { color: "#10b981", width: 2.5 },
          itemStyle: { color: "#10b981", borderColor: "#0e1424", borderWidth: 1 }
        },
        {
          name: "Waiting",
          type: "line",
          smooth: true,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 8,
          data: [148, 160, 150, 172, 178, 165, 168, 192, 160],
          lineStyle: { color: "#f97316", width: 2.5 },
          itemStyle: { color: "#f97316", borderColor: "#0e1424", borderWidth: 1 }
        },
        {
          name: "Blocked",
          type: "line",
          smooth: true,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 8,
          data: [102, 80, 70, 75, 95, 125, 70, 115, 95],
          lineStyle: { color: "#ef4444", width: 2.5 },
          itemStyle: { color: "#ef4444", borderColor: "#0e1424", borderWidth: 1 }
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, []);

  return (
    <Card title="Shipment Readiness">
      <div className="flex flex-col h-full justify-between pt-1 min-h-0">
        
        {/* Top metrics card row */}
        <div className="grid grid-cols-4 gap-2 flex-shrink-0 mb-4">
          <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
            <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Ready to Ship</span>
            <span className="text-[16px] font-black text-[#10b981] mt-1.5 leading-none">132</span>
          </div>
          <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
            <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Waiting Inspection</span>
            <span className="text-[16px] font-black text-[#eab308] mt-1.5 leading-none">18</span>
          </div>
          <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
            <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Waiting PGI</span>
            <span className="text-[16px] font-black text-[#eab308] mt-1.5 leading-none">11</span>
          </div>
          <div className="bg-[#0b1220] border border-[#1d324b]/60 rounded-lg p-2 flex flex-col">
            <span className="text-[#52607f] text-[9px] uppercase font-bold tracking-wider leading-none">Blocked</span>
            <span className="text-[16px] font-black text-[#ef4444] mt-1.5 leading-none">7</span>
          </div>
        </div>

        {/* Bottom Split Layout */}
        <div className="grid grid-cols-[2.1fr_1fr] gap-6 flex-grow min-h-0 border-t border-[#1d324b]/40 pt-4">
          {/* Left Column: Shipment Trend */}
          <div className="flex flex-col justify-between h-full border-r border-[#1d324b]/40 pr-6 min-h-0">
            <div className="flex justify-between items-center text-[10px] text-[#52607f] uppercase font-black tracking-widest mb-2">
              <span>Shipment Trend (Units)</span>
              <div className="flex gap-3 font-bold pr-1">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />Ready to Ship</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />Waiting</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />Blocked</span>
              </div>
            </div>
            
            <div ref={chartRef} className="w-full flex-grow min-h-[160px]" />
          </div>

          {/* Right Column: OTD Risk */}
          <div className="flex flex-col justify-between h-full min-h-0 pl-2">
            <div className="text-[10px] text-[#52607f] uppercase font-black tracking-widest mb-2">
              OTD Risk by Order
            </div>

            <div className="flex-grow flex items-center justify-center relative my-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg width="100%" height="100%" viewBox="0 0 42 42" className="transform -rotate-90">
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#10b981" strokeWidth="4.5" />
                  
                  {/* Red segment representing OTD Risk (12%) */}
                  <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ef4444" strokeWidth="4.5" 
                          strokeDasharray="12 88" strokeDashoffset="25" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[20px] font-black text-white leading-none">
                    12%
                  </span>
                  <span className="text-[9px] text-[#52607f] uppercase font-bold tracking-wider mt-1 text-center leading-tight">
                    Orders at Risk
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
};
