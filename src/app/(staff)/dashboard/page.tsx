import Link from "next/link";
import { requireRole, STAFF } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { nightsInfo, parshaOfWeek } from "@/lib/hebrew";
import { isSessionNight, minutesToLabel, timeToMinutes } from "@/lib/rules";
import { PageTitle } from "@/components/Notice";
import { sessionOverride, topicOf } from "@/lib/calendarDay";

export default async function Dashboard() {
  await requireRole(...STAFF);
  const supabase = await createClient();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const info = nightsInfo(today, today).get(today)!;

  const [{ data: day }, { count: activeCount }, { count: noPrint }, { data: nextTest }] = await Promise.all([
    supabase.from("calendar_days").select("*").eq("day", today).maybeSingle(),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true).eq("fingerprint_enrolled", false),
    supabase.from("calendar_days").select("day").eq("is_test_date", true).gte("day", today).order("day").limit(1).maybeSingle(),
  ]);

  const session = isSessionNight(today, settings.session_weekdays, sessionOverride(day ?? undefined), info.suggestedOff);

  return (
    <>
      <PageTitle title="Dashboard" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <p className="text-sm text-gray-500">Tonight</p>
          <p className="text-xl font-semibold">
            {formatDate(today, { weekday: "long", month: "long", day: "numeric" })}{" "}
            <span className="text-gray-500" dir="rtl">· {info.hebrewDate}</span>
          </p>
          <p className="mt-2">
            {session ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-800">
                Session {minutesToLabel(timeToMinutes(settings.session_start))}–{minutesToLabel(timeToMinutes(settings.session_end))}
              </span>
            ) : (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-700">No session tonight</span>
            )}
            {day?.is_test_date && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-800">Test night</span>}
          </p>
          <p className="mt-1 text-gray-700" dir="rtl">{parshaOfWeek(today)}</p>
          {info.holidays.length > 0 && <p className="mt-2 text-sm text-gray-600">{info.holidays.join(" · ")}</p>}
          <p className="mt-3 text-sm">
            <span className="text-gray-500">Learning tonight: </span>
            {topicOf(day ?? undefined) || <span className="text-gray-400">not set</span>}
          </p>
        </div>
        <div className="card space-y-3">
          <div>
            <p className="text-sm text-gray-500">Active students</p>
            <p className="text-2xl font-semibold">{activeCount ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Fingerprint not enrolled</p>
            <p className="text-2xl font-semibold">{noPrint ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Next test</p>
            <p className="font-medium">{nextTest ? formatDate(nextTest.day) : <Link className="text-blue-700 underline" href="/calendar">Set on calendar</Link>}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="btn" href="/attendance">This week&apos;s attendance</Link>
        {session && <Link className="btn-secondary" href={`/attendance/night/${today}`}>Tonight&apos;s scans</Link>}
        <Link className="btn-secondary" href="/payroll">Payroll</Link>
      </div>
    </>
  );
}
