import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RefreshCw, Calendar, Clock, Menu, ChevronDown } from "lucide-react";

interface HeaderProps {
  isOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isOnline = false }) => {
  const [time, setTime] = useState(new Date());
  const [currentShift, setCurrentShift] = useState<"A" | "B" | "C">("A");
  const navigate = useNavigate();
  const { pathname: currentPath } = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navigateTo = (path: string) => navigate(path);

  const shiftInfo = {
    A: { label: "SHIFT A", time: "6:15 AM – 14:15 PM" },
    B: { label: "SHIFT B", time: "14:15 PM – 22:15 PM" },
    C: { label: "SHIFT C", time: "22:15 PM – 6:15 AM" },
  };

  const handleShiftToggle = () => {
    setCurrentShift((prev) => {
      if (prev === "A") return "B";
      if (prev === "B") return "C";
      return "A";
    });
  };

  return (
    <div className="flex flex-col lg:flex-row justify-between items-center w-full px-2 gap-2 lg:gap-3 2xl:gap-4 py-1">
      {/* Left side: Nokia Logo & Plant Status */}
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 lg:gap-3 2xl:gap-4">
        {/* SVG Nokia Logo Wordmark */}
        <svg
          viewBox="0 0 238 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0 w-[100px] lg:w-[120px] 2xl:w-[135px] h-auto"
        >
          <path
            d="M164.52 1.70304V54.2969H172.407V1.70304H164.52ZM80.2509 0.804622C64.8848 0.804553 52.9624 11.9886 52.9624 28C52.9624 44.7324 64.8848 55.1957 80.2509 55.1954C95.6171 55.1951 107.564 44.7324 107.539 28C107.517 12.8299 95.6171 0.804691 80.2509 0.804622ZM99.6661 28C99.6661 39.8532 90.9737 47.7084 80.2509 47.7084C69.5282 47.7084 60.8357 39.8532 60.8357 28C60.8357 16.3618 69.5282 8.29171 80.2509 8.29171C90.9737 8.29171 99.6661 16.3618 99.6661 28ZM0 4.74601e-06V54.2969H8.04989V18.4143L49.8817 56V44.7427L0 4.74601e-06ZM113.472 28L142.745 54.297H154.483L125.165 28L154.483 1.70302H142.745L113.472 28ZM238 54.2969H229.323L222.978 42.6502H194.239L187.893 54.2969H179.215L189.724 34.8846H218.851L204.327 7.90705L208.608 0L238 54.2969Z"
            fill="white"
          />
        </svg>

        {/* Separator */}
        <div className="h-6 w-[1.5px] bg-gradient-to-b from-transparent via-[#1d324b] to-transparent hidden sm:block" />

        {/* Status Section */}
        <div className="flex items-center gap-2 lg:gap-2.5 flex-wrap justify-center">
          <span className="text-[13px] lg:text-[15px] 2xl:text-[17px] font-bold text-[#97a7bb] tracking-wider whitespace-nowrap hidden 2xl:inline">
            FACTORY COMMAND CENTER
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={() => navigateTo("/production")}
              className={`text-[13px] lg:text-[15px] 2xl:text-[17px] font-bold tracking-wider whitespace-nowrap cursor-pointer transition-all border-none bg-transparent outline-none ${
                currentPath !== "/quality" 
                  ? "text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" 
                  : "text-[#52607f] hover:text-[#97a7bb]"
              }`}
            >
              PLANT OVERVIEW
            </button>
            <span className="text-[#1d324b] text-[12px] font-bold">|</span>
            <button
              onClick={() => navigateTo("/quality")}
              className={`text-[13px] lg:text-[15px] 2xl:text-[17px] font-bold tracking-wider whitespace-nowrap cursor-pointer transition-all border-none bg-transparent outline-none ${
                currentPath === "/quality" 
                  ? "text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" 
                  : "text-[#52607f] hover:text-[#97a7bb]"
              }`}
            >
              QUALITY CENTER
            </button>
          </div>
          <span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/25 text-[10px] lg:text-[12px] 2xl:text-[14px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ml-1 2xl:ml-2">
            <span className="w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full bg-[#10b981] animate-soft-pulse" />
            LIVE
          </span>
        </div>
      </div>

      {/* Right side: Telemetry indicators, time, clock and action buttons */}
      <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 lg:gap-3 2xl:gap-4 w-full lg:w-auto">
        {/* Date Display */}
        <div className="hidden 2xl:flex items-center gap-1 text-[14px] lg:text-[15px] 2xl:text-[17px] text-[#97a7bb] font-medium font-mono">
          <Calendar size={12} className="text-[#97a7bb]" />
          <span className="whitespace-nowrap">
            {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-1 text-[15px] lg:text-[17px] 2xl:text-[19px] text-white font-bold font-mono">
          <Clock size={12} className="text-[#97a7bb]" />
          <span className="whitespace-nowrap">{time.toLocaleTimeString()}</span>
        </div>

        {/* Shift selector badge */}
        <button
          onClick={handleShiftToggle}
          className="flex items-center bg-[#0e1424] hover:bg-[#161f38] border border-[#1d324b] rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold text-[#97a7bb] cursor-pointer select-none transition-all duration-200 outline-none"
        >
          <span className="flex items-center gap-1 text-white mr-0 2xl:mr-2 2xl:border-r 2xl:border-[#1d324b] 2xl:pr-2">
            {shiftInfo[currentShift].label}{" "}
            <ChevronDown
              size={10}
              className="text-[#97a7bb] hidden 2xl:inline"
            />
          </span>
          <span className="text-white whitespace-nowrap hidden 2xl:inline">
            {shiftInfo[currentShift].time}
          </span>
        </button>

        {/* Swipe entry badge */}
        <div className="flex items-center bg-[#0e1424] border border-[#1d324b] rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold text-[#97a7bb] gap-1.5 lg:gap-2">
          <span className="whitespace-nowrap hidden 2xl:inline">
            SWIPE ENTRY
          </span>
          <span className="whitespace-nowrap 2xl:hidden">SWIPES</span>
          <span className="text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded font-black text-[12px] lg:text-[13px] 2xl:text-[15px]">
            4
          </span>
        </div>

        {/* Live connection status badge — driven by /dashboard/status API */}
        <div
          className={`flex items-center bg-[#0e1424] border rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold gap-1 lg:gap-1.5 transition-all duration-500 ${
            isOnline
              ? "border-[#10b981]/80 text-[#10b981] status-glow-success shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              : "border-[#ef4444]/60 text-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.15)]"
          }`}
        >
          <span
            className={`w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full ${
              isOnline ? "bg-[#10b981] animate-soft-pulse" : "bg-[#ef4444]"
            }`}
          />
          <span className="whitespace-nowrap hidden 2xl:inline">
            {isOnline ? "PLANT SYSTEMS ONLINE" : "PLANT SYSTEMS OFFLINE"}
          </span>
          <span className="whitespace-nowrap 2xl:hidden">
            {isOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Data refresh badge */}
        <div className="flex items-center bg-[#0e1424] border border-[#1d324b]/80 rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold text-[#06b6d4] gap-1 lg:gap-1.5">
          <RefreshCw size={11} className="text-[#06b6d4]" />
          <span className="whitespace-nowrap">
            <span className="hidden 2xl:inline">DATA REFRESH: </span>
            <strong className="text-white">5:22</strong>
          </span>
        </div>

        {/* Menu Toggle */}
        <button className="p-1 lg:p-1.5 hover:bg-[#1d324b] rounded-md text-[#97a7bb] hover:text-white transition-colors">
          <Menu size={14} />
        </button>
      </div>
    </div>
  );
};
export default Header;

