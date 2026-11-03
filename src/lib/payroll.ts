import { createClient } from "./supabase/server";
import { getSettings, todayIn } from "./data";
import { approvedWeeks, sessionNights } from "./attendance";
import { weekStartOf } from "./engine";

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
  const name = new Map((students ?? []).map((s) => [s.id as string, `${s.last_name}, ${s.first_name}`]));

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
    .from("attendance_nights").select("student_id,amount,test_rate_applied").gte("night", start).lte("night", end).gt("amount", 0);
  const totals = new Map<string, StudentTotal>();
  for (const r of rows ?? []) {
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
