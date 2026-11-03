import { createClient } from "./supabase/server";
import { getSettings, todayIn } from "./data";
import { nightsInfo } from "./hebrew";
import { addDays, isSessionNight } from "./rules";
import { sessionOverride, type CalendarRow } from "./calendarDay";
import { buildRows, rowKey, weekStartOf, type ManualFix } from "./engine";

/** Session nights between start and end (inclusive), using the calendar and holidays. */
export async function sessionNights(start: string, end: string): Promise<string[]> {
  const supabase = await createClient();
  const settings = await getSettings();
  const { data } = await supabase.from("calendar_days").select("day,is_session,learning_topic,is_test_date,sync_type").gte("day", start).lte("day", end);
  const overrides = new Map((data ?? []).map((d) => [d.day as string, sessionOverride(d as CalendarRow)]));
  const info = nightsInfo(start, end);
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isSessionNight(d, settings.session_weekdays, overrides.get(d), info.get(d)!.suggestedOff)) out.push(d);
  }
  return out;
}

export async function approvedWeeks(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("week_approvals").select("week_start");
  return new Set((data ?? []).map((w) => w.week_start as string));
}

/**
 * Recalculate attendance rows for [start, end] from scans, test sheets and manual fixes.
 * Nights in approved weeks are never changed. Future nights are skipped.
 */
export async function recalculate(start: string, end: string): Promise<{ nights: number; rows: number }> {
  const supabase = await createClient();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const last = end < today ? end : today;
  if (start > last) return { nights: 0, rows: 0 };

  const approved = await approvedWeeks();
  const allNights = await sessionNights(start, last);
  const nights = allNights.filter((n) => !approved.has(weekStartOf(n)));

  const [students, scans, tests, takers, existing] = await Promise.all([
    supabase.from("students").select("id,pin,active,start_date"),
    supabase
      .from("scans")
      .select("student_id,user_pin,scanned_at")
      .gte("scanned_at", `${addDays(start, -1)}T00:00:00Z`)
      .lte("scanned_at", `${addDays(last, 2)}T00:00:00Z`),
    supabase.from("calendar_days").select("day").eq("is_test_date", true),
    supabase.from("test_takers").select("test_date,student_id"),
    supabase
      .from("attendance_nights")
      .select("student_id,night,manual_clock_in,manual_clock_out,manual_note,edited_by,edited_at")
      .gte("night", start)
      .lte("night", last),
  ]);
  for (const r of [students, scans, tests, takers, existing]) {
    if (r.error) throw new Error(r.error.message);
  }

  const manual = new Map<string, ManualFix>();
  for (const e of existing.data ?? []) {
    if (e.manual_clock_in || e.manual_clock_out) manual.set(rowKey(e.student_id, e.night), e as ManualFix);
  }

  const rows = buildRows({
    nights,
    students: students.data ?? [],
    scans: scans.data ?? [],
    testDates: (tests.data ?? []).map((t) => t.day as string),
    takers: takers.data ?? [],
    manual,
    settings,
  });

  if (rows.length) {
    const { error } = await supabase.from("attendance_nights").upsert(rows);
    if (error) throw new Error(error.message);
  }

  // Remove rows for nights that are no longer session nights (only in unapproved weeks).
  const keep = new Set(allNights);
  const stale = [...new Set((existing.data ?? []).map((e) => e.night as string))].filter(
    (n) => !keep.has(n) && !approved.has(weekStartOf(n)),
  );
  if (stale.length) await supabase.from("attendance_nights").delete().in("night", stale);

  return { nights: nights.length, rows: rows.length };
}
