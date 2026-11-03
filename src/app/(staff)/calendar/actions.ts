"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSettings, todayIn } from "@/lib/data";
import { runScheduleSync } from "@/lib/scheduleSync";
import { requireRole, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateDay(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  if (String(formData.get("op")) === "test_many") {
    const days = formData.getAll("days").map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    for (const d of days) {
      const fd = new FormData();
      fd.set("day", d);
      fd.set("op", "test_on");
      await updateDay(fd);
    }
    return;
  }
  const day = String(formData.get("day"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bad date");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("calendar_days").select("*").eq("day", day).maybeSingle();

  const row: Record<string, unknown> = {
    day,
    is_session: existing?.is_session ?? null,
    learning_topic: existing?.learning_topic ?? null,
    is_test_date: existing?.is_test_date ?? false,
    is_review: existing?.is_review ?? false,
    updated_by: me.id,
  };

  const op = String(formData.get("op"));
  if (op === "session_on") row.is_session = true;
  else if (op === "session_off") row.is_session = false;
  else if (op === "session_default") row.is_session = null;
  else if (op === "test_on") row.is_test_date = true;
  else if (op === "test_off") row.is_test_date = false;
  else if (op === "review_on") row.is_review = true;
  else if (op === "review_off") row.is_review = false;
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
