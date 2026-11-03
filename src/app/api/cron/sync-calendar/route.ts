import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runScheduleSync } from "@/lib/scheduleSync";

// Called by Vercel Cron every morning (see vercel.json).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();
    const { data: settings } = await supabase.from("settings").select("timezone").eq("id", 1).single();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings?.timezone ?? "America/New_York" }).format(new Date());
    const days = await runScheduleSync(supabase, today);
    return NextResponse.json({ ok: true, days });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
