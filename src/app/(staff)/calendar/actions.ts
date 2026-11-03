"use server";

import { revalidatePath } from "next/cache";
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
