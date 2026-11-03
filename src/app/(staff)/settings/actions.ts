"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeToMinutes } from "@/lib/rules";

const fail = (msg: string) => redirect(`/settings?error=${encodeURIComponent(msg)}`);
const isTime = (t: string) => /^\d{2}:\d{2}$/.test(t);

export async function saveSettings(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const g = (k: string) => String(formData.get(k) ?? "").trim();

  const times = ["session_start", "session_end", "clock_in_opens", "clock_out_closes"].map(g);
  if (!times.every(isTime)) fail("Please fill in every time.");
  const [sessionStart, sessionEnd, opens, closes] = times.map(timeToMinutes);
  if (!(opens <= sessionStart && sessionStart < sessionEnd && sessionEnd <= closes)) {
    fail("Times must be in order: clock-in opens ≤ session start < session end ≤ clock-out closes.");
  }

  const required = Number(g("required_minutes"));
  const base = Number(g("base_rate"));
  const test = Number(g("test_rate"));
  if (!Number.isInteger(required) || required < 1) fail("Required minutes must be a whole number.");
  if (!(base >= 0) || !(test >= 0)) fail("Rates must be numbers.");
  if (required > closes - opens) fail("Required minutes is longer than the time between clock-in opening and clock-out closing.");

  const weekdays = formData.getAll("session_weekdays").map(Number).filter((n) => n >= 0 && n <= 6);
  if (weekdays.length === 0) fail("Choose at least one session night.");
  const payPeriod = g("pay_period");
  if (!["weekly", "biweekly", "monthly"].includes(payPeriod)) fail("Choose a pay period.");

  const supabase = await createClient();
  const update = {
    session_start: times[0],
    session_end: times[1],
    clock_in_opens: times[2],
    clock_out_closes: times[3],
    required_minutes: required,
    base_rate: base,
    test_rate: test,
    pay_period: payPeriod,
    session_weekdays: weekdays.sort(),
    updated_by: me.id,
  };
  const { error } = await supabase.from("settings").update(update).eq("id", 1);
  if (error) fail(error.message);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "settings.update", details: update });
  revalidatePath("/", "layout");
  redirect(`/settings?message=${encodeURIComponent("Settings saved.")}`);
}

export async function saveDayType(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const id = g("id");
  const name = g("name");
  const times = ["clock_in_opens", "session_start", "session_end", "clock_out_closes"].map(g);
  if (!name) fail("Give the day type a name.");
  if (!times.every(isTime)) fail(`${name}: please fill in every time.`);
  const [opens, start, end, closes] = times.map(timeToMinutes);
  if (!(opens <= start && start < end && end <= closes)) {
    fail(`${name}: times must be in order: clock-in opens ≤ start < end ≤ clock-out closes.`);
  }
  const required = Number(g("required_minutes"));
  if (!Number.isInteger(required) || required < 1 || required > closes - opens) {
    fail(`${name}: required minutes must fit between clock-in opening and clock-out closing.`);
  }
  const rate = (k: string) => (g(k) === "" ? null : Number(g(k)));
  const base = rate("base_rate");
  const test = rate("test_rate");
  if ((base !== null && !(base >= 0)) || (test !== null && !(test >= 0))) fail(`${name}: rates must be numbers.`);

  const row = {
    name,
    clock_in_opens: times[0],
    session_start: times[1],
    session_end: times[2],
    clock_out_closes: times[3],
    required_minutes: required,
    base_rate: base,
    test_rate: test,
    color: g("color") || "purple",
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("day_types").update(row).eq("id", id)
    : await supabase.from("day_types").insert(row);
  if (error) fail(error.message.includes("day_types_name_key") ? "There's already a day type with that name." : error.message);
  await supabase.from("audit_log").insert({ user_id: me.id, action: id ? "day_type.update" : "day_type.create", details: row });
  revalidatePath("/", "layout");
  redirect(`/settings?message=${encodeURIComponent(`Saved "${name}".`)}#special`);
}

export async function deleteDayType(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("day_types").delete().eq("id", id);
  if (error) fail(error.message);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "day_type.delete", details: { id } });
  revalidatePath("/", "layout");
  redirect(`/settings?message=${encodeURIComponent("Day type deleted, along with its dates.")}#special`);
}
