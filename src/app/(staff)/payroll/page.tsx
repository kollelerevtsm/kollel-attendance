import Link from "next/link";
import { requireRole, STAFF } from "@/lib/auth";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { listPeriods, owedNow, PERIOD_LABEL, periodInfo, periodParam, periodTotals, type PeriodStatus } from "@/lib/payroll";
import { PageTitle } from "@/components/Notice";

const STYLE: Record<PeriodStatus, string> = {
  paid: "bg-green-100 text-green-800",
  ready: "bg-brand-100 text-brand-800",
  needs_approval: "bg-yellow-100 text-yellow-800",
  not_finished: "bg-gray-100 text-gray-700",
};

export default async function PayrollPage() {
  const me = await requireRole(...STAFF);
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const periods = await listPeriods(settings, today, 8);
  const owed = await owedNow(today);
  const PERIOD_NAME = { weekly: "weekly", biweekly: "every two weeks", monthly: "monthly", test: "from בחינה to בחינה" };
  const rows = await Promise.all(
    periods.map(async (p) => {
      const info = await periodInfo(p.start, p.end);
      const totals = await periodTotals(p.start, p.end, info.status === "paid" ? info.paidRow?.id : undefined);
      return { ...p, info, total: totals.reduce((s, t) => s + t.amount, 0), students: totals.length };
    }),
  );

  return (
    <>
      <PageTitle title="Payroll">
        {["admin", "payroll"].includes(me.role) && <Link className="btn-secondary" href="/payroll/check-setup">Check setup</Link>}
      </PageTitle>
      <p className="mb-4 text-sm text-gray-600">
        Pay period: <strong>{PERIOD_NAME[settings.pay_period]}</strong> (change in Settings).
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
                <td className="whitespace-nowrap px-4 py-2">
                  <Link className="text-brand-700 hover:underline" href={`/payroll/${periodParam(r)}`}>
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

      <h2 className="mb-2 mt-8 text-lg font-semibold">Owed now</h2>
      <p className="mb-3 text-sm text-gray-600">Every paid night up to today that hasn&apos;t been paid by check yet.</p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">Since</th><th className="px-4 py-2 text-right">Nights</th><th className="px-4 py-2 text-right">Owed</th></tr>
          </thead>
          <tbody>
            {owed.map((o) => (
              <tr key={o.student_id} className="border-b last:border-0">
                <td className="px-4 py-2" dir="auto">{o.name}</td>
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(o.since, { month: "short", day: "numeric" })}</td>
                <td className="px-4 py-2 text-right">{o.nights}</td>
                <td className="px-4 py-2 text-right font-medium">${o.amount.toFixed(2)}</td>
              </tr>
            ))}
            {owed.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Everyone is paid up.</td></tr>}
          </tbody>
          {owed.length > 0 && (
            <tfoot className="border-t bg-gray-50 font-semibold">
              <tr><td className="px-4 py-2" colSpan={2}>Total</td><td className="px-4 py-2 text-right">{owed.reduce((s, o) => s + o.nights, 0)}</td><td className="px-4 py-2 text-right">${owed.reduce((s, o) => s + o.amount, 0).toFixed(2)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
