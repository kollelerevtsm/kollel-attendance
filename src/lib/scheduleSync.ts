import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSchedule, planSync } from "./torahscha";
import { addDays } from "./rules";

/** Pull the torahscha.app schedule into calendar_days, from a month ago onward. */
export async function runScheduleSync(supabase: SupabaseClient, today: string): Promise<number> {
  const from = addDays(today, -31);
  const entries = await fetchSchedule();
  const { data: existing, error } = await supabase
    .from("calendar_days").select("day,is_test_date,sync_type").gte("day", from);
  if (error) throw new Error(error.message);
  const rows = planSync(entries, new Map((existing ?? []).map((r) => [r.day as string, r])), from);
  if (rows.length) {
    const { error: upErr } = await supabase.from("calendar_days").upsert(rows, { onConflict: "day" });
    if (upErr) throw new Error(upErr.message);
  }
  return rows.length;
}
