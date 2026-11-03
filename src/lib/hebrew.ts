import { HDate, HebrewCalendar, Locale, ParshaEvent, flags, getSedra, type Event } from "@hebcal/core";
import { addDays, weekday } from "./rules";

export interface NightInfo {
  date: string; // English date of the evening, "YYYY-MM-DD"
  hebrewDate: string; // Hebrew date of the night (the evening belongs to the next Hebrew day)
  holidays: string[];
  categories: HolidayCategory[];
  suggestedOff: boolean;
}

export type HolidayCategory =
  | "yomtov"
  | "motzei_yomtov"
  | "cholhamoed"
  | "chanukah"
  | "purim"
  | "bedikas_chametz"
  | "tishabav";

/** Kinds of nights the principal can choose to have off, with labels for Settings. */
export const HOLIDAY_CATEGORIES: { key: HolidayCategory; label: string }[] = [
  { key: "yomtov", label: "Erev Yom Tov and Yom Tov nights (incl. Rosh Hashana, Yom Kippur)" },
  { key: "motzei_yomtov", label: "Motzei Yom Tov" },
  { key: "cholhamoed", label: "Chol Hamoed nights" },
  { key: "chanukah", label: "Chanukah nights" },
  { key: "purim", label: "Purim night" },
  { key: "bedikas_chametz", label: "Bedikas chametz night (night before Erev Pesach)" },
  { key: "tishabav", label: "Tisha B'Av night" },
];

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
 * A night is suggested "off" when it falls in one of `offCategories` (by default only Yom Tov).
 */
export function nightsInfo(start: string, end: string, offCategories: string[] = ["yomtov"]): Map<string, NightInfo> {
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
  const has = (list: Event[], test: (e: Event) => boolean) => list.some(test);
  const isChag = (e: Event) => Boolean(e.getFlags() & flags.CHAG);

  const out = new Map<string, NightInfo>();
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const tonight = byDay.get(d) ?? [];
    const tomorrow = byDay.get(addDays(d, 1)) ?? [];
    const cats: HolidayCategory[] = [];
    if (has(tomorrow, isChag)) cats.push("yomtov");
    if (has(tonight, isChag) && !has(tomorrow, isChag)) cats.push("motzei_yomtov");
    if (has(tomorrow, (e) => Boolean(e.getFlags() & flags.CHOL_HAMOED)) && !has(tomorrow, isChag)) cats.push("cholhamoed");
    if (has(tonight, (e) => e.getDesc().startsWith("Chanukah:") && e.getDesc().includes("Candle"))) cats.push("chanukah");
    if (has(tomorrow, (e) => e.getDesc() === "Purim")) cats.push("purim");
    if (has(tomorrow, (e) => e.getDesc() === "Erev Pesach")) cats.push("bedikas_chametz");
    if (has(tomorrow, (e) => e.getDesc() === "Tish'a B'Av")) cats.push("tishabav");

    const holidays = tonight
      .filter((e) => !(e.getFlags() & (flags.DAF_YOMI | flags.OMER_COUNT | flags.SHABBAT_MEVARCHIM)))
      .map((e) => e.render("en"));
    out.set(d, {
      date: d,
      hebrewDate: new HDate(toDate(addDays(d, 1))).renderGematriya(true),
      holidays,
      categories: cats,
      suggestedOff: cats.some((c) => offCategories.includes(c)),
    });
  }
  return out;
}

/**
 * The parsha of the week containing `date` (the Shabbat that ends that Sunday–Shabbat week),
 * in Hebrew, e.g. "פרשת חיי שרה". On a Yom Tov Shabbat, the name of the Yom Tov.
 */
export function parshaOfWeek(date: string): string {
  const shabbat = addDays(date, 6 - weekday(date));
  const hd = new HDate(toDate(shabbat));
  const r = getSedra(hd.getFullYear(), false).lookup(hd);
  return r.chag ? Locale.gettext(r.parsha[0], "he-x-NoNikud") : new ParshaEvent(r).render("he-x-NoNikud");
}

function isoOfDate(g: Date): string {
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
}

export interface HebrewMonthRange {
  param: string; // "5787-8"
  title: string; // "חשון תשפ״ז"
  start: string; // English date of the evening of the 1st night of the month
  end: string; // English date of the evening of the last night
  prev: string;
  next: string;
}

/**
 * A Hebrew month as a range of evenings. Each evening is labelled by the Hebrew date of
 * that night, so the month runs from the evening that begins the 1st to the evening that begins the last day.
 * `param` is "year-month" (Hebcal month numbers: Nisan = 1 … Adar II = 13); empty = the month of `today`'s night.
 */
export function hebrewMonthRange(param: string | undefined, today: string): HebrewMonthRange {
  let year: number, month: number;
  const m = param ? /^(\d{4})-(\d{1,2})$/.exec(param) : null;
  if (m && HDate.monthsInYear(Number(m[1])) >= Number(m[2]) && Number(m[2]) >= 1) {
    year = Number(m[1]);
    month = Number(m[2]);
  } else {
    const night = new HDate(toDate(addDays(today, 1)));
    year = night.getFullYear();
    month = night.getMonth();
  }
  const first = new HDate(1, month, year);
  const last = new HDate(HDate.daysInMonth(month, year), month, year);
  const before = new HDate(first.abs() - 1);
  const after = new HDate(last.abs() + 1);
  return {
    param: `${year}-${month}`,
    title: first.renderGematriya(true).split(" ").slice(1).join(" "),
    start: addDays(isoOfDate(first.greg()), -1),
    end: addDays(isoOfDate(last.greg()), -1),
    prev: `${before.getFullYear()}-${before.getMonth()}`,
    next: `${after.getFullYear()}-${after.getMonth()}`,
  };
}

/** Hebrew day of the month for an evening, e.g. "כ״ד". */
export function hebrewDayOfNight(date: string): string {
  return new HDate(toDate(addDays(date, 1))).renderGematriya(true).split(" ")[0];
}
