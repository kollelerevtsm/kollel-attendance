import { describe, expect, it } from "vitest";
import { planSync, topicFor, type ScheduleEntry } from "./torahscha";
import { sessionOverride, topicOf } from "./calendarDay";

const e = (date: string, day_type: string, extra: string | null = null, daf_he: string | null = null, chazaras_hachodesh: string | null = null): ScheduleEntry =>
  ({ date, day_type, extra, daf_he, chazaras_hachodesh, masechta_he: "עירובין" });

describe("torahscha sync", () => {
  it("builds topics", () => {
    expect(topicFor(e("2026-11-03", "daf", null, "פ'", 'דף ס"ג'))).toBe('עירובין פ\' · חזרת החודש: דף ס"ג');
    expect(topicFor(e("2026-11-08", "test", 'דף ס"ו-פ"א', null, 'דף מ"ט-ס"ה'))).toBe('בחינה: עירובין דף ס"ו-פ"א · חזרת החודש: דף מ"ט-ס"ה');
    expect(topicFor(e("2026-09-21", "yt", "יום כיפור"))).toBe("יום כיפור");
    expect(topicFor(e("2026-10-30", "chazara", "חזרה"))).toBe("חזרה");
  });

  it("marks test dates and unmarks ones that moved", () => {
    const existing = new Map([
      ["2026-11-01", { is_test_date: true, sync_type: "test" }], // was a test in the schedule, now a daf
      ["2026-11-02", { is_test_date: true, sync_type: null }], // marked by the principal
    ]);
    const rows = planSync([e("2026-10-01", "test"), e("2026-11-01", "daf"), e("2026-11-02", "daf"), e("2026-11-08", "test")], existing, "2026-10-15", "now");
    expect(rows.map((r) => [r.day, r.is_test_date])).toEqual([
      ["2026-11-01", false],
      ["2026-11-02", true],
      ["2026-11-08", true],
    ]);
  });

  it("Yom Tov days are off unless the principal turned them on", () => {
    const base = { day: "2026-09-20", learning_topic: null, is_test_date: false, sync_type: "yt", sync_topic: "ערב יום כיפור" };
    expect(sessionOverride({ ...base, is_session: null })).toBe(false);
    expect(sessionOverride({ ...base, is_session: true })).toBe(true);
    expect(sessionOverride({ ...base, sync_type: "daf", is_session: null })).toBe(null);
    expect(topicOf({ ...base, is_session: null })).toBe("ערב יום כיפור");
    expect(topicOf({ ...base, is_session: null, learning_topic: "Special shiur" })).toBe("Special shiur");
  });
});
