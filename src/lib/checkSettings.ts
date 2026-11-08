import { createClient } from "./supabase/server";
import { EMPTY_CHECK_SETTINGS, type CheckSettings } from "./checks";

/** Bank and check details. Only the admin and payroll can read them (enforced in the database). */
export async function getCheckSettings(): Promise<CheckSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("check_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return EMPTY_CHECK_SETTINGS;
  return { ...EMPTY_CHECK_SETTINGS, ...data, offset_x: Number(data.offset_x), offset_y: Number(data.offset_y) };
}
