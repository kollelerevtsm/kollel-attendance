import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings } from "@/lib/data";
import { weekStartOf } from "@/lib/engine";
import { addDays, localParts, minutesToLabel, type NightStatus } from "@/lib/rules";
import { Notice, PageTitle } from "@/components/Notice";
import { StatusChip } from "@/components/StatusChip";
import { addManualScan, clearFix, deleteManualScan, saveFix } from "../../actions";

export default async function NightPage({ params, searchParams }: PageProps<"/attendance/night/[date]">) {
  const me = await requireRole(...STAFF);
  const canEdit = MANAGERS.includes(me.role);
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const supabase = await createClient();

  const [{ data: rows }, { data: students }, { data: scans }] = await Promise.all([
    supabase.from("attendance_nights").select("*").eq("night", date),
    supabase.from("students").select("id,first_name,last_name,pin"),
    supabase.from("scans").select("id,user_pin,student_id,scanned_at,source,verify_method")
      .gte("scanned_at", `${date}T00:00:00Z`).lte("scanned_at", `${addDays(date, 2)}T00:00:00Z`).order("scanned_at"),
  ]);

  const nameOf = new Map((students ?? []).map((s) => [s.id, `${s.last_name}, ${s.first_name}`]));
  const idByPin = new Map((students ?? []).map((s) => [s.pin, s.id]));
  const time = (iso: string | null) => (iso ? minutesToLabel(localParts(new Date(iso), timezone).minutes) : "—");
  const hhmm = (iso: string | null) => {
    if (!iso) return "";
    const m = localParts(new Date(iso), timezone).minutes;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const nightScans = (scans ?? []).filter((s) => localParts(new Date(s.scanned_at), timezone).date === date);
  const sorted = [...(rows ?? [])].sort((a, b) => (nameOf.get(a.student_id) ?? "").localeCompare(nameOf.get(b.student_id) ?? ""));

  return (
    <>
      <PageTitle title={formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
        <Link className="btn-secondary" href={`/attendance?week=${weekStartOf(date)}`}>Back to week</Link>
      </PageTitle>
      <Notice
        error={typeof sp.error === "string" ? sp.error : undefined}
        message={typeof sp.message === "string" ? sp.message : undefined}
      />

      <div className="card mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">In</th>
              <th className="px-3 py-2">Out</th>
              <th className="px-3 py-2">Minutes</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reason</th>
              {canEdit && <th className="px-3 py-2">Fix by hand</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.student_id} className="border-b align-top last:border-0">
                <td className="px-3 py-2 whitespace-nowrap" dir="auto">{nameOf.get(r.student_id)}</td>
                <td className="px-3 py-2">{time(r.clock_in)}</td>
                <td className="px-3 py-2">{time(r.clock_out)}</td>
                <td className="px-3 py-2">{r.minutes ?? "—"}</td>
                <td className="px-3 py-2"><StatusChip status={r.status as NightStatus} amount={Number(r.amount)} /></td>
                <td className="px-3 py-2 text-gray-600">{r.reason}</td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <form action={saveFix} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="night" value={date} />
                      <input type="hidden" name="student_id" value={r.student_id} />
                      <input className="input w-28 py-1" type="time" name="clock_in" defaultValue={hhmm(r.manual_clock_in)} aria-label="Clock in" />
                      <input className="input w-28 py-1" type="time" name="clock_out" defaultValue={hhmm(r.manual_clock_out)} aria-label="Clock out" />
                      <input className="input w-40 py-1" name="note" defaultValue={r.manual_note ?? ""} placeholder="Reason" />
                      <button className="btn-secondary px-2 py-1 text-xs" type="submit">Save</button>
                    </form>
                    {r.manual_note && (
                      <form action={clearFix}>
                        <input type="hidden" name="night" value={date} />
                        <input type="hidden" name="student_id" value={r.student_id} />
                        <button className="mt-1 text-xs text-gray-500 underline" type="submit">Remove fix</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">No attendance for this night. It may not be a session night, or it hasn&apos;t happened yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-semibold">All scans this night</h2>
      <div className="card mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">PIN</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">How</th><th className="px-3 py-2">Source</th><th /></tr>
          </thead>
          <tbody>
            {nightScans.map((s) => {
              const sid = s.student_id ?? idByPin.get(s.user_pin);
              return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{time(s.scanned_at)}</td>
                  <td className="px-3 py-2 font-mono">{s.user_pin}</td>
                  <td className="px-3 py-2" dir="auto">{sid ? nameOf.get(sid) : <span className="text-red-700">Unknown PIN</span>}</td>
                  <td className="px-3 py-2">{s.verify_method ?? "—"}</td>
                  <td className="px-3 py-2">{s.source === "manual" ? "Entered by hand" : "Scanner"}</td>
                  <td className="px-3 py-2 text-right">
                    {canEdit && s.source === "manual" && (
                      <form action={deleteManualScan}>
                        <input type="hidden" name="night" value={date} />
                        <input type="hidden" name="scan_id" value={s.id} />
                        <button className="text-xs text-red-700 underline" type="submit">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {nightScans.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No scans.</td></tr>}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form action={addManualScan} className="card flex flex-wrap items-end gap-3">
          <input type="hidden" name="night" value={date} />
          <div>
            <label className="label" htmlFor="pin">PIN</label>
            <input className="input w-32" id="pin" name="pin" inputMode="numeric" required />
          </div>
          <div>
            <label className="label" htmlFor="time">Time</label>
            <input className="input w-32" id="time" name="time" type="time" required />
          </div>
          <button className="btn-secondary" type="submit">Add a scan by hand</button>
          <p className="w-full text-xs text-gray-500">Use this if the scanner was down, or to try out the system before the scanner is connected.</p>
        </form>
      )}
    </>
  );
}
