import { createClient } from "./supabase/server";
import { getSettings } from "./data";
import { nightsInfo, type NightInfo } from "./hebrew";
import { addDays, isSessionNight, type Settings } from "./rules";
import { sessionOverride, type CalendarRow } from "./calendarDay";
import { assignDafim } from "./daf";

export interface CalendarView {
  settings: Settings;
  rows: Map<string, CalendarRow & { is_review?: boolean }>;
  info: Map<string, NightInfo>;
  isOn: (d: string) => boolean;
  /** What's learned that night: the principal's text, else torahscha, else review/test, else the auto-filled daf. */
  topic: (d: string) => string | null;
  /** Just the auto-filled daf (for placeholders). */
  autoDaf: (d: string) => string | null;
}

/** Everything the calendar knows about the nights from `start` to `end`. */
export async function loadCalendar(start: string, end: string): Promise<CalendarView> {
  const settings = await getSettings();
  const supabase = await createClient();
  const dafStart = settings.daf_start_date && settings.daf_start_masechta && settings.daf_start_daf ? settings.daf_start_date : null;
  const from = dafStart && dafStart < start ? dafStart : start;

  const { data } = await supabase.from("calendar_days").select("*").gte("day", from).lte("day", end);
  const rows = new Map(((data ?? []) as (CalendarRow & { is_review?: boolean })[]).map((r) => [r.day, r]));
  const info = nightsInfo(from, end, settings.off_holidays);
  const isOn = (d: string) => {
    const i = info.get(d);
    return i ? isSessionNight(d, settings.session_weekdays, sessionOverride(rows.get(d)), i.suggestedOff) : false;
  };

  let dafim = new Map<string, string>();
  if (dafStart) {
    const nights: string[] = [];
    const skip = new Set<string>();
    for (let d = dafStart; d <= end; d = addDays(d, 1)) {
      if (!isOn(d)) continue;
      nights.push(d);
      const r = rows.get(d);
      if (r?.is_review || r?.is_test_date) skip.add(d);
    }
    dafim = assignDafim(nights, skip, settings.daf_start_masechta!, settings.daf_start_daf!);
  }

  const topic = (d: string) => {
    const r = rows.get(d);
    if (r?.learning_topic) return r.learning_topic;
    if (r?.sync_topic) return r.sync_topic;
    if (r?.is_test_date) return "בחינה";
    if (r?.is_review) return "חזרה";
    return dafim.get(d) ?? null;
  };
  return { settings, rows, info, isOn, topic, autoDaf: (d) => dafim.get(d) ?? null };
}
