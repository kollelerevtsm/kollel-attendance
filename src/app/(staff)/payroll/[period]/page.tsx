import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, STAFF, type Role } from "@/lib/auth";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { PERIOD_LABEL, parsePeriod, periodInfo, periodParam, periodTotals } from "@/lib/payroll";
import { Notice, PageTitle } from "@/components/Notice";
import { PrintButton } from "@/components/PrintButton";
import { markPaid, reopenPeriod } from "../actions";

const PAYERS: Role[] = ["admin", "payroll"];

export default async function PeriodPage({ params, searchParams }: PageProps<"/payroll/[period]">) {
  const me = await requireRole(...STAFF);
  const { period } = await params;
  const p = parsePeriod(period);
  if (!p) notFound();
  const sp = await searchParams;
  const settings = await getSettings();
  const info = await periodInfo(p.start, p.end);
  const isPaid = info.status === "paid";
  const totals = await periodTotals(p.start, p.end, isPaid ? info.paidRow?.id : undefined);
  const grand = totals.reduce((s, t) => s + t.amount, 0);
  const canPay = PAYERS.includes(me.role) && info.status === "ready";
  const today = todayIn(settings.timezone);
  const title = `${formatDate(p.start, { month: "short", day: "numeric" })} – ${formatDate(p.end, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <>
      <PageTitle title={`Payroll: ${title}`}>
        <div className="flex gap-2 print:hidden">
          <Link className="btn-secondary" href="/payroll">Back</Link>
          <a className="btn-secondary" href={`/payroll/${periodParam(p)}/export`}>Excel (CSV)</a>
          {PAYERS.includes(me.role) && totals.length > 0 && (
            <Link className="btn" href={`/print/checks/${periodParam(p)}`}>{isPaid ? "Reprint checks" : "Print checks"}</Link>
          )}
          <PrintButton />
        </div>
      </PageTitle>
      <div className="print:hidden">
        <Notice
          error={typeof sp.error === "string" ? sp.error : undefined}
          message={typeof sp.message === "string" ? sp.message : undefined}
        />
      </div>
      <p className="mb-4 text-sm">
        Status: <strong>{PERIOD_LABEL[info.status]}</strong>
        {isPaid && info.paidRow?.paid_at && ` on ${new Date(info.paidRow.paid_at).toLocaleDateString("en-US")}`}
        {info.status === "needs_approval" && (
          <span className="text-gray-600 print:hidden">
            {" "}· Weeks not approved yet:{" "}
            {info.unapprovedWeeks.map((w, i) => (
              <span key={w}>{i > 0 && ", "}<Link className="text-brand-700 underline" href={`/attendance?week=${w}`}>{formatDate(w, { month: "short", day: "numeric" })}</Link></span>
            ))}
          </span>
        )}
      </p>

      <form action={markPaid}>
        <input type="hidden" name="period" value={periodParam(p)} />
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2 text-right">Nights at ${settings.base_rate}</th>
                <th className="px-4 py-2 text-right">Nights at ${settings.test_rate}</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Check #</th>
                <th className="px-4 py-2">Check date</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => (
                <tr key={t.student_id} className="border-b last:border-0">
                  <td className="px-4 py-2" dir="auto">{t.name}</td>
                  <td className="px-4 py-2 text-right">{t.base_nights}</td>
                  <td className="px-4 py-2 text-right">{t.test_nights}</td>
                  <td className="px-4 py-2 text-right font-medium">${t.amount.toFixed(2)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {canPay ? <input className="input w-28 py-1" name={`check_${t.student_id}`} required /> : t.check_number ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Paid</span> #{t.check_number}
                        {PAYERS.includes(me.role) && <Link className="text-xs text-brand-700 underline print:hidden" href={`/print/checks/${periodParam(p)}?student=${t.student_id}`}>reprint</Link>}
                      </span>
                    ) : ""}
                  </td>
                  <td className="px-4 py-2">
                    {canPay ? <input className="input w-36 py-1" type="date" name={`date_${t.student_id}`} defaultValue={today} /> : t.check_date ? formatDate(t.check_date) : ""}
                  </td>
                </tr>
              ))}
              {totals.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No paid nights in this period.</td></tr>}
            </tbody>
            <tfoot className="border-t bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-2">Total ({totals.length} students)</td>
                <td className="px-4 py-2 text-right">{totals.reduce((s, t) => s + t.base_nights, 0)}</td>
                <td className="px-4 py-2 text-right">{totals.reduce((s, t) => s + t.test_nights, 0)}</td>
                <td className="px-4 py-2 text-right">${grand.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        {canPay && totals.length > 0 && (
          <div className="mt-4 print:hidden">
            <button className="btn-secondary" type="submit">Mark period as paid (hand-written checks)</button>
            <p className="mt-1 text-xs text-gray-500">
              Printing checks? Use <strong>Print checks</strong> above instead: the numbers are filled in for you.
              After a period is marked as paid it is locked. Only the admin can reopen it.
            </p>
          </div>
        )}
      </form>

      {isPaid && me.role === "admin" && (
        <form action={reopenPeriod} className="mt-6 print:hidden">
          <input type="hidden" name="period" value={periodParam(p)} />
          <button className="btn-danger" type="submit">Reopen this period</button>
        </form>
      )}
    </>
  );
}
