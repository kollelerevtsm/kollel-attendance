import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractScans } from "@/lib/crosschex";
import { ingestScans } from "@/lib/ingest";

// CrossChex Cloud calls this for every scan.
// Server URL in CrossChex: https://<your site>/api/webhooks/crosschex?key=<CROSSCHEX_WEBHOOK_KEY>
const ok = () => NextResponse.json({ code: "200", msg: "success" });

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  const expected = process.env.CROSSCHEX_WEBHOOK_KEY;
  const given = req.nextUrl.searchParams.get("key") ?? "";
  if (!expected || !sameSecret(given, expected)) {
    return NextResponse.json({ code: "401", msg: "unauthorized" }, { status: 401 });
  }

  const text = await req.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = Object.fromEntries(new URLSearchParams(text));
  }

  const supabase = createAdminClient();
  const scans = extractScans(body);
  if (scans.length === 0) {
    // Keep unrecognized messages so we can see what CrossChex sent.
    await supabase.from("audit_log").insert({ action: "crosschex.webhook_unrecognized", details: { body: text.slice(0, 4000) } });
    return ok();
  }
  try {
    const result = await ingestScans(scans, supabase);
    return NextResponse.json({ code: "200", msg: "success", ...result });
  } catch (e) {
    await supabase.from("audit_log").insert({ action: "crosschex.webhook_error", details: { error: (e as Error).message } });
    return NextResponse.json({ code: "500", msg: "error" }, { status: 500 });
  }
}

// Lets you open the address in a browser to check it's reachable.
export async function GET() {
  return NextResponse.json({ ok: true, message: "CrossChex webhook is ready. CrossChex sends scans here with POST." });
}
