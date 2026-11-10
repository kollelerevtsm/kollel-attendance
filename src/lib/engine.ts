// Turns scans into one attendance row per student per session night.
// Pure function: the database loading/saving lives in attendance.ts.

import { addDays, computeNight, normalizePin, testRateApplies, weekday, type NightStatus, type PayPeriod, type Settings } from "./rules";

export interface EngineStudent {
  id: string;
  pin: string;
  test_pin?: string | null;
  active: boolean;
  start_date: string;
}

export interface EngineScan {
  student_id: string | null;
  user_pin: string;
  scanned_at: string;
}

export interface ManualFix {
  manual_clock_in: string | null;
  manual_clock_out: string | null;
  manual_note: string | null;
  edited_by: string | null;
  edited_at: string | null;
}

export interface AttendanceRow {
  student_id: string;
  night: string;
  clock_in: string | null;
  clock_out: string | null;
  minutes: number | null;
  status: NightStatus;
  rate: number;
  amount: number;
  test_rate_applied: boolean;
  reason: string;
  manual_clock_in: string | null;
  manual_clock_out: string | null;
  manual_note: string | null;
  edited_by: string | null;
  edited_at: string | null;
}

export const rowKey = (studentId: string, night: string) => `${studentId}|${night}`;

export function buildRows(input: {
  nights: string[];
  students: EngineStudent[];
  scans: EngineScan[];
  testDates: string[];
  takers: { test_date: string; student_id: string }[];
  manual: Map<string, ManualFix>;
  settings: Settings;
  /** Rules for a given night (special days); defaults to `settings`. */
  rulesFor?: (night: string) => Settings;
}): AttendanceRow[] {
  const { nights, students, scans, testDates, takers, manual, settings } = input;

  const byPin = new Map<string, string>();
  const testPins = new Set<string>();
  for (const s of students) {
    byPin.set(normalizePin(s.pin), s.id);
    if (s.test_pin) testPins.add(s.test_pin);
  }
  const scansByStudent = new Map<string, Date[]>();
  for (const sc of scans) {
    if (testPins.has(sc.user_pin)) continue; // a test-finger scan only marks the test; it is not a clock-in or clock-out
    const id = sc.student_id ?? byPin.get(sc.user_pin);
    if (!id) continue;
    scansByStudent.set(id, [...(scansByStudent.get(id) ?? []), new Date(sc.scanned_at)]);
  }

  const tookByStudent = new Map<string, Set<string>>();
  for (const t of takers) {
    if (!tookByStudent.has(t.student_id)) tookByStudent.set(t.student_id, new Set());
    tookByStudent.get(t.student_id)!.add(t.test_date);
  }
  const testDateSet = new Set(testDates);

  const rows: AttendanceRow[] = [];
  for (const night of nights) {
    const rules = input.rulesFor ? input.rulesFor(night) : settings;
    for (const s of students) {
      if (!s.active || s.start_date > night) continue;
      const took = tookByStudent.get(s.id) ?? new Set<string>();
      const fix = manual.get(rowKey(s.id, night));
      const testRateActive = testRateApplies(night, testDates, took);
      const r = computeNight({
        night,
        scans: scansByStudent.get(s.id) ?? [],
        settings: rules,
        tookTestTonight: testDateSet.has(night) && took.has(night),
        testRateActive,
        manualIn: fix?.manual_clock_in ? new Date(fix.manual_clock_in) : null,
        manualOut: fix?.manual_clock_out ? new Date(fix.manual_clock_out) : null,
      });
      rows.push({
        student_id: s.id,
        night,
        clock_in: r.clockIn?.toISOString() ?? null,
        clock_out: r.clockOut?.toISOString() ?? null,
        minutes: r.minutes,
        status: r.status,
        rate: r.rate,
        amount: r.amount,
        test_rate_applied: r.rate === rules.test_rate && (testRateActive || r.status === "test"),
        reason: fix?.manual_note ? `${r.reason} (fixed: ${fix.manual_note})` : r.reason,
        manual_clock_in: fix?.manual_clock_in ?? null,
        manual_clock_out: fix?.manual_clock_out ?? null,
        manual_note: fix?.manual_note ?? null,
        edited_by: fix?.edited_by ?? null,
        edited_at: fix?.edited_at ?? null,
      });
    }
  }
  return rows;
}

// ── Weeks and pay periods ────────────────────────────────────

/** The Sunday that starts the week containing `date`. */
export function weekStartOf(date: string): string {
  return addDays(date, -weekday(date));
}

const BIWEEKLY_ANCHOR = "2026-01-04"; // a Sunday

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** The pay period containing `date`: [start, end] inclusive. */
export function periodOf(date: string, kind: Exclude<PayPeriod, "test">): { start: string; end: string } {
  if (kind === "monthly") {
    const [y, m] = date.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { start: date.slice(0, 7) + "-01", end };
  }
  if (kind === "weekly") {
    const start = weekStartOf(date);
    return { start, end: addDays(start, 6) };
  }
  const n = Math.floor(daysBetween(BIWEEKLY_ANCHOR, date) / 14);
  const start = addDays(BIWEEKLY_ANCHOR, n * 14);
  return { start, end: addDays(start, 13) };
}

/** The `count` most recent pay periods up to and including the one containing `today`, newest first. */
export function recentPeriods(today: string, kind: Exclude<PayPeriod, "test">, count: number) {
  const out: { start: string; end: string }[] = [];
  let p = periodOf(today, kind);
  for (let i = 0; i < count; i++) {
    out.push(p);
    p = periodOf(addDays(p.start, -1), kind);
  }
  return out;
}

/** Sundays of every week that overlaps [start, end]. */
export function weeksIn(start: string, end: string): string[] {
  const out: string[] = [];
  for (let w = weekStartOf(start); w <= end; w = addDays(w, 7)) out.push(w);
  return out;
}

/**
 * Pay periods that run from one test (בחינה) to the day before the next, newest first.
 * The current period runs to the day before the next scheduled test, or to today if none is set.
 * Nights before the first test form their own period, starting at `firstNight`.
 */
export function testPeriods(testDates: string[], today: string, firstNight: string | null, count: number) {
  const tests = [...new Set(testDates)].sort();
  const out: { start: string; end: string }[] = [];
  if (tests.length === 0) {
    if (firstNight && firstNight <= today) out.push({ start: firstNight, end: today });
    return out;
  }
  if (firstNight && firstNight < tests[0]) out.push({ start: firstNight, end: addDays(tests[0], -1) });
  for (let i = 0; i < tests.length; i++) {
    if (tests[i] > today) break;
    const end = i + 1 < tests.length ? addDays(tests[i + 1], -1) : today;
    out.push({ start: tests[i], end });
  }
  return out.reverse().slice(0, count);
}
