import React, { useEffect } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import KpiMetricsRow from "../../modules/kpi/components/KpiMetricsRow";
import ProcessFlowMap from "../../modules/processFlow/components/ProcessFlowMap";
import DigitalTwinViewport from "../../modules/digitalTwin/components/DigitalTwinViewport";
import LinePerformanceTable from "../../modules/production/components/LinePerformanceTable";
import AttentionCenter from "../../modules/alerts/components/AttentionCenter";
import { Header } from "../../components/layout/Header";
import {
  WarehousePanel,
  MaterialCommandPanel,
  QualityPanel,
  CapacityPanel,
  EnergyPanel,
  ShipmentPanel,
} from "../../modules/bottomPanels/components/BottomPanels";
import { useKpiStore } from "../../modules/kpi/store/kpiStore";

// Production ("Plant Overview") dashboard body. Composition moved out of the old
// App.tsx so App is now just providers + router.
export const ProductionPage: React.FC = () => {
  const updateKpi = useKpiStore((state) => state.updateKpi);
  const planVsActual = useKpiStore((state) => state.planVsActual);

  // Telemetry loop simulating live KPI updates (placeholder until socket bridge
  // feeds these via the query cache).
  useEffect(() => {
    const interval = setInterval(() => {
      const delta = Math.floor(Math.random() * 5);
      updateKpi({
        planVsActual: {
          plan: planVsActual.plan,
          actual: planVsActual.actual + delta,
        },
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [planVsActual, updateKpi]);

  return (
    <DashboardLayout
      header={<Header />}
      kpis={<KpiMetricsRow />}
      processFlow={<ProcessFlowMap />}
      mainLeft={
        <>
          <div className="border border-[#1d324b] bg-[#0e1424] rounded-[12px] overflow-hidden min-h-0">
            <DigitalTwinViewport />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
            <WarehousePanel />
            <MaterialCommandPanel />
          </div>
        </>
      }
      mainCenter={
        <>
          <div className="border border-[#1d324b] bg-[#0e1424] rounded-[12px] overflow-hidden min-h-0">
            <LinePerformanceTable />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
            <QualityPanel />
            <CapacityPanel />
          </div>
        </>
      }
      mainRight={
        <>
          <div className="border border-[#1d324b] bg-[#0e1424] rounded-[12px] overflow-hidden min-h-0">
            <div className="h-full min-h-0">
              <AttentionCenter />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
            <EnergyPanel />
            <ShipmentPanel />
          </div>
        </>
      }
    />
  );
};

export default ProductionPage;
