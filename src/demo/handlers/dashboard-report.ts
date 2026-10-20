// Flattens the per-day alert fixtures into report rows.
//
// Split from alerts.ts so the shift-report handler does not import the whole
// dashboard handler module (and its transitive aggregation imports) just to read
// one fixture kind.

import { attentionDay, daysInRange } from "../fixtureStore";

export interface ReportRow {
  business_date: string;
  shift: string;
  alert_id: string;
  title: string;
  severity: string;
  impact: string;
  current_value: number | null;
  target_value: number | null;
  unit: string;
  deviation: number | null;
  age_minutes: number | null;
}

/**
 * Alert rows for an inclusive day range.
 *
 * The shift column is derived from the alert's age rather than stored: the
 * fixtures carry one alert set per production day, and the report is expected
 * to be shift-attributable. Age maps backwards from the end of the day, so a
 * fresh alert lands in C and an old one in A.
 */
export const attentionForRange = async (
  from: string,
  to: string,
  shift: string | null,
): Promise<ReportRow[]> => {
  const days = daysInRange(from, to);
  const out: ReportRow[] = [];

  for (const day of days) {
    const fixture = await attentionDay(day);
    for (const alert of fixture?.alerts ?? []) {
      const age = alert.age_minutes ?? 0;
      const letter = age < 160 ? "C" : age < 320 ? "B" : "A";
      if (shift && letter !== shift.toUpperCase()) continue;
      out.push({
        business_date: day,
        shift: letter,
        alert_id: alert.id,
        title: alert.title,
        severity: alert.severity,
        impact: alert.impact,
        current_value: alert.current_value ?? null,
        target_value: alert.target_value ?? null,
        unit: alert.unit ?? "",
        deviation: alert.deviation ?? null,
        age_minutes: age,
      });
    }
  }

  return out;
};
