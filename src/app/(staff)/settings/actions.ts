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
  if (!["weekly", "biweekly", "monthly", "test"].includes(payPeriod)) fail("Choose a pay period.");

  const offHolidays = formData.getAll("off_holidays").map(String);
  const claimDays = Number(g("test_claim_days") || 0);
  if (!Number.isInteger(claimDays) || claimDays < 0 || claimDays > 60) fail("Days to claim a test must be a whole number from 0 to 60.");
  const dafMasechta = g("daf_start_masechta") || null;
  const dafNum = g("daf_start_daf") ? Number(g("daf_start_daf")) : null;
  const dafDate = g("daf_start_date") || null;
  if (dafMasechta && (!dafNum || !Number.isInteger(dafNum) || dafNum < 2 || !dafDate)) {
    fail("For the daf schedule, fill in the masechta, a daf (2 or more) and the date it was learned.");
  }
  const supabase = await createClient();
  const update = {
    off_holidays: offHolidays,
    test_claim_days: claimDays,
    test_night_attendance: formData.get("test_night_attendance") === "on",
    daf_start_masechta: dafMasechta,
    daf_start_daf: dafMasechta ? dafNum : null,
    daf_start_date: dafMasechta ? dafDate : null,
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

export async function addSpecialPeriod(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const back = "/settings";
  const row = { day_type_id: g("day_type_id"), start_date: g("start_date"), end_date: g("end_date") || g("start_date"), note: g("note") || null, created_by: me.id };
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (!row.day_type_id || !isDate(row.start_date) || !isDate(row.end_date)) redirect(`${back}?error=${encodeURIComponent("Choose a day type and dates.")}`);
  if (row.end_date < row.start_date) redirect(`${back}?error=${encodeURIComponent("The end date is before the start date.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("special_periods").insert(row);
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "special.add", details: row });
  revalidatePath("/calendar");
  revalidatePath("/attendance");
  redirect(`${back}?message=${encodeURIComponent("Special dates added.")}#special-dates`);
}

export async function deleteSpecialPeriod(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("special_periods").delete().eq("id", id);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "special.delete", details: { id } });
  revalidatePath("/calendar");
  revalidatePath("/attendance");
  redirect("/settings#special-dates");
}
