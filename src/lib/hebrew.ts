import { HDate, HebrewCalendar, flags, type Event } from "@hebcal/core";
import { addDays } from "./rules";

export interface NightInfo {
  date: string; // English date of the evening, "YYYY-MM-DD"
  hebrewDate: string; // Hebrew date of the night (the evening belongs to the next Hebrew day)
  holidays: string[];
  suggestedOff: boolean;
}

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoOf(e: Event): string {
  const g = e.getDate().greg();
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
}

/**
 * Hebrew date and holidays for every evening from `start` to `end` (inclusive).
 * A night is suggested "off" when the evening begins a Yom Tov day
 * (erev Yom Tov, or the first night of a two-day Yom Tov continuing).
 */
export function nightsInfo(start: string, end: string): Map<string, NightInfo> {
  const events = HebrewCalendar.calendar({
    start: toDate(start),
    end: toDate(addDays(end, 1)),
    il: false,
    noModern: true,
    noSpecialShabbat: true,
  });

  const byDay = new Map<string, Event[]>();
  for (const e of events) {
    const k = isoOf(e);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  const out = new Map<string, NightInfo>();
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const tonight = byDay.get(d) ?? [];
    const tomorrow = byDay.get(addDays(d, 1)) ?? [];
    const tomorrowIsChag = tomorrow.some((e) => e.getFlags() & flags.CHAG);
    const holidays = tonight
      .filter((e) => !(e.getFlags() & (flags.DAF_YOMI | flags.OMER_COUNT | flags.SHABBAT_MEVARCHIM)))
      .map((e) => e.render("en"));
    out.set(d, {
      date: d,
      hebrewDate: new HDate(toDate(addDays(d, 1))).renderGematriya(true),
      holidays,
      suggestedOff: tomorrowIsChag,
    });
  }
  return out;
}
