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

import { rulesFor, periodFor } from "./specialDays";
describe("special days", () => {
  const types = [{ id: "ch", name: "Chol Hamoed", clock_in_opens: "09:00", clock_out_closes: "13:30", session_start: "09:30", session_end: "12:30", required_minutes: 180, base_rate: "40", test_rate: null, color: "amber" }];
  const periods = [
    { id: "p1", day_type_id: "ch", start_date: "2027-04-24", end_date: "2027-04-27", note: null },
    { id: "p2", day_type_id: "ch", start_date: "2027-04-20", end_date: "2027-04-30", note: null },
  ];
  it("picks the most specific range and merges rates", () => {
    expect(periodFor("2027-04-25", periods)?.id).toBe("p1");
    expect(periodFor("2027-05-01", periods)).toBeNull();
    const r = rulesFor("2027-04-25", settings, types, periods).rules;
    expect([r.clock_in_opens, r.required_minutes, r.base_rate, r.test_rate]).toEqual(["09:00", 180, 40, 20]);
  });
  it("pays a daytime Chol Hamoed session by its own rules", () => {
    const rows = buildRows({
      nights: ["2027-04-25"], students: [students[0]],
      scans: [
        { student_id: "a", user_pin: "1234", scanned_at: "2027-04-25T13:05:00Z" }, // 9:05am EDT
        { student_id: "a", user_pin: "1234", scanned_at: "2027-04-25T16:20:00Z" }, // 12:20pm
      ],
      testDates: [], takers: [], manual: new Map(), settings,
      rulesFor: (n) => rulesFor(n, settings, types, periods).rules,
    });
    expect([rows[0].status, rows[0].minutes, rows[0].amount]).toEqual(["paid", 195, 40]);
  });
});

describe("test ID", () => {
  const student = { id: "a", pin: "1234", test_pin: "91234", active: true, start_date: "2026-01-01" };
  const scan = (pin: string, at: string) => ({ student_id: "a", user_pin: pin, scanned_at: at });

  it("a test-finger scan is not a clock-in or clock-out", () => {
    const rows = buildRows({
      nights: ["2026-11-09"], students: [student],
      scans: [scan("91234", "2026-11-10T01:25:00Z"), scan("1234", "2026-11-10T02:30:00Z")],
      testDates: [], takers: [], manual: new Map(), settings,
    });
    expect(rows[0].status).toBe("missing_in");
    expect(rows[0].amount).toBe(0);
  });

  it("In, Test, Out on test night pays the test rate", () => {
    const rows = buildRows({
      nights: ["2026-11-09"], students: [student],
      scans: [scan("1234", "2026-11-10T01:25:00Z"), scan("91234", "2026-11-10T02:00:00Z"), scan("1234", "2026-11-10T02:35:00Z")],
      testDates: ["2026-11-09"], takers: [{ test_date: "2026-11-09", student_id: "a" }], manual: new Map(),
      settings: { ...settings, test_night_attendance: true },
    });
    expect([rows[0].status, rows[0].amount]).toEqual(["paid", settings.test_rate]);
  });

  it("with the setting on, the test scan alone pays nothing that night", () => {
    const rows = buildRows({
      nights: ["2026-11-09"], students: [student],
      scans: [scan("91234", "2026-11-10T02:00:00Z")],
      testDates: ["2026-11-09"], takers: [{ test_date: "2026-11-09", student_id: "a" }], manual: new Map(),
      settings: { ...settings, test_night_attendance: true },
    });
    expect(rows[0].amount).toBe(0);
  });
});
