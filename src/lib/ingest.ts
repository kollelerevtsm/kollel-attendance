import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanRecord } from "./crosschex";
import { getSettings } from "./data";
import { recalculate } from "./attendance";
import { addDays, localParts, testOpenOn } from "./rules";

/**
 * Save scans (skipping ones already saved), record test takers who entered their PIN on a test night,
 * and recalculate attendance for the nights affected.
 */
export async function ingestScans(scans: ScanRecord[], supabase: SupabaseClient, source: "webhook" | "api_sync" = "webhook"): Promise<{ saved: number; testTakers: number }> {
  if (scans.length === 0) return { saved: 0, testTakers: 0 };
  const settings = await getSettings(supabase);
  const { data: students } = await supabase.from("students").select("id,pin,test_pin");
  const byPin = new Map<string, string>();
  const testPins = new Set<string>();
  for (const s of students ?? []) {
    byPin.set(s.pin as string, s.id as string);
    if (s.test_pin) {
      byPin.set(s.test_pin as string, s.id as string);
      testPins.add(s.test_pin as string);
    }
  }
  // Scans with a student's test ID are marked as such.
  for (const s of scans) if (testPins.has(s.user_pin)) s.verify_method = "test ID";

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

  // A student who verifies with their PIN on a test night — or within the claim window after it — took the test.
  const nights = scans.map((s) => localParts(new Date(s.scanned_at), settings.timezone).date);
  const sortedNights = [...new Set(nights)].sort();
  const claimDays = settings.test_claim_days ?? 0;
  const { data: tests } = await supabase
    .from("calendar_days").select("day").eq("is_test_date", true)
    .gte("day", addDays(sortedNights[0], -claimDays)).lte("day", sortedNights[sortedNights.length - 1]);
  const testDates = (tests ?? []).map((t) => t.day as string);
  const takers = scans
    .map((s, i) => ({ s, test: testOpenOn(nights[i], testDates, claimDays) }))
    .filter(({ s, test }) => (s.verify_method === "test ID" || s.verify_method === "pin") && test && byPin.has(s.user_pin))
    .map(({ s, test }) => ({ test_date: test!, student_id: byPin.get(s.user_pin)!, source: "scanner" }));
  if (takers.length) await supabase.from("test_takers").upsert(takers, { onConflict: "test_date,student_id", ignoreDuplicates: true });

  // A late claim changes the rate from the test night on, so recalculate from the earliest test claimed.
  const from = [sortedNights[0], ...takers.map((t) => t.test_date)].sort()[0];
  await recalculate(from, sortedNights[sortedNights.length - 1], supabase);
  return { saved: inserted?.length ?? 0, testTakers: takers.length };
}
