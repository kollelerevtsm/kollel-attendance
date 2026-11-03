import Link from "next/link";
import { Fragment } from "react";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { hebrewDayOfNight, hebrewMonthRange, nightsInfo, parshaOfWeek, type NightInfo } from "@/lib/hebrew";
import { addDays, isSessionNight, minutesToLabel, timeToMinutes, weekday } from "@/lib/rules";
import { syncSchedule, updateDay } from "./actions";
import { COLORS, periodFor, type DayType, type SpecialPeriod } from "@/lib/specialDays";
import { sessionOverride, topicOf, type CalendarRow } from "@/lib/calendarDay";

type DayRow = CalendarRow;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש״ק"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const me = await requireRole(...STAFF);
  const canEdit = MANAGERS.includes(me.role);
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "month";
  const month = hebrewMonthRange(typeof sp.hm === "string" ? sp.hm : undefined, today);
  const { start, end } = month;
  const selected = typeof sp.day === "string" && sp.day >= start && sp.day <= end ? sp.day : null;
  const href = (q: Record<string, string>) => "/calendar?" + new URLSearchParams({ view, hm: month.param, ...q }).toString();

  const supabase = await createClient();
  const [{ data }, { data: tests }, { data: last }, { data: typeRows }, { data: periodRows }] = await Promise.all([
    supabase.from("calendar_days").select("*").gte("day", start).lte("day", end),
    supabase.from("calendar_days").select("day").eq("is_test_date", true).order("day"),
    supabase.from("calendar_days").select("synced_at").not("synced_at", "is", null).order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("day_types").select("*").order("name"),
    supabase.from("special_periods").select("*").gte("end_date", addDays(today, -60)).order("start_date"),
  ]);
  const dayTypes = (typeRows ?? []) as DayType[];
  const periods = (periodRows ?? []) as SpecialPeriod[];
  const typeOf = (d: string): DayType | null => {
    const p = periodFor(d, periods);
    return p ? dayTypes.find((t) => t.id === p.day_type_id) ?? null : null;
  };
  const lastSync = (last?.synced_at as string | undefined) ?? null;
  const overrides = new Map(((data ?? []) as DayRow[]).map((d) => [d.day, d]));
  const info = nightsInfo(start, end);
  const testDates = (tests ?? []).map((t) => t.day as string);
  const shownTests = [...testDates.filter((d) => d < today).slice(-3), ...testDates.filter((d) => d >= today)];

  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const isOn = (d: string) => isSessionNight(d, settings.session_weekdays, sessionOverride(overrides.get(d)), info.get(d)!.suggestedOff);
  const sessionCount = days.filter(isOn).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold" dir="rtl">{month.title}</h1>
          <p className="text-sm text-gray-500">
            {formatDate(start, { month: "short", day: "numeric" })} – {formatDate(end, { month: "short", day: "numeric", year: "numeric" })} (evenings)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
            <Link className={`px-3 py-2 text-sm ${view === "month" ? "bg-blue-700 text-white" : "bg-white"}`} href={`/calendar?view=month&hm=${month.param}`}>Calendar</Link>
            <Link className={`px-3 py-2 text-sm ${view === "list" ? "bg-blue-700 text-white" : "bg-white"}`} href={`/calendar?view=list&hm=${month.param}`}>List</Link>
          </div>
          <div className="flex gap-2" dir="rtl">
            <Link className="btn-secondary" href={href({ hm: month.prev })}>→ Previous</Link>
            <Link className="btn-secondary" href={`/calendar?view=${view}`}>Today</Link>
            <Link className="btn-secondary" href={href({ hm: month.next })}>Next ←</Link>
          </div>
        </div>
      </div>

      {canEdit && (
        <form action={syncSchedule} className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span>
            Daily learning, test dates and Yom Tov days come from torahscha.app automatically every morning
            {lastSync ? ` (last update ${new Date(lastSync).toLocaleString("en-US", { timeZone: settings.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })})` : ""}.
          </span>
          <button className="btn-secondary px-3 py-1" type="submit">Update now</button>
          {typeof sp.synced === "string" && <span className="text-green-700">{sp.synced}</span>}
          {typeof sp.sync_error === "string" && <span className="text-red-700">{sp.sync_error}</span>}
        </form>
      )}

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

      {canEdit && (
        <p className="mb-4 text-sm text-gray-600">
          Special days (Chol Hamoed, Erev Yom Tov…) are set in <Link className="text-blue-700 underline" href="/settings#special">Settings</Link>.
        </p>
      )}

      <p className="mb-4 text-sm text-gray-600">
        {sessionCount} session nights this month. Each night shows the Hebrew date of that night, with the English date of the evening in small print. Nights before Yom Tov are off automatically;
        {canEdit ? " click a night to turn it on or off or set the learning session." : ""}
      </p>

      {view === "month" ? (
        <>
          <MonthGrid days={days} start={start} today={today} selected={selected} isOn={isOn} overrides={overrides} info={info} typeOf={typeOf} dayHref={(d) => href({ day: d })} />
          {selected && (
            <DayEditor
              type={typeOf(selected)}
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
        <ListView days={days} start={start} today={today} isOn={isOn} overrides={overrides} info={info} canEdit={canEdit} typeOf={typeOf} />
      )}
    </>
  );
}

function MonthGrid({ days, start, today, selected, isOn, overrides, info, typeOf, dayHref }: {
  days: string[]; start: string; today: string; selected: string | null;
  isOn: (d: string) => boolean; overrides: Map<string, DayRow>; info: Map<string, NightInfo>;
  typeOf: (d: string) => DayType | null; dayHref: (d: string) => string;
}) {
  const lead = weekday(start);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="card overflow-x-auto p-0" dir="rtl">
      <div className="grid min-w-[720px] grid-cols-7 border-b bg-gray-50 text-center text-xs font-medium text-gray-600">
        {WEEKDAYS.map((w, i) => <div key={w} className="py-2">{WEEKDAYS_HE[i]} <span className="text-gray-400" dir="ltr">{w}</span></div>)}
      </div>
      {weeks.map((week, wi) => {
        const firstDay = week.find((d) => d) as string;
        return (
          <div key={wi} className="min-w-[720px]">
            <div className="border-b bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">{parshaOfWeek(firstDay)}</div>
            <div className="grid grid-cols-7 border-b last:border-0">
              {week.map((d, i) => {
                if (!d) return <div key={i} className="min-h-24 border-l bg-gray-50 last:border-l-0" />;
                const o = overrides.get(d);
                const n = info.get(d)!;
                const on = isOn(d);
                return (
                  <Link
                    key={d}
                    href={dayHref(d)}
                    scroll={false}
                    className={`min-h-24 border-l p-1.5 text-xs last:border-l-0 hover:bg-blue-50 ${on ? "bg-white" : "bg-gray-50 text-gray-400"} ${d === selected ? "ring-2 ring-inset ring-blue-600" : ""}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className={`text-lg font-semibold ${d === today ? "rounded-full bg-blue-700 px-2 text-white" : ""}`}>{hebrewDayOfNight(d)}</span>
                      <span className="text-[11px] text-gray-400" dir="ltr">{formatDate(d, { month: "short", day: "numeric" })}</span>
                    </div>
                    <div dir="ltr" className="text-left">
                      {typeOf(d) && <div className={`mt-0.5 truncate rounded px-1 ${COLORS[typeOf(d)!.color] ?? COLORS.purple}`}>{typeOf(d)!.name}</div>}
                      {n.holidays.length > 0 && <div className="mt-0.5 truncate text-purple-700">{n.holidays.join(" · ")}</div>}
                      {o?.is_test_date && <div className="mt-0.5 rounded bg-amber-100 px-1 text-amber-800">Test</div>}
                      {topicOf(o) && <div className={`mt-0.5 truncate ${on ? "text-gray-700" : "text-gray-400"}`} dir="auto">{topicOf(o)}</div>}
                      {!on && <div className="mt-0.5">No session</div>}
                    </div>
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

function DayEditor({ day, on, row, info, canEdit, closeHref, type }: {
  day: string; on: boolean; row?: DayRow; info: NightInfo; canEdit: boolean; closeHref: string; type: DayType | null;
}) {
  const t = (v: string) => minutesToLabel(timeToMinutes(v));
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
      {type && (
        <p className="text-sm">
          <span className={`rounded px-2 py-0.5 ${COLORS[type.color] ?? COLORS.purple}`}>{type.name}</span>{" "}
          {t(type.session_start)}–{t(type.session_end)} · clock-in from {t(type.clock_in_opens)}, clock-out by {t(type.clock_out_closes)} · {type.required_minutes} min required
        </p>
      )}
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
          <input className="input" name="learning_topic" defaultValue={row?.learning_topic ?? ""} dir="auto" placeholder={row?.sync_topic ?? "Learning session, e.g. Bava Metzia 21a"} />
          <button className="btn" type="submit">Save</button>
        </form>
      ) : (
        topicOf(row) && <p dir="auto">Learning: {topicOf(row)}</p>
      )}
      {row?.sync_topic && (
        <p className="text-sm text-gray-500">
          From torahscha.app: <span dir="rtl">{row.sync_topic}</span>
          {canEdit && " — leave the box empty to use this, or type something else to replace it."}
        </p>
      )}
    </section>
  );
}

function ListView({ days, start, today, isOn, overrides, info, canEdit, typeOf }: {
  days: string[]; start: string; today: string; isOn: (d: string) => boolean;
  overrides: Map<string, DayRow>; info: Map<string, NightInfo>; canEdit: boolean; typeOf: (d: string) => DayType | null;
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2">Night</th>
            <th className="px-3 py-2">English date</th>
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-base font-semibold" dir="rtl">{n.hebrewDate.split(" ").slice(0, 2).join(" ")}</span>
                    {o?.is_test_date && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Test</span>}
                    {typeOf(d) && <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${COLORS[typeOf(d)!.color] ?? COLORS.purple}`}>{typeOf(d)!.name}</span>}
                    {n.holidays.length > 0 && <div className="text-xs text-purple-700">{n.holidays.join(" · ")}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{formatDate(d)}</td>
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
                        <input className="input py-1" name="learning_topic" defaultValue={o?.learning_topic ?? ""} dir="auto" placeholder={o?.sync_topic ?? "e.g. Bava Metzia 21a"} />
                        <button className="btn-secondary px-2 py-1 text-xs" type="submit">Save</button>
                      </form>
                    ) : (
                      <span dir="auto">{topicOf(o) ?? ""}</span>
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
