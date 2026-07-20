import React from 'react';
import { Outlet } from 'react-router-dom';

// Persistent app chrome. Kept intentionally thin: each dashboard page renders
// its own header today (Production via DashboardLayout, Quality inline). As the
// widget migration proceeds, a shared <Header/> can move up here.
export const AppShell: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#08111a] text-[#f8fafc]">
      <Outlet />
    </div>
  );
};

export default AppShell;
