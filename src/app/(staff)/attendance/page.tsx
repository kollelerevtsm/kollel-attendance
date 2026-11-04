import Link from "next/link";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { approvedWeeks, recalculate, sessionNights } from "@/lib/attendance";
import { parshaOfWeek } from "@/lib/hebrew";
import { weekStartOf } from "@/lib/engine";
import { addDays, type NightStatus } from "@/lib/rules";
import { Notice, PageTitle } from "@/components/Notice";
import { NEEDS_ATTENTION, StatusChip } from "@/components/StatusChip";
import { approveWeek, pullScansNow, unapproveWeek } from "./actions";

interface Row { student_id: string; night: string; status: NightStatus; amount: number; reason: string | null; manual_note: string | null }

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const me = await requireRole(...STAFF);
  const canEdit = MANAGERS.includes(me.role);
  const sp = await searchParams;
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const week = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStartOf(sp.week) : weekStartOf(today);
  const end = addDays(week, 6);

  const approved = (await approvedWeeks()).has(week);
  if (canEdit && !approved) await recalculate(week, end);

  const supabase = await createClient();
  const [nights, { data: students }, { data: rows }, { data: approval }] = await Promise.all([
    sessionNights(week, end),
    supabase.from("students").select("id,first_name,last_name,active").order("last_name").order("first_name"),
    supabase.from("attendance_nights").select("student_id,night,status,amount,reason,manual_note").gte("night", week).lte("night", end),
    supabase.from("week_approvals").select("approved_at").eq("week_start", week).maybeSingle(),
  ]);

  const byKey = new Map((rows as Row[] ?? []).map((r) => [`${r.student_id}|${r.night}`, r]));
  const shown = (students ?? []).filter((s) => s.active || (rows ?? []).some((r) => r.student_id === s.id));
  const flags = (rows as Row[] ?? []).filter((r) => NEEDS_ATTENTION.includes(r.status)).length;
  const total = (rows as Row[] ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const pastNights = nights.filter((n) => n <= today);

  return (
    <>
      <PageTitle title={`Week of ${formatDate(week, { month: "long", day: "numeric", year: "numeric" })}`}>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/attendance?week=${addDays(week, -7)}`}>← Previous</Link>
          <Link className="btn-secondary" href="/attendance">This week</Link>
          <Link className="btn-secondary" href={`/attendance?week=${addDays(week, 7)}`}>Next →</Link>
        </div>
      </PageTitle>
      <p className="-mt-4 mb-4 text-lg text-gray-700" dir="rtl">{parshaOfWeek(week)}</p>
      <Notice error={typeof sp.error === "string" ? sp.error : undefined} message={typeof sp.message === "string" ? sp.message : undefined} />

      <div className="card mb-4 flex flex-wrap items-center gap-4">
        {approved ? (
          <span className="rounded bg-green-100 px-2 py-1 text-sm text-green-800">
            Approved {approval ? new Date(approval.approved_at).toLocaleDateString("en-US") : ""}
          </span>
        ) : (
          <span className="rounded bg-yellow-100 px-2 py-1 text-sm text-yellow-800">Needs approval</span>
        )}
        <span className="text-sm text-gray-600">{flags} to fix · ${total.toFixed(2)} this week</span>
        {canEdit && (
          <form action={pullScansNow}>
            <input type="hidden" name="week" value={week} />
            <button className="btn-secondary" type="submit" title="Scans arrive automatically; use this if some seem missing">Check scanner for missing scans</button>
          </form>
        )}
        {canEdit && (
          <form action={approved ? unapproveWeek : approveWeek} className="ml-auto">
            <input type="hidden" name="week" value={week} />
            {approved ? (
              <button className="btn-secondary" type="submit">Undo approval</button>
            ) : (
              <button className="btn" type="submit" disabled={pastNights.length === 0}>
                Approve week{flags > 0 ? ` (${flags} not fixed)` : ""}
              </button>
            )}
          </form>
        )}
      </div>

      {nights.length === 0 ? (
        <div className="card text-gray-500">No session nights this week.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Student</th>
                {nights.map((n) => (
                  <th key={n} className="px-3 py-2 whitespace-nowrap">
                    <Link className="text-brand-700 hover:underline" href={`/attendance/night/${n}`}>{formatDate(n)}</Link>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const sum = nights.reduce((acc, n) => acc + Number(byKey.get(`${s.id}|${n}`)?.amount ?? 0), 0);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap" dir="auto">{s.last_name}, {s.first_name}</td>
                    {nights.map((n) => {
                      const r = byKey.get(`${s.id}|${n}`);
                      return (
                        <td key={n} className="px-3 py-2" title={r?.reason ?? ""}>
                          {r ? (
                            <Link href={`/attendance/night/${n}`}>
                              <StatusChip status={r.status} amount={Number(r.amount)} />
                              {r.manual_note && <span className="ml-1 text-xs text-brand-700">✎</span>}
                            </Link>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-medium">${sum.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-gray-500">Hover over a night to see the reason. ✎ = fixed by hand. Click a date to see scans and make fixes.</p>
    </>
  );
}
