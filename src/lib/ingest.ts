import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanRecord } from "./crosschex";
import { getSettings } from "./data";
import { recalculate } from "./attendance";
import { localParts } from "./rules";

/**
 * Save scans (skipping ones already saved), record test takers who entered their PIN on a test night,
 * and recalculate attendance for the nights affected.
 */
export async function ingestScans(scans: ScanRecord[], supabase: SupabaseClient, source: "webhook" | "api_sync" = "webhook"): Promise<{ saved: number; testTakers: number }> {
  if (scans.length === 0) return { saved: 0, testTakers: 0 };
  const settings = await getSettings(supabase);
  const { data: students } = await supabase.from("students").select("id,pin");
  const byPin = new Map((students ?? []).map((s) => [s.pin as string, s.id as string]));

  const rows = scans.map((s) => ({
    external_id: s.external_id,
    user_pin: s.user_pin,
    student_id: byPin.get(s.user_pin) ?? null,
    scanned_at: s.scanned_at,
    verify_method: s.verify_method,
    device_serial: s.device_serial,
    source,
    raw: s.raw,
  }));
  const { data: inserted, error } = await supabase
    .from("scans")
    .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true })
    .select("external_id");
  if (error) throw new Error(error.message);

  // Test night: a student who verified with their PIN took the test.
  const nights = scans.map((s) => localParts(new Date(s.scanned_at), settings.timezone).date);
  const { data: tests } = await supabase.from("calendar_days").select("day").eq("is_test_date", true).in("day", [...new Set(nights)]);
  const testDays = new Set((tests ?? []).map((t) => t.day as string));
  const takers = scans
    .map((s, i) => ({ s, night: nights[i] }))
    .filter(({ s, night }) => s.verify_method === "pin" && testDays.has(night) && byPin.has(s.user_pin))
    .map(({ s, night }) => ({ test_date: night, student_id: byPin.get(s.user_pin)!, source: "scanner" }));
  if (takers.length) await supabase.from("test_takers").upsert(takers, { onConflict: "test_date,student_id", ignoreDuplicates: true });

  const sorted = [...new Set(nights)].sort();
  await recalculate(sorted[0], sorted[sorted.length - 1], supabase);
  return { saved: inserted?.length ?? 0, testTakers: takers.length };
}
