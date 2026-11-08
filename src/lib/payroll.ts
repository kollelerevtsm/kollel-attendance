import { createClient } from "./supabase/server";
import { displayName } from "@/lib/names";
import { getSettings, todayIn } from "./data";
import { approvedWeeks, sessionNights } from "./attendance";
import { recentPeriods, testPeriods, weekStartOf } from "./engine";
import type { Settings } from "./rules";

export type PeriodStatus = "paid" | "not_finished" | "needs_approval" | "ready";

export const PERIOD_LABEL: Record<PeriodStatus, string> = {
  paid: "Paid",
  not_finished: "Not finished",
  needs_approval: "Waiting for principal",
  ready: "Ready to pay",
};

export interface StudentTotal {
  student_id: string;
  name: string;
  base_nights: number;
  test_nights: number;
  amount: number;
  check_number: string | null;
  check_date: string | null;
}

export const periodParam = (p: { start: string; end: string }) => `${p.start}_${p.end}`;
export function parsePeriod(param: string): { start: string; end: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(param);
  return m && m[1] <= m[2] ? { start: m[1], end: m[2] } : null;
}

export async function periodInfo(start: string, end: string) {
  const supabase = await createClient();
  const { timezone } = await getSettings();
  const today = todayIn(timezone);

  const { data: paid } = await supabase
    .from("pay_periods").select("*").eq("period_start", start).eq("period_end", end).maybeSingle();

  const nights = await sessionNights(start, end);
  const approved = await approvedWeeks();
  const unapproved = [...new Set(nights.map(weekStartOf))].filter((w) => !approved.has(w));

  let status: PeriodStatus;
  if (paid?.status === "paid") status = "paid";
  else if (end >= today) status = "not_finished";
  else if (unapproved.length) status = "needs_approval";
  else status = "ready";

  return { status, paidRow: paid, unapprovedWeeks: unapproved };
}

/** Totals per student. For a paid period, the saved payments; otherwise live from attendance. */
export async function periodTotals(start: string, end: string, paidRowId?: string): Promise<StudentTotal[]> {
  const supabase = await createClient();
  const { data: students } = await supabase.from("students").select("id,first_name,last_name");
  const name = new Map((students ?? []).map((s) => [s.id as string, displayName(s.first_name, s.last_name)]));

  if (paidRowId) {
    const { data } = await supabase.from("payments").select("*").eq("pay_period_id", paidRowId);
    return (data ?? [])
      .map((p) => ({
        student_id: p.student_id, name: name.get(p.student_id) ?? "?", base_nights: p.base_nights,
        test_nights: p.test_nights, amount: Number(p.amount), check_number: p.check_number, check_date: p.check_date,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const { data: rows } = await supabase
    .from("attendance_nights").select("student_id,night,amount,test_rate_applied").gte("night", start).lte("night", end).gt("amount", 0);
  const alreadyPaid = await paidNightsCheck(start, end);
  const totals = new Map<string, StudentTotal>();
  for (const r of rows ?? []) {
    if (alreadyPaid(r.student_id, r.night)) continue; // paid in another period (e.g. before the pay period was changed)
    const t = totals.get(r.student_id) ?? {
      student_id: r.student_id, name: name.get(r.student_id) ?? "?", base_nights: 0, test_nights: 0, amount: 0, check_number: null, check_date: null,
    };
    if (r.test_rate_applied) t.test_nights++;
    else t.base_nights++;
    t.amount += Number(r.amount);
    totals.set(r.student_id, t);
  }
  return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A test for "was this student already paid for this night?", from every paid period
 * overlapping [start, end] in which the student got a check.
 */
export async function paidNightsCheck(start: string, end: string): Promise<(studentId: string, night: string) => boolean> {
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("pay_periods").select("id,period_start,period_end").eq("status", "paid").lte("period_start", end).gte("period_end", start);
  if (!periods?.length) return () => false;
  const { data: pays } = await supabase.from("payments").select("pay_period_id,student_id").in("pay_period_id", periods.map((p) => p.id));
  const ranges = new Map<string, { start: string; end: string }[]>();
  const byId = new Map(periods.map((p) => [p.id as string, p]));
  for (const pay of pays ?? []) {
    const p = byId.get(pay.pay_period_id)!;
    ranges.set(pay.student_id, [...(ranges.get(pay.student_id) ?? []), { start: p.period_start, end: p.period_end }]);
  }
  return (studentId, night) => (ranges.get(studentId) ?? []).some((r) => r.start <= night && night <= r.end);
}

/** The most recent pay periods, newest first: calendar periods, or test to test. */
export async function listPeriods(settings: Settings, today: string, count: number) {
  if (settings.pay_period !== "test") return recentPeriods(today, settings.pay_period, count);
  const supabase = await createClient();
  const [{ data: tests }, { data: first }] = await Promise.all([
    supabase.from("calendar_days").select("day").eq("is_test_date", true),
    supabase.from("attendance_nights").select("night").order("night").limit(1),
  ]);
  return testPeriods((tests ?? []).map((t) => t.day as string), today, (first?.[0]?.night as string) ?? null, count);
}

/** What each student is owed right now: every paid night up to today not yet covered by a check. */
export async function owedNow(today: string): Promise<{ student_id: string; name: string; nights: number; amount: number; since: string }[]> {
  const supabase = await createClient();
  const [{ data: students }, { data: rows }] = await Promise.all([
    supabase.from("students").select("id,first_name,last_name"),
    supabase.from("attendance_nights").select("student_id,night,amount").lte("night", today).gt("amount", 0),
  ]);
  const name = new Map((students ?? []).map((s) => [s.id as string, displayName(s.first_name, s.last_name)]));
  const nights = (rows ?? []).map((r) => r.night as string).sort();
  if (!nights.length) return [];
  const alreadyPaid = await paidNightsCheck(nights[0], today);
  const owed = new Map<string, { student_id: string; name: string; nights: number; amount: number; since: string }>();
  for (const r of rows ?? []) {
    if (alreadyPaid(r.student_id, r.night)) continue;
    const o = owed.get(r.student_id) ?? { student_id: r.student_id, name: name.get(r.student_id) ?? "?", nights: 0, amount: 0, since: r.night };
    o.nights++;
    o.amount += Number(r.amount);
    if (r.night < o.since) o.since = r.night;
    owed.set(r.student_id, o);
  }
  return [...owed.values()].sort((a, b) => a.name.localeCompare(b.name));
}
