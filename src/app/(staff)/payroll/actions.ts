"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod, periodInfo, periodParam, periodTotals } from "@/lib/payroll";

export async function markPaid(formData: FormData) {
  const me = await requireRole("admin", "payroll");
  const p = parsePeriod(String(formData.get("period")));
  if (!p) throw new Error("Bad period");
  const back = `/payroll/${periodParam(p)}`;
  const info = await periodInfo(p.start, p.end);
  if (info.status !== "ready") redirect(`${back}?error=${encodeURIComponent("This period isn't ready to pay.")}`);

  const totals = await periodTotals(p.start, p.end);
  const missing = totals.filter((t) => !String(formData.get(`check_${t.student_id}`) ?? "").trim());
  if (missing.length) {
    redirect(`${back}?error=${encodeURIComponent(`Enter a check number for: ${missing.map((m) => m.name).join("; ")}`)}`);
  }

  const supabase = await createClient();
  const { data: period, error } = await supabase
    .from("pay_periods")
    .upsert({ period_start: p.start, period_end: p.end, status: "paid", paid_at: new Date().toISOString(), paid_by: me.id }, { onConflict: "period_start,period_end" })
    .select("id")
    .single();
  if (error || !period) redirect(`${back}?error=${encodeURIComponent(error?.message ?? "Could not save")}`);

  const payments = totals.map((t) => ({
    pay_period_id: period!.id,
    student_id: t.student_id,
    base_nights: t.base_nights,
    test_nights: t.test_nights,
    amount: t.amount,
    check_number: String(formData.get(`check_${t.student_id}`)).trim(),
    check_date: String(formData.get(`date_${t.student_id}`) ?? "").trim() || String(formData.get("check_date") ?? "").trim() || null,
  }));
  const { error: payErr } = await supabase.from("payments").upsert(payments);
  if (payErr) redirect(`${back}?error=${encodeURIComponent(payErr.message)}`);

  await supabase.from("audit_log").insert({ user_id: me.id, action: "payroll.paid", details: { ...p, total: totals.reduce((s, t) => s + t.amount, 0) } });
  revalidatePath("/payroll");
  redirect(`${back}?message=${encodeURIComponent("Marked as paid.")}`);
}

export async function reopenPeriod(formData: FormData) {
  const me = await requireRole("admin");
  const p = parsePeriod(String(formData.get("period")));
  if (!p) throw new Error("Bad period");
  const supabase = await createClient();
  await supabase.from("pay_periods").delete().eq("period_start", p.start).eq("period_end", p.end);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "payroll.reopen", details: p });
  revalidatePath("/payroll");
  redirect(`/payroll/${periodParam(p)}?message=${encodeURIComponent("Period reopened. The check numbers were cleared.")}`);
}
