import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { nightsInfo } from "@/lib/hebrew";
import { addDays, isSessionNight, testRateApplies } from "@/lib/rules";
import { signOut } from "../login/actions";

export default async function StudentHome() {
  const me = await requireRole("student");
  const supabase = await createClient();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const until = addDays(today, 13);

  const [{ data: student }, { data: days }, { data: tests }, { data: took }] = await Promise.all([
    supabase.from("students").select("first_name,last_name,pin").eq("id", me.student_id!).single(),
    supabase.from("calendar_days").select("*").gte("day", today).lte("day", until),
    supabase.from("calendar_days").select("day").eq("is_test_date", true).order("day"),
    supabase.from("test_takers").select("test_date").eq("student_id", me.student_id!),
  ]);

  const overrides = new Map((days ?? []).map((d) => [d.day as string, d]));
  const info = nightsInfo(today, until);
  const testDates = (tests ?? []).map((t) => t.day as string);
  const testRate = testRateApplies(today, testDates, new Set((took ?? []).map((t) => t.test_date as string)));
  const nextTest = testDates.find((d) => d >= today);

  const upcoming: string[] = [];
  for (let d = today; d <= until; d = addDays(d, 1)) {
    if (isSessionNight(d, settings.session_weekdays, overrides.get(d)?.is_session, info.get(d)!.suggestedOff)) upcoming.push(d);
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
        <h2 className="mb-3 font-semibold">Upcoming nights</h2>
        <ul className="divide-y text-sm">
          {upcoming.map((d) => (
            <li key={d} className="flex justify-between gap-3 py-2">
              <span>
                {formatDate(d)} <span className="text-gray-500" dir="rtl">· {info.get(d)!.hebrewDate}</span>
                {overrides.get(d)?.is_test_date && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Test</span>}
              </span>
              <span className="text-right text-gray-700" dir="auto">{overrides.get(d)?.learning_topic ?? ""}</span>
            </li>
          ))}
          {upcoming.length === 0 && <li className="py-2 text-gray-500">No sessions in the next two weeks.</li>}
        </ul>
      </div>

      <p className="text-center text-sm text-gray-500">Your attendance and pay will show here once the scanner is connected.</p>
    </main>
  );
}
