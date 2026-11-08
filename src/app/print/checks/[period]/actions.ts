"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod, periodInfo, periodParam, periodTotals } from "@/lib/payroll";
import { getCheckSettings } from "@/lib/checkSettings";

/** After the checks print correctly: record each student's check number and lock the period as paid. */
export async function saveChecksAsPaid(formData: FormData) {
  const me = await requireRole("admin", "payroll");
  const p = parsePeriod(String(formData.get("period")));
  if (!p) throw new Error("Bad period");
  const start = Math.floor(Number(formData.get("start")));
  const date = String(formData.get("date") ?? "");
  const here = `/print/checks/${periodParam(p)}?start=${start}&date=${date}`;
  const fail = (m: string) => redirect(`${here}&error=${encodeURIComponent(m)}`);
  if (!(start > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Enter the first check number and the date.");

  const info = await periodInfo(p.start, p.end);
  if (info.status !== "ready") fail("This period isn't ready to pay.");
  const totals = await periodTotals(p.start, p.end); // same order as the printed checks
  if (!totals.length) fail("No checks to save.");

  const supabase = await createClient();
  const { data: period, error } = await supabase
    .from("pay_periods")
    .upsert({ period_start: p.start, period_end: p.end, status: "paid", paid_at: new Date().toISOString(), paid_by: me.id }, { onConflict: "period_start,period_end" })
    .select("id").single();
  if (error || !period) fail(error?.message ?? "Could not save");

  const { error: payErr } = await supabase.from("payments").upsert(totals.map((t, i) => ({
    pay_period_id: period!.id, student_id: t.student_id, base_nights: t.base_nights, test_nights: t.test_nights,
    amount: t.amount, check_number: String(start + i), check_date: date,
  })));
  if (payErr) fail(payErr.message);

  const cs = await getCheckSettings();
  const next = start + totals.length;
  if (next > cs.next_check_number) await supabase.from("check_settings").update({ next_check_number: next }).eq("id", 1);

  await supabase.from("audit_log").insert({
    user_id: me.id, action: "payroll.paid",
    details: { ...p, checks: `${start}-${next - 1}`, total: totals.reduce((s, t) => s + t.amount, 0) },
  });
  revalidatePath("/payroll");
  redirect(`/payroll/${periodParam(p)}?message=${encodeURIComponent(`Marked as paid: checks #${start}–#${next - 1}.`)}`);
}
