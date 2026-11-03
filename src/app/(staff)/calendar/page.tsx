import Link from "next/link";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { nightsInfo, parshaOfWeek } from "@/lib/hebrew";
import { addDays, isSessionNight, weekday } from "@/lib/rules";
import { Fragment } from "react";
import { PageTitle } from "@/components/Notice";
import { updateDay } from "./actions";

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return { start, end, prev, next };
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const me = await requireRole(...STAFF);
  const canEdit = MANAGERS.includes(me.role);
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const sp = await searchParams;
  const ym = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { start, end, prev, next } = monthBounds(ym);

  const supabase = await createClient();
  const { data } = await supabase.from("calendar_days").select("*").gte("day", start).lte("day", end);
  const overrides = new Map((data ?? []).map((d) => [d.day as string, d]));
  const info = nightsInfo(start, end);

  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const sessionCount = days.filter((d) =>
    isSessionNight(d, settings.session_weekdays, overrides.get(d)?.is_session, info.get(d)!.suggestedOff),
  ).length;

  return (
    <>
      <PageTitle title={formatDate(start, { month: "long", year: "numeric" })}>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href={`/calendar?month=${prev}`}>← Previous</Link>
          <Link className="btn-secondary" href="/calendar">This month</Link>
          <Link className="btn-secondary" href={`/calendar?month=${next}`}>Next →</Link>
        </div>
      </PageTitle>
      <p className="mb-4 text-sm text-gray-600">
        {sessionCount} session nights this month. Hebrew dates are for the night (the evening starts the next Hebrew day).
        Nights before Yom Tov are turned off automatically; you can turn any night on or off.
      </p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Night</th>
              <th className="px-3 py-2">Hebrew date</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Learning session</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const o = overrides.get(d);
              const n = info.get(d)!;
              const on = isSessionNight(d, settings.session_weekdays, o?.is_session, n.suggestedOff);
              const overridden = o?.is_session === true || o?.is_session === false;
              return (
                <Fragment key={d}>
                {(d === start || weekday(d) === 0) && (
                  <tr className="border-b bg-gray-100">
                    <td colSpan={5} className="px-3 py-1.5 text-right font-semibold text-gray-700" dir="rtl">{parshaOfWeek(d)}</td>
                  </tr>
                )}
                <tr className={`border-b last:border-0 align-top ${d === today ? "bg-blue-50" : on ? "" : "bg-gray-50 text-gray-500"}`}>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{formatDate(d)}</td>
                  <td className="px-3 py-2">
                    <div dir="rtl" className="text-right md:text-left">{n.hebrewDate}</div>
                    {n.holidays.length > 0 && <div className="text-xs text-purple-700">{n.holidays.join(" · ")}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={on ? "text-green-700" : "text-gray-500"}>{on ? "On" : "Off"}</span>
                    {overridden && <span className="ml-1 text-xs text-gray-400">(set by principal)</span>}
                    {canEdit && (
                      <form action={updateDay} className="mt-1 flex gap-1">
                        <input type="hidden" name="day" value={d} />
                        <button className="text-xs text-blue-700 underline" name="op" value={on ? "session_off" : "session_on"}>
                          Turn {on ? "off" : "on"}
                        </button>
                        {overridden && (
                          <button className="text-xs text-gray-500 underline" name="op" value="session_default">Reset</button>
                        )}
                      </form>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {o?.is_test_date && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Test date</span>}
                    {canEdit && (
                      <form action={updateDay}>
                        <input type="hidden" name="day" value={d} />
                        <button className="text-xs text-blue-700 underline" name="op" value={o?.is_test_date ? "test_off" : "test_on"}>
                          {o?.is_test_date ? "Remove test" : "Mark test"}
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-3 py-2 min-w-56">
                    {canEdit ? (
                      <form action={updateDay} className="flex gap-1">
                        <input type="hidden" name="day" value={d} />
                        <input type="hidden" name="op" value="topic" />
                        <input className="input py-1" name="learning_topic" defaultValue={o?.learning_topic ?? ""} dir="auto" placeholder="e.g. Bava Metzia 21a" />
                        <button className="btn-secondary px-2 py-1 text-xs" type="submit">Save</button>
                      </form>
                    ) : (
                      <span dir="auto">{o?.learning_topic ?? ""}</span>
                    )}
                  </td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
