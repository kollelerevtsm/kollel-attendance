import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRecords } from "./crosschex";
import { ingestScans } from "./ingest";

/** Backup: fetch the last `days` days of records from the CrossChex API and save any we missed. */
export async function pullFromCrossChex(supabase: SupabaseClient, days = 3) {
  const end = new Date();
  const begin = new Date(end.getTime() - days * 86400_000);
  const records = await fetchRecords(begin, end);
  const result = await ingestScans(records, supabase, "api_sync");
  return { fetched: records.length, ...result };
}
