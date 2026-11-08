import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { parsePeriod, periodInfo, periodParam, periodTotals } from "@/lib/payroll";
import { getCheckSettings } from "@/lib/checkSettings";
import { PrintButton } from "@/components/PrintButton";
import { CheckSheet, type Check } from "@/components/CheckSheet";
import { saveChecksAsPaid } from "./actions";
import "./checks.css";

export const metadata = { title: "Checks" };


export default async function ChecksPage({ params, searchParams }: PageProps<"/print/checks/[period]">) {
  await requireRole("admin", "payroll");
  const { period } = await params;
  const p = parsePeriod(period);
  if (!p) notFound();
  const sp = await searchParams;
  const settings = await getSettings();
  const cs = await getCheckSettings();
  const info = await periodInfo(p.start, p.end);
  const isPaid = info.status === "paid";
  const totals = await periodTotals(p.start, p.end, isPaid ? info.paidRow?.id : undefined);

  const firstNumber = Number(sp.start) > 0 ? Math.floor(Number(sp.start)) : cs.next_check_number;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIn(settings.timezone);
  const only = typeof sp.student === "string" ? sp.student : null;

  const checks: Check[] = totals
    .map((t, i) => ({
      number: isPaid ? (t.check_number ?? "") : firstNumber + i,
      date: isPaid ? (t.check_date ?? date) : date,
      payee: t.name, amount: t.amount, base_nights: t.base_nights, test_nights: t.test_nights, id: t.student_id,
    }))
    .filter((c) => !only || c.id === only);

  const periodLabel = `${formatDate(p.start, { month: "short", day: "numeric" })} – ${formatDate(p.end, { month: "short", day: "numeric", year: "numeric" })}`;
  const missingBank = cs.stock === "blank" && (!cs.routing_number || !cs.account_number);
  const lastNumber = typeof checks.at(-1)?.number === "number" ? checks.at(-1)!.number : null;

  return (
    <div className="checks-root min-h-screen py-4">
      <div className="no-print mx-auto mb-4 max-w-[8.5in] space-y-3 rounded-lg bg-white p-4 text-sm shadow">
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href={`/payroll/${periodParam(p)}`}>Back</Link>
          <PrintButton />
          <span className="text-gray-600">{checks.length} check{checks.length === 1 ? "" : "s"} · {periodLabel}</span>
        </div>
        {missingBank && (
          <p className="rounded bg-red-50 p-2 text-red-700">
            The bank details aren&apos;t set up yet. <Link className="underline" href="/payroll/check-setup">Check setup</Link>
          </p>
        )}
        <p className="text-gray-600">
          Print on letter-size check paper (check on top) at <strong>Actual size / 100%</strong>, not &ldquo;Fit to page&rdquo;.
          {cs.stock === "blank" && " For the bank numbers at the bottom, a printer with MICR toner is best; ask your bank whether regular toner is accepted."}
        </p>
        {!isPaid && !only && checks.length > 0 && (
          <form action={saveChecksAsPaid} className="flex flex-wrap items-end gap-3 border-t pt-3">
            <input type="hidden" name="period" value={periodParam(p)} />
            <label className="block">
              <span className="label">First check #</span>
              <input className="input w-28 py-1" type="number" min={1} name="start" defaultValue={firstNumber} />
            </label>
            <label className="block">
              <span className="label">Check date</span>
              <input className="input w-40 py-1" type="date" name="date" defaultValue={date} />
            </label>
            <button className="btn-secondary" type="submit" formAction={async (fd: FormData) => {
              "use server";
              const { redirect } = await import("next/navigation");
              redirect(`/print/checks/${String(fd.get("period"))}?start=${Number(fd.get("start"))}&date=${String(fd.get("date"))}`);
            }}>Update preview</button>
            {info.status === "ready" ? (
              <button className="btn" type="submit">Printed OK — mark as paid (#{firstNumber}{lastNumber && lastNumber !== firstNumber ? `–${lastNumber}` : ""})</button>
            ) : (
              <span className="text-xs text-gray-500">This period can be marked as paid once it has ended and every week is approved.</span>
            )}
          </form>
        )}
        {typeof sp.error === "string" && <p className="rounded bg-red-50 p-2 text-red-700">{sp.error}</p>}
      </div>

      {checks.map((c, i) => (
        <CheckSheet key={i} c={c} cs={cs} periodLabel={periodLabel} />
      ))}
    </div>
  );
}
