import Link from "next/link";
import { requireRole, STAFF } from "@/lib/auth";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { recentPeriods } from "@/lib/engine";
import { PERIOD_LABEL, periodInfo, periodParam, periodTotals, type PeriodStatus } from "@/lib/payroll";
import { PageTitle } from "@/components/Notice";

const STYLE: Record<PeriodStatus, string> = {
  paid: "bg-green-100 text-green-800",
  ready: "bg-blue-100 text-blue-800",
  needs_approval: "bg-yellow-100 text-yellow-800",
  not_finished: "bg-gray-100 text-gray-700",
};

export default async function PayrollPage() {
  await requireRole(...STAFF);
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const periods = recentPeriods(today, settings.pay_period, 8);
  const rows = await Promise.all(
    periods.map(async (p) => {
      const info = await periodInfo(p.start, p.end);
      const totals = await periodTotals(p.start, p.end, info.status === "paid" ? info.paidRow?.id : undefined);
      return { ...p, info, total: totals.reduce((s, t) => s + t.amount, 0), students: totals.length };
    }),
  );

  return (
    <>
      <PageTitle title="Payroll" />
      <p className="mb-4 text-sm text-gray-600">
        Pay period: <strong>{settings.pay_period === "biweekly" ? "every two weeks" : settings.pay_period}</strong> (change in Settings).
        A period is ready to pay once it has ended and the principal has approved every week in it.
      </p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr><th className="px-4 py-2">Period</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Students</th><th className="px-4 py-2 text-right">Total</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.start} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link className="text-blue-700 hover:underline" href={`/payroll/${periodParam(r)}`}>
                    {formatDate(r.start, { month: "short", day: "numeric" })} – {formatDate(r.end, { month: "short", day: "numeric", year: "numeric" })}
                  </Link>
                </td>
                <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STYLE[r.info.status]}`}>{PERIOD_LABEL[r.info.status]}</span></td>
                <td className="px-4 py-2 text-right">{r.students}</td>
                <td className="px-4 py-2 text-right font-medium">${r.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
