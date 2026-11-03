import Link from "next/link";
import { Fragment } from "react";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { nightsInfo, parshaOfWeek, type NightInfo } from "@/lib/hebrew";
import { addDays, isSessionNight, weekday } from "@/lib/rules";
import { PageTitle } from "@/components/Notice";
import { updateDay } from "./actions";

interface DayRow {
  day: string;
  is_session: boolean | null;
  learning_topic: string | null;
  is_test_date: boolean;
}

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return { start, end, prev, next };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const me = await requireRole(...STAFF);
  const canEdit = MANAGERS.includes(me.role);
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "month";
  const ym = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { start, end, prev, next } = monthBounds(ym);
  const selected = typeof sp.day === "string" && sp.day >= start && sp.day <= end ? sp.day : null;
  const href = (q: Record<string, string>) => "/calendar?" + new URLSearchParams({ view, month: ym, ...q }).toString();

  const supabase = await createClient();
  const [{ data }, { data: tests }] = await Promise.all([
    supabase.from("calendar_days").select("*").gte("day", start).lte("day", end),
    supabase.from("calendar_days").select("day").eq("is_test_date", true).order("day"),
  ]);
  const overrides = new Map(((data ?? []) as DayRow[]).map((d) => [d.day, d]));
  const info = nightsInfo(start, end);
  const testDates = (tests ?? []).map((t) => t.day as string);
  const shownTests = [...testDates.filter((d) => d < today).slice(-3), ...testDates.filter((d) => d >= today)];

  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const isOn = (d: string) => isSessionNight(d, settings.session_weekdays, overrides.get(d)?.is_session, info.get(d)!.suggestedOff);
  const sessionCount = days.filter(isOn).length;

  return (
    <>
      <PageTitle title={formatDate(start, { month: "long", year: "numeric" })}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
            <Link className={`px-3 py-2 text-sm ${view === "month" ? "bg-blue-700 text-white" : "bg-white"}`} href={`/calendar?view=month&month=${ym}`}>Calendar</Link>
            <Link className={`px-3 py-2 text-sm ${view === "list" ? "bg-blue-700 text-white" : "bg-white"}`} href={`/calendar?view=list&month=${ym}`}>List</Link>
          </div>
          <Link className="btn-secondary" href={href({ month: prev })}>←</Link>
          <Link className="btn-secondary" href={href({ month: today.slice(0, 7) })}>Today</Link>
          <Link className="btn-secondary" href={href({ month: next })}>→</Link>
        </div>
      </PageTitle>

      {/* Test dates */}
      <section className="card mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">Test dates</h2>
        {shownTests.length === 0 && <span className="text-sm text-gray-500">None set yet.</span>}
        {shownTests.map((d) => (
          <span key={d} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${d >= today ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-600"}`}>
            {formatDate(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            {canEdit && (
              <form action={updateDay} className="inline">
                <input type="hidden" name="day" value={d} />
                <button className="ml-1 text-gray-500 hover:text-red-700" name="op" value="test_off" title="Remove test date" aria-label="Remove test date">×</button>
              </form>
            )}
          </span>
        ))}
        {canEdit && (
          <form action={updateDay} className="ml-auto flex items-center gap-2">
            <input type="hidden" name="op" value="test_on" />
            <input className="input w-40 py-1" type="date" name="day" required min={today} />
            <button className="btn-secondary px-3 py-1" type="submit">Add test date</button>
          </form>
        )}
      </section>

      <p className="mb-4 text-sm text-gray-600">
        {sessionCount} session nights this month. Hebrew dates are for the night. Nights before Yom Tov are off automatically;
        {canEdit ? " click a night to turn it on or off or set the learning session." : ""}
      </p>

      {view === "month" ? (
        <>
          <MonthGrid days={days} start={start} today={today} selected={selected} isOn={isOn} overrides={overrides} info={info} dayHref={(d) => href({ day: d })} />
          {selected && (
            <DayEditor
              day={selected}
              on={isOn(selected)}
              row={overrides.get(selected)}
              info={info.get(selected)!}
              canEdit={canEdit}
              closeHref={href({})}
            />
          )}
        </>
      ) : (
        <ListView days={days} start={start} today={today} isOn={isOn} overrides={overrides} info={info} canEdit={canEdit} />
      )}
    </>
  );
}

function MonthGrid({ days, start, today, selected, isOn, overrides, info, dayHref }: {
  days: string[]; start: string; today: string; selected: string | null;
  isOn: (d: string) => boolean; overrides: Map<string, DayRow>; info: Map<string, NightInfo>; dayHref: (d: string) => string;
}) {
  const lead = weekday(start);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="card overflow-x-auto p-0">
      <div className="grid min-w-[720px] grid-cols-7 border-b bg-gray-50 text-center text-xs font-medium text-gray-600">
        {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
      </div>
      {weeks.map((week, wi) => {
        const firstDay = week.find((d) => d) as string;
        return (
          <div key={wi} className="min-w-[720px]">
            <div className="border-b bg-gray-100 px-3 py-1 text-right text-sm font-semibold text-gray-700" dir="rtl">{parshaOfWeek(firstDay)}</div>
            <div className="grid grid-cols-7 border-b last:border-0">
              {week.map((d, i) => {
                if (!d) return <div key={i} className="min-h-24 border-r bg-gray-50 last:border-r-0" />;
                const o = overrides.get(d);
                const n = info.get(d)!;
                const on = isOn(d);
                return (
                  <Link
                    key={d}
                    href={dayHref(d)}
                    scroll={false}
                    className={`min-h-24 border-r p-1.5 text-xs last:border-r-0 hover:bg-blue-50 ${on ? "bg-white" : "bg-gray-50 text-gray-400"} ${d === selected ? "ring-2 ring-inset ring-blue-600" : ""}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm font-semibold ${d === today ? "rounded-full bg-blue-700 px-1.5 text-white" : ""}`}>{Number(d.slice(8))}</span>
                      <span dir="rtl">{n.hebrewDate.split(" ").slice(0, 2).join(" ")}</span>
                    </div>
                    {n.holidays.length > 0 && <div className="mt-0.5 truncate text-purple-700">{n.holidays.join(" · ")}</div>}
                    {o?.is_test_date && <div className="mt-0.5 rounded bg-amber-100 px-1 text-amber-800">Test</div>}
                    {on && o?.learning_topic && <div className="mt-0.5 truncate text-gray-700" dir="auto">{o.learning_topic}</div>}
                    {!on && <div className="mt-0.5">No session</div>}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayEditor({ day, on, row, info, canEdit, closeHref }: {
  day: string; on: boolean; row?: DayRow; info: NightInfo; canEdit: boolean; closeHref: string;
}) {
  const overridden = row?.is_session === true || row?.is_session === false;
  return (
    <section className="card mt-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {formatDate(day, { weekday: "long", month: "long", day: "numeric" })} <span className="font-normal text-gray-600" dir="rtl">· {info.hebrewDate}</span>
        </h2>
        <Link className="text-sm text-gray-500 underline" href={closeHref} scroll={false}>Close</Link>
      </div>
      {info.holidays.length > 0 && <p className="text-sm text-purple-700">{info.holidays.join(" · ")}</p>}
      {row?.is_test_date && <p className="text-sm text-amber-800">Test night</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-1 text-sm ${on ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
          {on ? "Session on" : "No session"}{overridden ? " (set by principal)" : ""}
        </span>
        {canEdit && (
          <form action={updateDay} className="flex gap-2">
            <input type="hidden" name="day" value={day} />
            <button className="btn-secondary px-3 py-1" name="op" value={on ? "session_off" : "session_on"}>Turn {on ? "off" : "on"}</button>
            {overridden && <button className="btn-secondary px-3 py-1" name="op" value="session_default">Reset to default</button>}
          </form>
        )}
      </div>
      {canEdit ? (
        <form action={updateDay} className="flex max-w-xl gap-2">
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="op" value="topic" />
          <input className="input" name="learning_topic" defaultValue={row?.learning_topic ?? ""} dir="auto" placeholder="Learning session, e.g. Bava Metzia 21a" />
          <button className="btn" type="submit">Save</button>
        </form>
      ) : (
        row?.learning_topic && <p dir="auto">Learning: {row.learning_topic}</p>
      )}
    </section>
  );
}

function ListView({ days, start, today, isOn, overrides, info, canEdit }: {
  days: string[]; start: string; today: string; isOn: (d: string) => boolean;
  overrides: Map<string, DayRow>; info: Map<string, NightInfo>; canEdit: boolean;
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2">Night</th>
            <th className="px-3 py-2">Hebrew date</th>
            <th className="px-3 py-2">Session</th>
            <th className="px-3 py-2">Learning session</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const o = overrides.get(d);
            const n = info.get(d)!;
            const on = isOn(d);
            const overridden = o?.is_session === true || o?.is_session === false;
            return (
              <Fragment key={d}>
                {(d === start || weekday(d) === 0) && (
                  <tr className="border-b bg-gray-100">
                    <td colSpan={4} className="px-3 py-1.5 text-right font-semibold text-gray-700" dir="rtl">{parshaOfWeek(d)}</td>
                  </tr>
                )}
                <tr className={`border-b align-top last:border-0 ${d === today ? "bg-blue-50" : on ? "" : "bg-gray-50 text-gray-500"}`}>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {formatDate(d)}
                    {o?.is_test_date && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Test</span>}
                  </td>
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
                        <button className="text-xs text-blue-700 underline" name="op" value={on ? "session_off" : "session_on"}>Turn {on ? "off" : "on"}</button>
                        {overridden && <button className="text-xs text-gray-500 underline" name="op" value="session_default">Reset</button>}
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
  );
}
