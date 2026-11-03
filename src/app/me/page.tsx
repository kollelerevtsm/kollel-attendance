import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { nightsInfo, parshaOfWeek } from "@/lib/hebrew";
import { addDays, localParts, minutesToLabel, testRateApplies, type NightStatus } from "@/lib/rules";
import { StatusChip } from "@/components/StatusChip";
import { loadCalendar } from "@/lib/calendarData";
import { signOut } from "../login/actions";

export default async function StudentHome() {
  const me = await requireRole("student");
  const supabase = await createClient();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const until = addDays(today, 13);

  const [{ data: student }, { data: days }, { data: tests }, { data: took }, { data: nightsDone }, { data: payments }] = await Promise.all([
    supabase.from("students").select("first_name,last_name,pin").eq("id", me.student_id!).single(),
    supabase.from("calendar_days").select("*").gte("day", today).lte("day", until),
    supabase.from("calendar_days").select("day").eq("is_test_date", true).order("day"),
    supabase.from("test_takers").select("test_date").eq("student_id", me.student_id!),
    supabase.from("attendance_nights").select("night,clock_in,clock_out,status,amount,reason")
      .eq("student_id", me.student_id!).gte("night", addDays(today, -45)).order("night", { ascending: false }),
    supabase.from("payments").select("amount,check_number,check_date,base_nights,test_nights,pay_periods(period_start,period_end)")
      .eq("student_id", me.student_id!),
  ]);
  const t = (iso: string | null) => (iso ? minutesToLabel(localParts(new Date(iso), settings.timezone).minutes) : "—");
  const unpaidTotal = (nightsDone ?? []).reduce((s, n) => s + Number(n.amount), 0);

  const overrides = new Map((days ?? []).map((d) => [d.day as string, d]));
  const cal = await loadCalendar(today, until);
  const info = nightsInfo(today, until, settings.off_holidays);
  const testDates = (tests ?? []).map((t) => t.day as string);
  const testRate = testRateApplies(today, testDates, new Set((took ?? []).map((t) => t.test_date as string)));
  const nextTest = testDates.find((d) => d >= today);

  const upcoming: string[] = [];
  for (let d = today; d <= until; d = addDays(d, 1)) {
    if (cal.isOn(d)) upcoming.push(d);
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500" dir="rtl">כולל ערב תורתך שעשועי</p>
          <h1 className="text-2xl font-semibold" dir="auto">{student?.first_name} {student?.last_name}</h1>
        </div>
        <form action={signOut}><button className="btn-secondary" type="submit">Sign out</button></form>
      </div>

      <div className="card grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Your rate</p>
          <p className="text-2xl font-semibold">${testRate ? settings.test_rate : settings.base_rate}<span className="text-sm font-normal text-gray-500"> / night</span></p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Next test</p>
          <p className="font-medium">{nextTest ? formatDate(nextTest) : "Not set yet"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Your PIN</p>
          <p className="font-mono">{student?.pin}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 flex justify-between font-semibold">Upcoming nights <span className="font-normal text-gray-600" dir="rtl">{parshaOfWeek(today)}</span></h2>
        <ul className="divide-y text-sm">
          {upcoming.map((d) => (
            <li key={d} className="flex justify-between gap-3 py-2">
              <span>
                {formatDate(d)} <span className="text-gray-500" dir="rtl">· {info.get(d)!.hebrewDate}</span>
                {overrides.get(d)?.is_test_date && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Test</span>}
              </span>
              <span className="text-right text-gray-700" dir="auto">{cal.topic(d) ?? ""}</span>
            </li>
          ))}
          {upcoming.length === 0 && <li className="py-2 text-gray-500">No sessions in the next two weeks.</li>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">My attendance (last 45 days)</h2>
        <ul className="divide-y text-sm">
          {(nightsDone ?? []).map((n) => (
            <li key={n.night} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="w-28">{formatDate(n.night)}</span>
              <span className="text-gray-600">{t(n.clock_in)} – {t(n.clock_out)}</span>
              <StatusChip status={n.status as NightStatus} amount={Number(n.amount)} />
              {n.status !== "paid" && <span className="w-full text-xs text-gray-500">{n.reason}</span>}
            </li>
          ))}
          {(nightsDone ?? []).length === 0 && <li className="py-2 text-gray-500">No nights recorded yet.</li>}
        </ul>
        {(nightsDone ?? []).length > 0 && <p className="mt-2 text-right text-sm text-gray-600">Earned in the last 45 days: ${unpaidTotal.toFixed(2)}</p>}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">My payments</h2>
        <ul className="divide-y text-sm">
          {(payments ?? []).map((p, i) => {
            const period = (Array.isArray(p.pay_periods) ? p.pay_periods[0] : p.pay_periods) as { period_start: string; period_end: string } | null;
            return (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{period ? `${formatDate(period.period_start)} – ${formatDate(period.period_end)}` : ""}</span>
                <span className="font-medium">${Number(p.amount).toFixed(2)}</span>
                <span className="text-gray-600">Check #{p.check_number}{p.check_date ? `, ${formatDate(p.check_date)}` : ""}</span>
              </li>
            );
          })}
          {(payments ?? []).length === 0 && <li className="py-2 text-gray-500">No payments yet.</li>}
        </ul>
      </div>
      <p className="text-center text-xs text-gray-500">If something looks wrong, please speak to the principal.</p>
    </main>
  );
}
