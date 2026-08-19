import React, { useEffect, useState } from "react";
import { RefreshCw, Calendar, Clock, Menu, ChevronDown } from "lucide-react";

interface HeaderProps {
  isOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isOnline = false }) => {
  const [time, setTime] = useState(new Date());
  const [currentShift, setCurrentShift] = useState<"A" | "B" | "C">("A");

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      {/* Left section: Nokia Logo & Plant Status */}
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 lg:gap-3 2xl:gap-4">
        {/* Nokia Logo Wordmark */}
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

        {/* Visual Separator */}
        <div className="h-6 w-[1.5px] bg-gradient-to-b from-transparent via-line to-transparent hidden sm:block" />

        {/* Status Info */}
        <div className="flex items-center gap-2 lg:gap-2.5 flex-wrap justify-center">
          <span className="text-[13px] lg:text-[15px] 2xl:text-[17px] font-bold text-ink-muted tracking-wider whitespace-nowrap hidden 2xl:inline">
            FACTORY COMMAND CENTER
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[13px] lg:text-[15px] 2xl:text-[17px] font-bold tracking-wider whitespace-nowrap text-info drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
              QUALITY CENTER
            </span>
          </div>
          <span className="bg-healthy/10 text-healthy border border-healthy/25 text-[10px] lg:text-[12px] 2xl:text-[14px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ml-1 2xl:ml-2">
            <span className="w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full bg-healthy animate-soft-pulse" />LIVE
          </span>
        </div>
      </div>

      {/* Right section: Telemetry, Time & Actions */}
      <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 lg:gap-3 2xl:gap-4 w-full lg:w-auto">
        {/* Date Display */}
        <div className="hidden 2xl:flex items-center gap-1 text-[14px] lg:text-[15px] 2xl:text-[17px] text-ink-muted font-medium font-mono">
          <Calendar size={12} className="text-ink-muted" />
          <span className="whitespace-nowrap">
            {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        {/* Clock Display */}
        <div className="flex items-center gap-1 text-[15px] lg:text-[17px] 2xl:text-[19px] text-white font-bold font-mono">
          <Clock size={12} className="text-ink-muted" />
          <span className="whitespace-nowrap">{time.toLocaleTimeString()}</span>
        </div>

        {/* Shift Selector */}
        <button
          type="button"
          onClick={handleShiftToggle}
          className="flex items-center bg-panel hover:bg-[#161f38] border border-line rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold text-ink-muted cursor-pointer select-none transition-all duration-200 outline-none"
        >
          <span className="flex items-center gap-1 text-white mr-0 2xl:mr-2 2xl:border-r 2xl:border-line 2xl:pr-2">
            {shiftInfo[currentShift].label}{" "}
            <ChevronDown
              size={10}
              className="text-ink-muted hidden 2xl:inline"
            />
          </span>
          <span className="text-white whitespace-nowrap hidden 2xl:inline">
            {shiftInfo[currentShift].time}
          </span>
        </button>

        {/* Swipe Entry Status */}
        <div className="flex items-center bg-panel border border-line rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold text-ink-muted gap-1.5 lg:gap-2">
          <span className="whitespace-nowrap hidden 2xl:inline">
            SWIPE ENTRY
          </span>
          <span className="whitespace-nowrap 2xl:hidden">SWIPES</span>
          <span className="text-healthy bg-healthy/15 px-1.5 py-0.5 rounded font-black text-[12px] lg:text-[13px] 2xl:text-[15px]">
            4
          </span>
        </div>

        {/* System Online Status */}
        <div
          className={`flex items-center bg-panel border rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold gap-1 lg:gap-1.5 transition-all duration-500 ${
            isOnline
              ? "border-healthy/80 text-healthy status-glow-success shadow-[0_0_12px_rgba(34, 197, 94,0.15)]"
              : "border-critical/60 text-critical shadow-[0_0_12px_rgba(255, 76, 76,0.15)]"
          }`}
        >
          <span
            className={`w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full ${
              isOnline ? "bg-healthy animate-soft-pulse" : "bg-critical"
            }`}
          />
          <span className="whitespace-nowrap hidden 2xl:inline">
            {isOnline ? "PLANT SYSTEMS ONLINE" : "PLANT SYSTEMS OFFLINE"}
          </span>
          <span className="whitespace-nowrap 2xl:hidden">
            {isOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Data Refresh Status */}
        <div className="flex items-center bg-panel border border-line/80 rounded-md px-2 py-0.5 lg:px-2.5 lg:py-1 2xl:px-3 2xl:py-1.2 text-[14px] lg:text-[15px] 2xl:text-[17px] font-bold text-info gap-1 lg:gap-1.5">
          <RefreshCw size={11} className="text-info" />
          <span className="whitespace-nowrap">
            <span className="hidden 2xl:inline">DATA REFRESH: </span>
            <strong className="text-white">5:22</strong>
          </span>
        </div>

        {/* Navigation Menu Toggle */}
        <button
          type="button"
          className="p-1 lg:p-1.5 hover:bg-line rounded-md text-ink-muted hover:text-white transition-colors"
        >
          <Menu size={14} />
        </button>
      </div>
    </div>
  );
};
export default Header;

