import React from "react";
import {
  Truck,
  Database,
  FileText,
  Calendar,
  Sliders,
  Cpu,
  Eye,
  FlaskConical,
  Wrench,
  CheckSquare,
  ShieldCheck,
  Box,
} from "lucide-react";

interface ProcessNode {
  id: number;
  name: string;
  value: string;
  status: "Healthy" | "Risk" | "Bottleneck";
  subtext: string;
}

export const ProcessFlowMap: React.FC = () => {
  const nodes: ProcessNode[] = [
    {
      id: 1,
      name: "Material Receipt",
      value: "TO 32",
      status: "Healthy",
      subtext: "On Track",
    },
    {
      id: 2,
      name: "Material Storage",
      value: "4,500",
      status: "Healthy",
      subtext: "On Track",
    },
    {
      id: 3,
      name: "SCM / Order",
      value: "O/H 72",
      status: "Healthy",
      subtext: "On Track",
    },
    {
      id: 4,
      name: "Production Planning",
      value: "99.2%",
      status: "Healthy",
      subtext: "On Track",
    },
    {
      id: 5,
      name: "Material Control",
      value: "94%",
      status: "Healthy",
      subtext: "On Track",
    },
    { id: 6, name: "SMT", value: "93.6%", status: "Risk", subtext: "On Track" },
    {
      id: 7,
      name: "AOI Inspection",
      value: "99.1%",
      status: "Bottleneck",
      subtext: "On Track",
    },
    {
      id: 8,
      name: "Module Testing",
      value: "97.4%",
      status: "Risk",
      subtext: "On Track",
    },
    {
      id: 9,
      name: "Final Assembly Line",
      value: "88.7%",
      status: "Risk",
      subtext: "On Track",
    },
    {
      id: 10,
      name: "Unit Testing",
      value: "98.2%",
      status: "Healthy",
      subtext: "On Track",
    },
    {
      id: 11,
      name: "Customer Audit",
      value: "100%",
      status: "Healthy",
      subtext: "On Track",
    },
    {
      id: 12,
      name: "Centralized Packaging",
      value: "132",
      status: "Healthy",
      subtext: "On Track",
    },
    {
      id: 13,
      name: "PGI",
      value: "132",
      status: "Healthy",
      subtext: "On Track",
    },
  ];

  const getStatusColor = (status: "Healthy" | "Risk" | "Bottleneck") => {
    if (status === "Healthy") return "#22c55e";
    if (status === "Risk") return "#eab308";
    return "#ff4c4c";
  };

  const getCardClasses = (status: "Healthy" | "Risk" | "Bottleneck") => {
    if (status === "Healthy") {
      return "border-[#22c55e]/25 bg-[#22c55e]/5 shadow-[inset_0_0_15px_rgba(34, 197, 94,0.05),_0_4px_12px_rgba(0,0,0,0.15)] hover:border-[#22c55e]/60 hover:shadow-[0_0_15px_rgba(34, 197, 94,0.12),_inset_0_1px_1px_rgba(255,255,255,0.03)]";
    }
    if (status === "Risk") {
      return "border-[#eab308]/25 bg-[#eab308]/5 shadow-[inset_0_0_15px_rgba(234,179,8,0.05),_0_4px_12px_rgba(0,0,0,0.15)] hover:border-[#eab308]/60 hover:shadow-[0_0_15px_rgba(234,179,8,0.12),_inset_0_1px_1px_rgba(255,255,255,0.03)]";
    }
    return "border-[#ff4c4c]/25 bg-[#ff4c4c]/5 shadow-[inset_0_0_15px_rgba(255, 76, 76,0.05),_0_4px_12px_rgba(0,0,0,0.15)] hover:bg-[#ff4c4c]/10 animate-border-pulse-critical";
  };

  const renderPlaceholderIcon = (id: number) => {
    const props = { size: 28, strokeWidth: 1.5, className: "text-white" };
    switch (id) {
      case 1:
        return <Truck {...props} />;
      case 2:
        return <Database {...props} />;
      case 3:
        return <FileText {...props} />;
      case 4:
        return <Calendar {...props} />;
      case 5:
        return <Sliders {...props} />;
      case 6:
        return <Cpu {...props} />;
      case 7:
        return <Eye {...props} />;
      case 8:
        return <FlaskConical {...props} />;
      case 9:
        return <Wrench {...props} />;
      case 10:
        return <CheckSquare {...props} />;
      case 11:
        return <ShieldCheck {...props} />;
      case 12:
        return <Box {...props} />;
      case 13:
        return <Truck {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Header Container */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Blue line marker */}
          <div className="w-1 h-4 bg-[#005aff] rounded-full" />
          <h3 className="text-[13px] font-black text-white uppercase tracking-wider">
            End-to-End Factory Process Flow
          </h3>
          <div className="flex gap-4 text-[13px] ml-6 font-bold">
            <span className="flex items-center gap-2 text-[#97a7bb]">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Healthy
            </span>
            <span className="flex items-center gap-2 text-[#97a7bb]">
              <span className="w-2 h-2 rounded-full bg-[#eab308]" /> Risk
            </span>
            <span className="flex items-center gap-2 text-[#97a7bb]">
              <span className="w-2 h-2 rounded-full bg-[#ff4c4c]" /> Bottleneck
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Map & Pipeline Section */}
      <div className="w-full overflow-x-auto select-none flex-grow flex flex-col py-2">
        {/* Nodes Map Row */}
        <div className="flex items-center justify-between gap-1.5 min-w-[3500px] flex-grow">
          {nodes.map((node, index) => {
            const statusColor = getStatusColor(node.status);
            return (
              <React.Fragment key={node.id}>
                <div
                  className={`flex flex-col justify-between w-[245px] h-[175px] p-5 rounded-[12px] border flex-shrink-0 transition-all duration-300 ${getCardClasses(
                    node.status,
                  )}`}
                >
                  {/* Stage Number */}
                  <div className="text-[14px] font-black text-white text-center tracking-wider leading-none">
                    {node.id}
                  </div>

                  {/* Stage Title */}
                  <div className="text-[14px] font-extrabold text-white text-center tracking-tight leading-snug mt-2 flex-grow flex items-center justify-center">
                    {node.name}
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-center justify-center gap-4 mt-3 w-full">
                    {/* Icon Wrapper */}
                    <div className="w-[32px] h-[32px] flex items-center justify-center flex-shrink-0">
                      {renderPlaceholderIcon(node.id)}
                    </div>

                    {/* Text Details */}
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-[18px] font-black text-white leading-none tracking-wide truncate w-full">
                        {node.value}
                      </span>
                      <span
                        className="text-[12px] font-bold mt-1.5 leading-none"
                        style={{ color: statusColor }}
                      >
                        {node.subtext}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Connective Chevron Markers */}
                {index < nodes.length - 1 && (
                  <div className="flex-shrink-0 flex items-center justify-center px-1 text-[11px] font-black tracking-tighter text-[#1d324b]/80 animate-pulse duration-1000">
                    <span
                      style={{
                        color: getStatusColor(nodes[index + 1].status) + "50",
                      }}
                    >
                      &gt;&gt;
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Bottom Pipeline System */}
        <div className="relative min-w-[3500px] h-[18px] mt-4 flex items-center px-[120px]">
          {/* Continuous Gradient Line */}
          <div
            className="absolute inset-x-[120px] h-[3px] rounded-full"
            style={{
              background: `linear-gradient(to right, #22c55e 0%, #22c55e 38%, #eab308 42%, #ff4c4c 50%, #eab308 58%, #eab308 66%, #22c55e 73%, #22c55e 100%)`,
            }}
          />

          {/* Circular Indicators aligned with Card centers */}
          <div className="absolute inset-x-[120px] h-full flex justify-between items-center">
            {nodes.map((node) => {
              const statusColor = getStatusColor(node.status);
              return (
                <div
                  key={node.id}
                  className="w-3.5 h-3.5 rounded-full border-2 border-[#08111a] flex items-center justify-center transition-all duration-300 relative z-10"
                  style={{
                    backgroundColor: statusColor,
                    boxShadow: `0 0 8px ${statusColor}60`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessFlowMap;
