import { createClient } from "./supabase/server";
import type { Settings } from "./rules";

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Could not load settings: " + error?.message);
  return {
    ...data,
    base_rate: Number(data.base_rate),
    test_rate: Number(data.test_rate),
  } as Settings;
}

export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
