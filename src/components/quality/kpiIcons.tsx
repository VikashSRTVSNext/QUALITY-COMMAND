import {
  Brain,
  CheckCircle2,
  ClipboardList,
  RotateCcw,
  ShieldCheck,
  Target,
  UserCheck,
  Zap,
} from "lucide-react";

// Icon for a KPI card, keyed by the card's numeric id from the feed.
// Returns null for an id with no icon assigned, so callers can render nothing.
export const getKpiIcon = (id: number, color: string, size = 18) => {
  const props = { size, className: "flex-shrink-0", style: { color } };
  switch (id) {
    case 1: // FPY - UNIT
      return <CheckCircle2 {...props} />;
    case 2: // SPY - UNIT
      return <ShieldCheck {...props} />;
    case 3: // FPY - MODULE
      return <CheckCircle2 {...props} />;
    case 4: // SPY - MODULE
      return <Zap {...props} />;
    case 5: // CUSTOMER AUDIT
      return <UserCheck {...props} />;
    case 6:
      return <ClipboardList {...props} />;
    case 7:
      return <RotateCcw {...props} />;
    case 8:
      return <Brain {...props} />;
    case 9: // HFTPY
      return <Target {...props} />;
    default:
      return null;
  }
};
