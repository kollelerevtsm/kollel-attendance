// Special day types and the date ranges they apply to.

import type { Settings } from "./rules";

export interface DayType {
  id: string;
  name: string;
  clock_in_opens: string;
  clock_out_closes: string;
  session_start: string;
  session_end: string;
  required_minutes: number;
  base_rate: number | string | null;
  test_rate: number | string | null;
  color: string;
}

export interface SpecialPeriod {
  id: string;
  day_type_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
}

export const COLORS: Record<string, string> = {
  purple: "bg-purple-100 text-purple-800",
  amber: "bg-amber-100 text-amber-900",
  sky: "bg-sky-100 text-sky-800",
  rose: "bg-rose-100 text-rose-800",
  teal: "bg-teal-100 text-teal-800",
};

/** The special period covering a date. If ranges overlap, the shorter (more specific) one wins. */
export function periodFor(date: string, periods: SpecialPeriod[]): SpecialPeriod | null {
  let best: SpecialPeriod | null = null;
  for (const p of periods) {
    if (p.start_date <= date && date <= p.end_date) {
      if (!best || span(p) < span(best)) best = p;
    }
  }
  return best;
}

const span = (p: SpecialPeriod) => Date.parse(p.end_date) - Date.parse(p.start_date);

/** The rules for one date: the regular settings, with the special day type's times and rates if one applies. */
export function rulesFor(date: string, settings: Settings, types: DayType[], periods: SpecialPeriod[]): { rules: Settings; type: DayType | null } {
  const p = periodFor(date, periods);
  const t = p ? types.find((x) => x.id === p.day_type_id) ?? null : null;
  if (!t) return { rules: settings, type: null };
  return {
    type: t,
    rules: {
      ...settings,
      clock_in_opens: t.clock_in_opens,
      clock_out_closes: t.clock_out_closes,
      session_start: t.session_start,
      session_end: t.session_end,
      required_minutes: t.required_minutes,
      base_rate: t.base_rate === null || t.base_rate === "" ? settings.base_rate : Number(t.base_rate),
      test_rate: t.test_rate === null || t.test_rate === "" ? settings.test_rate : Number(t.test_rate),
    },
  };
}
