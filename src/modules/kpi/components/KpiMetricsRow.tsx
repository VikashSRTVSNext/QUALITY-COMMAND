import React, { useEffect } from 'react';
import { useKpiStore } from '../store/kpiStore';
import Card from '../../../components/ui/Card';
import AnimatedNumber from '../../../components/ui/AnimatedNumber';
import MiniSparkline from '../../../components/ui/MiniSparkline';
import { Users, Box, Boxes, Thermometer, Droplets, Clock, TrendingUp, Target } from 'lucide-react';

export const KpiMetricsRow: React.FC = () => {
  const kpis = useKpiStore();

  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a performance state: 0 = Low, 1 = Medium, 2 = High
      const perfState = Math.floor(Math.random() * 3);

      let actualRateMultiplier = 0.88; // Default
      let hourly = 1205;
      let fpyUnit = 99.2;
      let fpyMod = 97.6;
      let wipTotal = 2340;
      let wipRaw = 1256;
      let wipSemi = 640;
      let wipFinished = 450;
      let pgiLots = 132;
      let downtimeMin = 42;
      let tempVal = 27.6;
      let humidityVal = 56;

      if (perfState === 0) {
        // Low performance
        actualRateMultiplier = 0.76 + Math.random() * 0.06; // 76% to 82%
        hourly = Math.floor(920 + Math.random() * 120); // 920 - 1040
        fpyUnit = parseFloat((93.5 + Math.random() * 2.5).toFixed(1)); // 93.5 - 96.0
        fpyMod = parseFloat((90.0 + Math.random() * 3.0).toFixed(1)); // 90.0 - 93.0
        wipTotal = Math.floor(3100 + Math.random() * 400);
        wipRaw = Math.floor(wipTotal * 0.55);
        wipSemi = Math.floor(wipTotal * 0.30);
        wipFinished = wipTotal - wipRaw - wipSemi;
        pgiLots = Math.floor(70 + Math.random() * 30);
        downtimeMin = Math.floor(75 + Math.random() * 45);
        tempVal = parseFloat((26.5 + Math.random() * 3.0).toFixed(1)); 
        humidityVal = Math.floor(58 + Math.random() * 10);
      } else if (perfState === 1) {
        // Medium performance
        actualRateMultiplier = 0.84 + Math.random() * 0.05; // 84% to 89%
        hourly = Math.floor(1110 + Math.random() * 80); // 1110 - 1190
        fpyUnit = parseFloat((97.0 + Math.random() * 1.5).toFixed(1)); // 97.0 - 98.5
        fpyMod = parseFloat((94.5 + Math.random() * 2.0).toFixed(1)); // 94.5 - 96.5
        wipTotal = Math.floor(2200 + Math.random() * 300);
        wipRaw = Math.floor(wipTotal * 0.53);
        wipSemi = Math.floor(wipTotal * 0.28);
        wipFinished = wipTotal - wipRaw - wipSemi;
        pgiLots = Math.floor(115 + Math.random() * 25);
        downtimeMin = Math.floor(25 + Math.random() * 20);
        tempVal = parseFloat((23.0 + Math.random() * 2.0).toFixed(1));
        humidityVal = Math.floor(48 + Math.random() * 8);
      } else {
        // High performance
        actualRateMultiplier = 0.92 + Math.random() * 0.07; // 92% to 99%
        hourly = Math.floor(1210 + Math.random() * 100); // 1210 - 1310
        fpyUnit = parseFloat((99.0 + Math.random() * 0.9).toFixed(1)); // 99.0 - 99.9
        fpyMod = parseFloat((97.2 + Math.random() * 1.5).toFixed(1)); // 97.2 - 98.7
        wipTotal = Math.floor(1600 + Math.random() * 300);
        wipRaw = Math.floor(wipTotal * 0.50);
        wipSemi = Math.floor(wipTotal * 0.25);
        wipFinished = wipTotal - wipRaw - wipSemi;
        pgiLots = Math.floor(140 + Math.random() * 30);
        downtimeMin = Math.floor(5 + Math.random() * 15);
        tempVal = parseFloat((21.5 + Math.random() * 1.5).toFixed(1));
        humidityVal = Math.floor(42 + Math.random() * 6);
      }

      const planVal = 12500;
      const actualVal = Math.floor(planVal * actualRateMultiplier);

      kpis.updateKpi({
        planVsActual: { plan: planVal, actual: actualVal },
        hourlyAchievement: { actual: hourly, target: 1150 },
        firstPassYield: { unit: fpyUnit, module: fpyMod },
        factoryWip: { total: wipTotal, raw: wipRaw, semi: wipSemi, finished: wipFinished },
        readyToShip: { lots: pgiLots, totalUnits: pgiLots * 50 },
        downtime: { minutes: downtimeMin, diffPercentage: parseFloat(((downtimeMin - 35) / 35 * 100).toFixed(1)) },
        conditions: { temp: tempVal, humidity: humidityVal },
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [kpis]);

  const achievementRate = (kpis.planVsActual.actual / kpis.planVsActual.plan) * 100;

  return (
    <div className="contents">
      <Card 
        title="Plan vs Actual (Shift)" 
        triggerUpdate={kpis.planVsActual.actual}
        headerAction={
          <div className="bg-[#10b981]/10 border border-[#10b981]/30 p-1.5 rounded-md text-[#10b981]">
            <Box size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          {/* Plan vs Actual Split Columns */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Plan */}
            <div className="flex flex-col">
              <span className="text-[15px] text-[#97a7bb] font-bold uppercase tracking-wider">Plan</span>
              <span className="text-[36px] font-black text-white tracking-tight mt-1.5 leading-none">
                {kpis.planVsActual.plan.toLocaleString()}
              </span>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-10 bg-[#1d324b]" />

            {/* Actual */}
            <div className="flex flex-col items-end">
              <span className="text-[15px] text-[#97a7bb] font-bold uppercase tracking-wider">Actual</span>
              <span className="text-[36px] font-black text-[#10b981] tracking-tight mt-1.5 leading-none">
                <AnimatedNumber value={kpis.planVsActual.actual} />
              </span>
            </div>
          </div>

          {/* Achievement Row */}
          <div className="mt-4">
            <div className="flex justify-between items-center text-[15px] text-[#97a7bb] mb-2 font-bold uppercase">
              <span>Achievement</span>
              <span className="text-[#10b981] font-black text-[16px]">
                {achievementRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-[#1d324b] h-2.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#10b981] rounded-full transition-all duration-500 status-glow-success"
                style={{ width: `${Math.min(achievementRate, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Hourly Achievement */}
      <Card 
        title="Hourly Achievement" 
        triggerUpdate={kpis.hourlyAchievement.actual}
        headerAction={
          <div className="bg-[#005aff]/10 border border-[#005aff]/30 p-1.5 rounded-md text-[#005aff]">
            <Clock size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          {/* Main Content: Split Columns */}
          <div className="flex justify-between items-baseline">
            <div className="flex flex-col">
              <span className="text-[36px] font-black text-white tracking-tight leading-none">
                <AnimatedNumber value={kpis.hourlyAchievement.actual} />
              </span>
              <span className="text-[15px] text-[#97a7bb] font-bold uppercase tracking-wider mt-1.5">
                Units per Hour
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[15px] text-[#97a7bb] font-bold uppercase tracking-wider">Target per Hour</span>
              <span className="text-[20px] font-bold text-[#10b981] mt-1.5 leading-none">
                {kpis.hourlyAchievement.target.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Bottom Area: Trend Indicator and Sparkline */}
          <div className="flex justify-between items-end mt-2">
            <div className="flex items-center gap-1 text-[13px] font-black text-[#10b981]">
              <TrendingUp size={12} />
              <span>+0.5%</span>
            </div>
            
            <div className="flex-shrink-0">
              <MiniSparkline 
                data={[1120, 1140, 1130, 1160, 1175, 1205]} 
                strokeColor="#10b981" 
                fillColor="rgba(16, 185, 129, 0.04)" 
                width={120} 
                height={26} 
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. FPY (Unit/Module) */}
      <Card 
        title="FPY (Unit/Module)"
        triggerUpdate={kpis.firstPassYield.unit}
        headerAction={
          <div className="bg-[#10b981]/10 border border-[#10b981]/30 p-1.5 rounded-md text-[#10b981]">
            <Target size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Unit FPY */}
            <div className="flex flex-col">
              <span className="text-[16px] text-[#97a7bb] font-semibold">Unit FPY</span>
              <span className="text-[36px] font-black text-white mt-1.5 leading-none">
                {kpis.firstPassYield.unit}%
              </span>
              <div className="flex items-center gap-1 text-[14px] font-bold text-[#10b981] mt-2">
                <TrendingUp size={12} />
                <span>+0.3%</span>
              </div>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-12 bg-[#1d324b]" />

            {/* Module FPY */}
            <div className="flex flex-col">
              <span className="text-[16px] text-[#97a7bb] font-semibold">Module FPY</span>
              <span className="text-[36px] font-black text-white mt-1.5 leading-none">
                {kpis.firstPassYield.module}%
              </span>
              <div className="flex items-center gap-1 text-[14px] font-bold text-[#10b981] mt-2">
                <TrendingUp size={12} />
                <span>+0.1%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Factory WIP */}
      <Card 
        title="Factory WIP" 
        triggerUpdate={kpis.factoryWip.total}
        headerAction={
          <div className="bg-[#eab308]/10 border border-[#eab308]/30 p-1.5 rounded-md text-[#eab308]">
            <Box size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          {/* Main big metric */}
          <div className="text-[42px] font-black text-white tracking-tight leading-none">
            <AnimatedNumber value={kpis.factoryWip.total} />
          </div>

          {/* Three-column bottom split with dividers */}
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 mt-3 border-t border-[#1d324b]/40 pt-3">
            {/* Raw Material */}
            <div className="flex flex-col">
              <span className="text-[14px] text-[#97a7bb] font-semibold">Raw Material</span>
              <span className="text-[18px] font-bold text-white mt-1.5 leading-none">
                {kpis.factoryWip.raw.toLocaleString()}
              </span>
            </div>

            {/* Divider 1 */}
            <div className="w-[1px] h-8 bg-[#1d324b]" />

            {/* Semi Finished */}
            <div className="flex flex-col">
              <span className="text-[14px] text-[#97a7bb] font-semibold">Semi Finished</span>
              <span className="text-[18px] font-bold text-[#eab308] mt-1.5 leading-none">
                {kpis.factoryWip.semi.toLocaleString()}
              </span>
            </div>

            {/* Divider 2 */}
            <div className="w-[1px] h-8 bg-[#1d324b]" />

            {/* Finished Goods */}
            <div className="flex flex-col">
              <span className="text-[14px] text-[#97a7bb] font-semibold">Finished Goods</span>
              <span className="text-[18px] font-bold text-[#10b981] mt-1.5 leading-none">
                {kpis.factoryWip.finished.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Ready to PGI */}
      <Card 
        title="Ready to PGI" 
        triggerUpdate={kpis.readyToShip.lots}
        headerAction={
          <div className="bg-[#10b981]/10 border border-[#10b981]/30 p-1.5 rounded-md text-[#10b981]">
            <Boxes size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          <div className="flex flex-col">
            <span className="text-[42px] font-black text-white tracking-tight leading-none">
              <AnimatedNumber value={kpis.readyToShip.lots} />
            </span>
            <span className="text-[16px] text-[#97a7bb] mt-1.5 font-semibold">
              Lots ready
            </span>
          </div>

          <div className="text-[15px] text-[#97a7bb] font-mono mt-3 border-t border-[#1d324b]/40 pt-2">
            ≈ {kpis.readyToShip.totalUnits.toLocaleString()} units total
          </div>
        </div>
      </Card>

      {/* 6. Headcount */}
      <Card 
        title="Headcount (Shift)" 
        triggerUpdate={kpis.headcount.total}
        headerAction={
          <div className="bg-[#7c3aed]/10 border border-[#7c3aed]/30 p-1.5 rounded-md text-[#a78bfa]">
            <Users size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          <div className="flex flex-col">
            <span className="text-[42px] font-black text-white tracking-tight leading-none">
              <AnimatedNumber value={kpis.headcount.total} />
            </span>
            <span className="text-[16px] text-[#97a7bb] mt-1.5 font-semibold">
              Total Operators
            </span>
          </div>

          <div className="bg-[#080c14] border border-[#1d324b] rounded-lg py-2.5 px-3.5 flex justify-between items-center w-full mt-3 text-[14px] font-bold">
            {/* Male */}
            <div className="flex items-center gap-1 pl-1">
              <span className="text-[#3b82f6] text-base">♂</span>
              <span className="text-[#3b82f6] font-extrabold mr-1">M</span>
              <span className="text-white">{kpis.headcount.male}</span>
            </div>

            {/* Divider 1 */}
            <div className="w-[1px] h-4 bg-[#1d324b]" />

            {/* Female */}
            <div className="flex items-center gap-1">
              <span className="text-[#ec4899] text-base">♀</span>
              <span className="text-[#ec4899] font-extrabold mr-1">F</span>
              <span className="text-white">{kpis.headcount.female}</span>
            </div>

            {/* Divider 2 */}
            <div className="w-[1px] h-4 bg-[#1d324b]" />

            {/* PwD */}
            <div className="flex items-center gap-1.5 pr-1">
              <span className="bg-[#005aff] text-white text-[11px] w-4.5 h-4.5 flex items-center justify-center rounded">♿</span>
              <span className="text-white mr-1">PwD</span>
              <span className="text-white">{kpis.headcount.contractors}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 7. Downtime */}
      <Card 
        title="Downtime (Shift)" 
        triggerUpdate={kpis.downtime.minutes}
        headerAction={
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 p-1.5 rounded-md text-[#ef4444]">
            <Clock size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          {/* Main metric */}
          <div className="flex flex-col">
            <span className="text-[42px] font-black text-[#ef4444] tracking-tight leading-none">
              <AnimatedNumber value={kpis.downtime.minutes} />
            </span>
            <span className="text-[16px] font-bold text-[#ef4444] mt-1.5">
              minutes
            </span>
          </div>

          {/* Bottom Area: Trend Indicator and Sparkline */}
          <div className="flex justify-between items-end mt-2">
            <div className="flex items-center gap-1 text-[14px] font-black text-[#ef4444]">
              <TrendingUp size={13} />
              <span>+{kpis.downtime.diffPercentage}% vs yesterday</span>
            </div>
            
            <div className="flex-shrink-0">
              <MiniSparkline 
                data={[10, 20, 15, 30, 45, 42]} 
                strokeColor="#ef4444" 
                fillColor="rgba(239, 68, 68, 0.04)" 
                width={120} 
                height={26} 
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 8. Shop Floor Conditions */}
      <Card 
        title="Shop Floor Conditions"
        triggerUpdate={kpis.conditions.temp}
        headerAction={
          <div className="bg-[#06b6d4]/10 border border-[#06b6d4]/30 p-1.5 rounded-md text-[#06b6d4]">
            <Thermometer size={14} />
          </div>
        }
      >
        <div className="flex flex-col justify-between h-full pt-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Temperature */}
            <div className="flex flex-col items-center justify-center">
              <Thermometer size={26} className="text-[#06b6d4]" />
              <span className="text-[32px] font-black text-white mt-1.5 leading-none">
                {kpis.conditions.temp}°
              </span>
              <span className="text-[15px] text-[#97a7bb] mt-1.5 font-medium">Temperature</span>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-14 bg-[#1d324b]" />

            {/* Humidity */}
            <div className="flex flex-col items-center justify-center">
              <Droplets size={26} className="text-[#06b6d4]" />
              <span className="text-[32px] font-black text-white mt-1.5 leading-none">
                {kpis.conditions.humidity}%
              </span>
              <span className="text-[15px] text-[#97a7bb] mt-1.5 font-medium">Humidity</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
export default KpiMetricsRow;
