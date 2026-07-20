import React from "react";

interface DashboardLayoutProps {
  header: React.ReactNode;
  kpis: React.ReactNode;
  processFlow: React.ReactNode;
  mainLeft: React.ReactNode;
  mainCenter: React.ReactNode;
  mainRight: React.ReactNode;
  footer?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  header,
  kpis,
  processFlow,
  mainLeft,
  mainCenter,
  mainRight,
  footer,
}) => {
  return (
    <div className="w-full min-h-screen bg-[#08111a] text-[#f8fafc] text-[17px] flex flex-col p-6 box-border gap-6">
      {/* Header Container */}
      <header className="h-[68px] w-full flex-shrink-0 flex items-center justify-between border-b border-[#1d324b]">
        {header}
      </header>

      <section className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8 gap-6 flex-shrink-0">
        {kpis}
      </section>

      {/* Live Manufacturing Flow Map (Industrial Pipe/Line Mapping) */}
      <section className="w-full border border-[#1d324b] bg-[#0e1424] rounded-[12px] p-6 flex-shrink-0">
        {processFlow}
      </section>

      {/* Main Analysis Hub: 3-Column Split Grid */}
      <main className="w-full grid grid-cols-1 2xl:grid-cols-[4.8fr_4.2fr_3fr] gap-6">
        {/* Left Column: Digital Twin & Warehouse/Material */}
        <section className="flex flex-col gap-6">{mainLeft}</section>

        {/* Center Column: Line Performance Overview & Quality/Capacity */}
        <section className="flex flex-col gap-6">{mainCenter}</section>

        {/* Right Column: Attention Center & Energy/Shipment */}
        <section className="flex flex-col gap-6">{mainRight}</section>
      </main>

      {/* Footer System Status Panel */}
      {footer && (
        <footer className="min-h-[50px] py-2 w-full flex-shrink-0 flex flex-col md:flex-row items-center justify-between border-t border-[#1d324b] text-[#97a7bb] gap-2">
          {footer}
        </footer>
      )}
    </div>
  );
};
export default DashboardLayout;
