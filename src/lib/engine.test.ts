import { describe, expect, it } from "vitest";
import { buildRows, periodOf, recentPeriods, rowKey, weekStartOf, weeksIn } from "./engine";
import type { Settings } from "./rules";

const settings: Settings = {
  session_start: "20:30", session_end: "21:30", clock_in_opens: "19:30", clock_out_closes: "22:00",
  required_minutes: 60, base_rate: 15, test_rate: 20, pay_period: "monthly",
  session_weekdays: [0, 1, 2, 3, 4], timezone: "America/New_York",
};
const students = [
  { id: "a", pin: "1234", active: true, start_date: "2026-01-01" },
  { id: "b", pin: "5678", active: true, start_date: "2026-01-01" },
  { id: "c", pin: "9999", active: true, start_date: "2026-12-01" }, // starts later
];

describe("buildRows", () => {
  const scans = [
    { student_id: null, user_pin: "1234", scanned_at: "2026-11-10T01:25:00Z" },
    { student_id: null, user_pin: "1234", scanned_at: "2026-11-10T02:30:00Z" },
    { student_id: null, user_pin: "5678", scanned_at: "2026-11-10T01:40:00Z" },
    { student_id: null, user_pin: "0000", scanned_at: "2026-11-10T01:40:00Z" }, // unknown PIN
  ];

  it("makes one row per active student per night", () => {
    const rows = buildRows({ nights: ["2026-11-09"], students, scans, testDates: [], takers: [], manual: new Map(), settings });
    expect(rows.map((r) => [r.student_id, r.status, r.amount])).toEqual([
      ["a", "paid", 15],
      ["b", "missing_out", 0],
    ]);
  });

  it("applies a manual clock-out", () => {
    const manual = new Map([[rowKey("b", "2026-11-09"), {
      manual_clock_in: null, manual_clock_out: "2026-11-10T02:45:00Z", manual_note: "forgot to scan", edited_by: "p", edited_at: "x",
    }]]);
    const rows = buildRows({ nights: ["2026-11-09"], students, scans, testDates: [], takers: [], manual, settings });
    const b = rows.find((r) => r.student_id === "b")!;
    expect(b.status).toBe("paid");
    expect(b.minutes).toBe(65);
    expect(b.reason).toContain("forgot to scan");
  });

  it("pays test takers on test night and the test rate afterwards", () => {
    const takers = [{ test_date: "2026-11-09", student_id: "b" }];
    const rows = buildRows({
      nights: ["2026-11-09", "2026-11-10"], students,
      scans: [...scans,
        { student_id: null, user_pin: "5678", scanned_at: "2026-11-11T01:25:00Z" },
        { student_id: null, user_pin: "5678", scanned_at: "2026-11-11T02:30:00Z" }],
      testDates: ["2026-11-09"], takers, manual: new Map(), settings,
    });
    const b9 = rows.find((r) => r.student_id === "b" && r.night === "2026-11-09")!;
    const b10 = rows.find((r) => r.student_id === "b" && r.night === "2026-11-10")!;
    const a9 = rows.find((r) => r.student_id === "a" && r.night === "2026-11-09")!;
    expect([b9.status, b9.amount, b9.test_rate_applied]).toEqual(["test", 20, true]);
    expect([b10.status, b10.amount, b10.test_rate_applied]).toEqual(["paid", 20, true]);
    expect([a9.amount, a9.test_rate_applied]).toEqual([15, false]);
  });
});

describe("periods", () => {
  it("weeks start on Sunday", () => {
    expect(weekStartOf("2026-11-12")).toBe("2026-11-08");
    expect(weeksIn("2026-11-01", "2026-11-30")).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
  });
  it("monthly, weekly and biweekly", () => {
    expect(periodOf("2026-11-17", "monthly")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(periodOf("2026-11-17", "weekly")).toEqual({ start: "2026-11-15", end: "2026-11-21" });
    const bw = periodOf("2026-11-17", "biweekly");
    expect(bw.end).toBe(new Date(Date.parse(bw.start) + 13 * 86400000).toISOString().slice(0, 10));
    expect(recentPeriods("2026-11-17", "monthly", 3).map((p) => p.start)).toEqual(["2026-11-01", "2026-10-01", "2026-09-01"]);
  });
});
