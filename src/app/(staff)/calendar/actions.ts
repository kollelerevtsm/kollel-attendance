"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSettings, todayIn } from "@/lib/data";
import { runScheduleSync } from "@/lib/scheduleSync";
import { requireRole, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateDay(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const day = String(formData.get("day"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bad date");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("calendar_days").select("*").eq("day", day).maybeSingle();

  const row: Record<string, unknown> = {
    day,
    is_session: existing?.is_session ?? null,
    learning_topic: existing?.learning_topic ?? null,
    is_test_date: existing?.is_test_date ?? false,
    updated_by: me.id,
  };

  const op = String(formData.get("op"));
  if (op === "session_on") row.is_session = true;
  else if (op === "session_off") row.is_session = false;
  else if (op === "session_default") row.is_session = null;
  else if (op === "test_on") row.is_test_date = true;
  else if (op === "test_off") row.is_test_date = false;
  else if (op === "topic") row.learning_topic = String(formData.get("learning_topic") ?? "").trim() || null;

  const { error } = await supabase.from("calendar_days").upsert(row);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({ user_id: me.id, action: `calendar.${op}`, details: { day } });
  revalidatePath("/calendar");
  revalidatePath("/tests");
}

export async function syncSchedule() {
  const me = await requireRole(...MANAGERS);
  const supabase = await createClient();
  const { timezone } = await getSettings();
  let target: string;
  try {
    const n = await runScheduleSync(supabase, todayIn(timezone));
    await supabase.from("audit_log").insert({ user_id: me.id, action: "calendar.sync", details: { days: n } });
    target = `/calendar?synced=${encodeURIComponent(`Updated ${n} days from torahscha.app.`)}`;
  } catch (e) {
    target = `/calendar?sync_error=${encodeURIComponent(`Couldn't update: ${(e as Error).message}`)}`;
  }
  revalidatePath("/calendar");
  redirect(target);
}

export async function addSpecialPeriod(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const back = g("back") || "/calendar";
  const row = { day_type_id: g("day_type_id"), start_date: g("start_date"), end_date: g("end_date") || g("start_date"), note: g("note") || null, created_by: me.id };
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const sep = back.includes("?") ? "&" : "?";
  if (!row.day_type_id || !isDate(row.start_date) || !isDate(row.end_date)) redirect(`${back}${sep}sync_error=${encodeURIComponent("Choose a day type and dates.")}`);
  if (row.end_date < row.start_date) redirect(`${back}${sep}sync_error=${encodeURIComponent("The end date is before the start date.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("special_periods").insert(row);
  if (error) redirect(`${back}${sep}sync_error=${encodeURIComponent(error.message)}`);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "special.add", details: row });
  revalidatePath("/calendar");
  revalidatePath("/attendance");
  redirect(back);
}

export async function deleteSpecialPeriod(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const id = String(formData.get("id"));
  const back = String(formData.get("back") || "/calendar");
  const supabase = await createClient();
  await supabase.from("special_periods").delete().eq("id", id);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "special.delete", details: { id } });
  revalidatePath("/calendar");
  revalidatePath("/attendance");
  redirect(back);
}
