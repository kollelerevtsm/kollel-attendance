import { NextResponse, type NextRequest } from "next/server";
import { getProfile, STAFF } from "@/lib/auth";
import { parsePeriod, periodInfo, periodTotals } from "@/lib/payroll";

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: NextRequest, ctx: RouteContext<"/payroll/[period]/export">) {
  const me = await getProfile();
  if (!me || !STAFF.includes(me.role)) return new NextResponse("Not allowed", { status: 403 });
  const { period } = await ctx.params;
  const p = parsePeriod(period);
  if (!p) return new NextResponse("Bad period", { status: 400 });

  const info = await periodInfo(p.start, p.end);
  const totals = await periodTotals(p.start, p.end, info.status === "paid" ? info.paidRow?.id : undefined);
  const lines = [
    ["Student", "Nights at base rate", "Nights at test rate", "Amount", "Check number", "Check date"],
    ...totals.map((t) => [t.name, t.base_nights, t.test_nights, t.amount.toFixed(2), t.check_number, t.check_date]),
    ["Total", totals.reduce((s, t) => s + t.base_nights, 0), totals.reduce((s, t) => s + t.test_nights, 0), totals.reduce((s, t) => s + t.amount, 0).toFixed(2), "", ""],
  ];
  const body = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll_${p.start}_${p.end}.csv"`,
    },
  });
}
