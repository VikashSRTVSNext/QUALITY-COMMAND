import React, { useState, useEffect } from "react";
import FactoryQualityTwin from "../../../components/layout/FactoryQualityTwin";

interface KPIState {
  value: string;
  status: "healthy" | "risk" | "critical";
}

export const DigitalTwinViewport: React.FC = () => {
  const [isTwinModalOpen, setIsTwinModalOpen] = useState(false);
  const [kpis, setKpis] = useState<Record<string, KPIState>>({
    assembly: { value: "88.7%", status: "healthy" },
    smt: { value: "63.6%", status: "critical" },
    material: { value: "72 O/H", status: "risk" },
    packaging: { value: "132 Lots", status: "healthy" },
  });

  // Independent KPI Simulation Loop (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setKpis(() => {
        const assemblyScore = (75 + Math.random() * 21).toFixed(1);
        const assemblyStatus = parseFloat(assemblyScore) >= 86 ? "healthy" : "risk";

        const smtScore = (50 + Math.random() * 32).toFixed(1);
        const smtStatus = parseFloat(smtScore) >= 78 ? "healthy" : parseFloat(smtScore) >= 65 ? "risk" : "critical";

        const materialVal = Math.floor(45 + Math.random() * 51);
        const materialStatus = materialVal >= 76 ? "healthy" : materialVal >= 60 ? "risk" : "critical";

        const packagingVal = Math.floor(95 + Math.random() * 56);
        const packagingStatus = packagingVal >= 130 ? "healthy" : packagingVal >= 110 ? "risk" : "critical";

        return {
          assembly: { value: `${assemblyScore}%`, status: assemblyStatus },
          smt: { value: `${smtScore}%`, status: smtStatus },
          material: { value: `${materialVal} O/H`, status: materialStatus },
          packaging: { value: `${packagingVal} Lots`, status: packagingStatus },
        };
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusClasses = (status: "healthy" | "risk" | "critical") => {
    if (status === "healthy") {
      return { bg: "bg-[#10b981]/5 border-[#10b981]/30", text: "text-[#10b981]" };
    } else if (status === "risk") {
      return { bg: "bg-[#eab308]/5 border-[#eab308]/30", text: "text-[#eab308]" };
    } else {
      return { bg: "bg-[#ef4444]/5 border-[#ef4444]/30", text: "text-[#ef4444]" };
    }
  };

  const assemblyStyle = getStatusClasses(kpis.assembly.status);
  const smtStyle = getStatusClasses(kpis.smt.status);
  const materialStyle = getStatusClasses(kpis.material.status);
  const packagingStyle = getStatusClasses(kpis.packaging.status);

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 relative">
      {/* Absolute Header Overlay */}
      <div className="flex justify-between items-center z-10">
        <h3 className="text-xs uppercase font-bold text-[#52607f] tracking-widest flex items-center gap-2">
          <span>Factory Digital Twin</span>
        </h3>
        <div className="flex gap-3 text-[9px] uppercase font-bold">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Healthy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" /> At Risk
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />{" "}
            Bottleneck
          </span>
        </div>
      </div>

      <div className="flex-grow w-full relative my-2 rounded-md overflow-hidden shadow-2xl min-h-[450px]">
        <FactoryQualityTwin preview={true} onMaximize={() => setIsTwinModalOpen(true)} />
      </div>

      {/* Bottom telemetry overlay cards */}
      <div className="grid grid-cols-4 gap-3 border-t border-[#1a243d] pt-3.5 z-10">
        <div className={`${assemblyStyle.bg} border ${assemblyStyle.bg.includes('border') ? '' : 'border-[#10b981]'} p-3 rounded-lg flex flex-col justify-center transition-all duration-300`}>
          <div className="text-[10px] text-[#94a3b8] font-bold">
            Final Assembly
          </div>
          <div className={`text-sm font-black ${assemblyStyle.text} mt-1`}>
            {kpis.assembly.value}
          </div>
        </div>
        <div className={`${smtStyle.bg} border ${smtStyle.bg.includes('border') ? '' : 'border-[#ef4444]'} p-3 rounded-lg flex flex-col justify-center transition-all duration-300`}>
          <div className="text-[10px] text-[#94a3b8] font-bold">
            SMT Lines
          </div>
          <div className={`text-sm font-black ${smtStyle.text} mt-1`}>
            {kpis.smt.value}
          </div>
        </div>
        <div className={`${materialStyle.bg} border ${materialStyle.bg.includes('border') ? '' : 'border-[#eab308]'} p-3 rounded-lg flex flex-col justify-center transition-all duration-300`}>
          <div className="text-[10px] text-[#94a3b8] font-bold">
            Material Control
          </div>
          <div className={`text-sm font-black ${materialStyle.text} mt-1`}>
            {kpis.material.value}
          </div>
        </div>
        <div className={`${packagingStyle.bg} border ${packagingStyle.bg.includes('border') ? '' : 'border-[#10b981]'} p-3 rounded-lg flex flex-col justify-center transition-all duration-300`}>
          <div className="text-[10px] text-[#94a3b8] font-bold">
            Packaging
          </div>
          <div className={`text-sm font-black ${packagingStyle.text} mt-1`}>
            {kpis.packaging.value}
          </div>
        </div>
      </div>

      {/* 3D Digital Twin Fullscreen Modal */}
      {isTwinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 lg:p-8 transition-all duration-300">
          <div className="relative w-full h-full max-w-[95vw] max-h-[90vh] bg-[#070e17] border border-[#1d324b] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-[#0a1424]/90 px-6 py-4 border-b border-[#142337] z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3fd3c6] animate-pulse" />
                <span className="text-[16px] font-black text-white uppercase tracking-wider">
                  3D Digital Twin Plant Floor View
                </span>
              </div>
              <button 
                onClick={() => setIsTwinModalOpen(false)}
                className="bg-[#122339] hover:bg-[#ef4444] text-[#8fa0b5] hover:text-white border border-[#1b3252] rounded-lg px-4 py-1.5 text-[13px] font-bold cursor-pointer transition-colors duration-200 outline-none"
              >
                ✕ Close view
              </button>
            </div>
            
            {/* Model Viewport */}
            <div className="flex-1 relative min-h-0 bg-[#060a10]">
              <FactoryQualityTwin preview={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DigitalTwinViewport;
