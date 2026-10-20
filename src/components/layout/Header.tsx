import React, { useEffect, useState } from "react";
import { RefreshCw, Calendar, Clock, Menu, ChevronDown } from "lucide-react";
import brandLogo from "../../assets/tvsnext-logo.png";

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
      {/* Left section: Brand mark & Plant Status */}
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 lg:gap-3 2xl:gap-4">
        {/* Brand wordmark. Sits on a light chip deliberately: the mark's "TVS"
            glyphs are dark navy (#1b2a6b-ish) and would be close to invisible
            directly on bg-panel (#101c2b). The chip keeps the brand colours
            exact rather than recolouring the logo. */}
        <img
          src={brandLogo}
          alt="TVSnext"
          className="flex-shrink-0 w-[92px] lg:w-[108px] 2xl:w-[120px] h-auto rounded bg-white/95 px-1.5 py-1"
        />

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

