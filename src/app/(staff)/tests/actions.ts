"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recalculate } from "@/lib/attendance";
import { getSettings, todayIn } from "@/lib/data";

export async function saveTestSheet(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const date = String(formData.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Bad date");
  const checked = new Set(formData.getAll("student").map(String));

  const supabase = await createClient();
  const { data: current } = await supabase.from("test_takers").select("student_id").eq("test_date", date);
  const had = new Set((current ?? []).map((c) => c.student_id as string));
  const remove = [...had].filter((id) => !checked.has(id));
  const add = [...checked].filter((id) => !had.has(id));

  if (remove.length) await supabase.from("test_takers").delete().eq("test_date", date).in("student_id", remove);
  if (add.length) {
    const { error } = await supabase.from("test_takers").insert(add.map((student_id) => ({ test_date: date, student_id, source: "sheet" })));
    if (error) redirect(`/tests?date=${date}&error=${encodeURIComponent(error.message)}`);
  }
  await supabase.from("audit_log").insert({ user_id: me.id, action: "tests.save", details: { date, added: add.length, removed: remove.length } });

  // Rates from this test onward may change; approved weeks stay as they are.
  const { timezone } = await getSettings();
  await recalculate(date, todayIn(timezone));
  revalidatePath("/tests");
  revalidatePath("/attendance");
  redirect(`/tests?date=${date}&message=${encodeURIComponent(`Saved. ${checked.size} students took this test.`)}`);
}
