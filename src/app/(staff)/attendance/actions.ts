"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { recalculate } from "@/lib/attendance";
import { isPaidNight } from "@/lib/locks";
import { addDays, zonedTimeToDate } from "@/lib/rules";
import { weekStartOf } from "@/lib/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullFromCrossChex } from "@/lib/pull";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s);

export async function approveWeek(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const week = String(formData.get("week"));
  if (!isDate(week)) throw new Error("Bad week");
  await recalculate(week, addDays(week, 6));
  const supabase = await createClient();
  const { error } = await supabase.from("week_approvals").upsert({ week_start: week, approved_by: me.id, approved_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "week.approve", details: { week } });
  revalidatePath("/attendance");
}

export async function unapproveWeek(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const week = String(formData.get("week"));
  if (!isDate(week)) throw new Error("Bad week");
  for (let d = week; d <= addDays(week, 6); d = addDays(d, 1)) {
    if (await isPaidNight(d)) redirect(`/attendance?week=${week}&error=${encodeURIComponent("This week is in a pay period that's already paid. Ask the admin to reopen it in Payroll first.")}`);
  }
  const supabase = await createClient();
  await supabase.from("week_approvals").delete().eq("week_start", week);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "week.unapprove", details: { week } });
  revalidatePath("/attendance");
}

/** Unlock the week (if approved, not paid) so a fix can be saved. Returns an error message or null. */
async function prepareEdit(night: string, userId: string): Promise<string | null> {
  if (await isPaidNight(night)) return "This night is in a pay period that's already paid. Ask the admin to reopen it in Payroll first.";
  const supabase = await createClient();
  const week = weekStartOf(night);
  const { data } = await supabase.from("week_approvals").select("week_start").eq("week_start", week).maybeSingle();
  if (data) {
    await supabase.from("week_approvals").delete().eq("week_start", week);
    await supabase.from("audit_log").insert({ user_id: userId, action: "week.unapprove", details: { week, reason: "edited" } });
  }
  return null;
}

export async function saveFix(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const night = String(formData.get("night"));
  const studentId = String(formData.get("student_id"));
  const inT = String(formData.get("clock_in") ?? "").trim();
  const outT = String(formData.get("clock_out") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const back = `/attendance/night/${night}`;
  if (!isDate(night)) throw new Error("Bad date");
  if ((inT && !isTime(inT)) || (outT && !isTime(outT))) redirect(`${back}?error=${encodeURIComponent("Enter times like 20:30.")}`);
  if (!inT && !outT) redirect(`${back}?error=${encodeURIComponent("Enter a clock-in or clock-out time.")}`);
  if (!note) redirect(`${back}?error=${encodeURIComponent("Please give a reason for the fix.")}`);

  const err = await prepareEdit(night, me.id);
  if (err) redirect(`${back}?error=${encodeURIComponent(err)}`);

  const { timezone } = await getSettings();
  const supabase = await createClient();
  const fix = {
    student_id: studentId,
    night,
    status: "absent",
    manual_clock_in: inT ? zonedTimeToDate(night, inT, timezone).toISOString() : null,
    manual_clock_out: outT ? zonedTimeToDate(night, outT, timezone).toISOString() : null,
    manual_note: note,
    edited_by: me.id,
    edited_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("attendance_nights").select("student_id").eq("student_id", studentId).eq("night", night).maybeSingle();
  const { error } = existing
    ? await supabase.from("attendance_nights").update({
        manual_clock_in: fix.manual_clock_in, manual_clock_out: fix.manual_clock_out,
        manual_note: note, edited_by: me.id, edited_at: fix.edited_at,
      }).eq("student_id", studentId).eq("night", night)
    : await supabase.from("attendance_nights").insert(fix);
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "attendance.fix", details: { night, studentId, inT, outT, note } });
  await recalculate(night, night);
  revalidatePath("/attendance");
  redirect(`${back}?message=${encodeURIComponent("Fix saved.")}`);
}

export async function clearFix(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const night = String(formData.get("night"));
  const studentId = String(formData.get("student_id"));
  const back = `/attendance/night/${night}`;
  const err = await prepareEdit(night, me.id);
  if (err) redirect(`${back}?error=${encodeURIComponent(err)}`);
  const supabase = await createClient();
  await supabase.from("attendance_nights")
    .update({ manual_clock_in: null, manual_clock_out: null, manual_note: null, edited_by: null, edited_at: null })
    .eq("student_id", studentId).eq("night", night);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "attendance.clear_fix", details: { night, studentId } });
  await recalculate(night, night);
  revalidatePath("/attendance");
  redirect(`${back}?message=${encodeURIComponent("Fix removed.")}`);
}

export async function addManualScan(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const night = String(formData.get("night"));
  const pin = String(formData.get("pin") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const back = `/attendance/night/${night}`;
  if (!/^\d{4,10}$/.test(pin) || !isTime(time)) redirect(`${back}?error=${encodeURIComponent("Enter a PIN and a time like 20:30.")}`);
  const err = await prepareEdit(night, me.id);
  if (err) redirect(`${back}?error=${encodeURIComponent(err)}`);
  const { timezone } = await getSettings();
  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("id").eq("pin", pin).maybeSingle();
  const { error } = await supabase.from("scans").insert({
    user_pin: pin,
    student_id: student?.id ?? null,
    scanned_at: zonedTimeToDate(night, time, timezone).toISOString(),
    source: "manual",
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "scan.manual", details: { night, pin, time } });
  await recalculate(night, night);
  revalidatePath("/attendance");
  redirect(`${back}?message=${encodeURIComponent(student ? "Scan added." : `Scan added, but no student has PIN ${pin}.`)}`);
}

export async function deleteManualScan(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const night = String(formData.get("night"));
  const id = String(formData.get("scan_id"));
  const back = `/attendance/night/${night}`;
  const err = await prepareEdit(night, me.id);
  if (err) redirect(`${back}?error=${encodeURIComponent(err)}`);
  const supabase = await createClient();
  await supabase.from("scans").delete().eq("id", id).eq("source", "manual");
  await supabase.from("audit_log").insert({ user_id: me.id, action: "scan.delete", details: { night, id } });
  await recalculate(night, night);
  revalidatePath("/attendance");
  redirect(`${back}?message=${encodeURIComponent("Scan removed.")}`);
}

export async function pullScansNow(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const week = String(formData.get("week") ?? "");
  const back = `/attendance${/^\d{4}-\d{2}-\d{2}$/.test(week) ? `?week=${week}&` : "?"}`;
  let msg: string;
  try {
    const r = await pullFromCrossChex(createAdminClient(), 7);
    msg = `message=${encodeURIComponent(`Checked the scanner: ${r.fetched} scans in the last 7 days, ${r.saved} new.`)}`;
    const supabase = await createClient();
    await supabase.from("audit_log").insert({ user_id: me.id, action: "crosschex.manual_pull", details: r });
  } catch (e) {
    msg = `error=${encodeURIComponent(`Couldn't reach CrossChex: ${(e as Error).message}`)}`;
  }
  revalidatePath("/attendance");
  redirect(back + msg);
}
