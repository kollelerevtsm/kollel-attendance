import { createClient } from "./supabase/server";

/** Is this night inside a pay period that's already been paid? */
export async function isPaidNight(night: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("pay_periods")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid")
    .lte("period_start", night)
    .gte("period_end", night);
  return (count ?? 0) > 0;
}
