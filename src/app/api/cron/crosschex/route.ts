import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullFromCrossChex } from "@/lib/pull";

// Vercel Cron runs this every night (see vercel.json) as a backup to the webhook.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const supabase = createAdminClient();
  try {
    const result = await pullFromCrossChex(supabase, 3);
    await supabase.from("audit_log").insert({ action: "crosschex.nightly_pull", details: result });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await supabase.from("audit_log").insert({ action: "crosschex.nightly_pull_error", details: { error: (e as Error).message } });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
