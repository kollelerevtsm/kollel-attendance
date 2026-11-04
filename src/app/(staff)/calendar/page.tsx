import Link from "next/link";
import { Fragment } from "react";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { hebrewDayOfNight, hebrewMonthRange, parshaOfWeek, type NightInfo } from "@/lib/hebrew";
import { addDays, minutesToLabel, timeToMinutes, weekday } from "@/lib/rules";
import { updateDay } from "./actions";
import { COLORS, periodFor, type DayType, type SpecialPeriod } from "@/lib/specialDays";
import { type CalendarRow } from "@/lib/calendarDay";
import { loadCalendar } from "@/lib/calendarData";
import { suggestNextTest } from "@/lib/daf";

type DayRow = CalendarRow & { is_review?: boolean };

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
  const [cal, { data: tests }, { data: typeRows }, { data: periodRows }] = await Promise.all([
    loadCalendar(start < today ? start : today, addDays(end > today ? end : today, 60)),
    supabase.from("calendar_days").select("day").eq("is_test_date", true).order("day"),
    supabase.from("day_types").select("*").order("name"),
    supabase.from("special_periods").select("*").gte("end_date", addDays(today, -60)).order("start_date"),
  ]);
  const dayTypes = (typeRows ?? []) as DayType[];
  const periods = (periodRows ?? []) as SpecialPeriod[];
  const typeOf = (d: string): DayType | null => {
    const p = periodFor(d, periods);
    return p ? dayTypes.find((t) => t.id === p.day_type_id) ?? null : null;
  };
  const overrides = cal.rows as Map<string, DayRow>;
  const info = cal.info;
  const testDates = (tests ?? []).map((t) => t.day as string);
  const shownTests = [...testDates.filter((d) => d < today).slice(-3), ...testDates.filter((d) => d >= today)];

  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const isOn = cal.isOn;
  const topic = cal.topic;
  const lastPastTest = [...testDates].reverse().find((d) => d <= today) ?? null;
  const nextSetTest = testDates.find((d) => d > today);
  const suggested = nextSetTest ? null : suggestNextTest(lastPastTest, addDays(today, 1), isOn, addDays, weekday);
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
            <Link className={`px-3 py-2 text-sm ${view === "month" ? "bg-brand-700 text-white" : "bg-white"}`} href={`/calendar?view=month&hm=${month.param}`}>Calendar</Link>
            <Link className={`px-3 py-2 text-sm ${view === "list" ? "bg-brand-700 text-white" : "bg-white"}`} href={`/calendar?view=list&hm=${month.param}`}>List</Link>
          </div>
          <div className="flex gap-2" dir="rtl">
            <Link className="btn-secondary" href={href({ hm: month.prev })}>→ Previous</Link>
            <Link className="btn-secondary" href={`/calendar?view=${view}`}>Today</Link>
            <Link className="btn-secondary" href={href({ hm: month.next })}>Next ←</Link>
          </div>
        </div>
      </div>

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
        {canEdit && suggested && (
          <form action={updateDay} className="inline-flex items-center gap-2 rounded-full border border-dashed border-amber-400 px-3 py-1 text-sm">
            <input type="hidden" name="day" value={suggested} />
            Next test probably {formatDate(suggested, { weekday: "short", month: "short", day: "numeric" })}
            <button className="font-medium text-brand-700 underline" name="op" value="test_on">Add</button>
          </form>
        )}
        {canEdit && (
          <form action={updateDay} className="ml-auto flex flex-wrap items-center gap-2">
            <input type="hidden" name="op" value="test_many" />
            <input className="input w-40 py-1" type="date" name="days" required min={today} aria-label="Test date" />
            <input className="input w-40 py-1" type="date" name="days" min={today} aria-label="Another test date" />
            <input className="input w-40 py-1" type="date" name="days" min={today} aria-label="Another test date" />
            <button className="btn-secondary px-3 py-1" type="submit">Add test dates</button>
          </form>
        )}
      </section>

      {canEdit && (
        <p className="mb-4 text-sm text-gray-600">
          Special days (Chol Hamoed, Erev Yom Tov…) are set in <Link className="text-brand-700 underline" href="/settings#special">Settings</Link>.
        </p>
      )}

      <p className="mb-4 text-sm text-gray-600">
        {sessionCount} session nights this month. Each night shows the Hebrew date of that night, with the English date of the evening in small print.
        Holiday nights are off according to <Link className="text-brand-700 underline" href="/settings#holidays">Settings</Link>
        {settings.daf_start_date ? "; the daf fills in by itself from the starting point in Settings" : <>; set a <Link className="text-brand-700 underline" href="/settings#daf">daf starting point</Link> to fill in the daf automatically</>}.
        {canEdit ? " Click a night to turn it on or off, mark it as a review night, or change its learning." : ""}
      </p>

      {view === "month" ? (
        <>
          <MonthGrid days={days} start={start} today={today} selected={selected} isOn={isOn} overrides={overrides} info={info} typeOf={typeOf} topic={topic} dayHref={(d) => href({ day: d })} />
          {selected && (
            <DayEditor
              type={typeOf(selected)}
              topic={topic(selected)}
              autoDaf={cal.autoDaf(selected)}
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
        <ListView days={days} start={start} today={today} isOn={isOn} overrides={overrides} info={info} canEdit={canEdit} typeOf={typeOf} topic={topic} />
      )}
    </>
  );
}

function MonthGrid({ days, start, today, selected, isOn, overrides, info, typeOf, topic, dayHref }: {
  days: string[]; start: string; today: string; selected: string | null;
  isOn: (d: string) => boolean; overrides: Map<string, DayRow>; info: Map<string, NightInfo>;
  typeOf: (d: string) => DayType | null; topic: (d: string) => string | null; dayHref: (d: string) => string;
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
                    className={`min-h-24 border-l p-1.5 text-xs last:border-l-0 hover:bg-brand-50 ${on ? "bg-white" : "bg-gray-50 text-gray-400"} ${d === selected ? "ring-2 ring-inset ring-brand-600" : ""}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className={`text-lg font-semibold ${d === today ? "rounded-full bg-brand-700 px-2 text-white" : ""}`}>{hebrewDayOfNight(d)}</span>
                      <span className="text-[11px] text-gray-400" dir="ltr">{formatDate(d, { month: "short", day: "numeric" })}</span>
                    </div>
                    <div dir="ltr" className="text-left">
                      {typeOf(d) && <div className={`mt-0.5 truncate rounded px-1 ${COLORS[typeOf(d)!.color] ?? COLORS.purple}`}>{typeOf(d)!.name}</div>}
                      {n.holidays.length > 0 && <div className="mt-0.5 truncate text-purple-700">{n.holidays.join(" · ")}</div>}
                      {o?.is_test_date && <div className="mt-0.5 rounded bg-amber-100 px-1 text-amber-800">Test</div>}
                      {on && topic(d) && <div className={`mt-0.5 truncate ${o?.is_review ? "text-sky-700" : "text-gray-700"}`} dir="auto">{topic(d)}</div>}
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

function DayEditor({ day, on, row, info, canEdit, closeHref, type, topic, autoDaf }: {
  day: string; on: boolean; row?: DayRow; info: NightInfo; canEdit: boolean; closeHref: string; type: DayType | null;
  topic: string | null; autoDaf: string | null;
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
            {on && (
              <button className="btn-secondary px-3 py-1" name="op" value={row?.is_review ? "review_off" : "review_on"}>
                {row?.is_review ? "Not a review night" : "Review night (no new daf)"}
              </button>
            )}
          </form>
        )}
      </div>
      {canEdit ? (
        <form action={updateDay} className="flex max-w-xl gap-2">
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="op" value="topic" />
          <input className="input" name="learning_topic" defaultValue={row?.learning_topic ?? ""} dir="auto" placeholder={autoDaf ?? row?.sync_topic ?? "Learning session, e.g. Bava Metzia 21a"} />
          <button className="btn" type="submit">Save</button>
        </form>
      ) : (
        topic && <p dir="auto">Learning: {topic}</p>
      )}
      {canEdit && on && <p className="text-sm text-gray-600" dir="auto">Learning tonight: <strong>{topic ?? "—"}</strong>{!row?.learning_topic && autoDaf ? " (filled in automatically; type in the box to change it)" : ""}</p>}
    </section>
  );
}

function ListView({ days, start, today, isOn, overrides, info, canEdit, typeOf, topic }: {
  days: string[]; start: string; today: string; isOn: (d: string) => boolean;
  overrides: Map<string, DayRow>; info: Map<string, NightInfo>; canEdit: boolean; typeOf: (d: string) => DayType | null;
  topic: (d: string) => string | null;
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
                <tr className={`border-b align-top last:border-0 ${d === today ? "bg-brand-50" : on ? "" : "bg-gray-50 text-gray-500"}`}>
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
                        <button className="text-xs text-brand-700 underline" name="op" value={on ? "session_off" : "session_on"}>Turn {on ? "off" : "on"}</button>
                        {overridden && <button className="text-xs text-gray-500 underline" name="op" value="session_default">Reset</button>}
                        {on && <button className="text-xs text-sky-700 underline" name="op" value={o?.is_review ? "review_off" : "review_on"}>{o?.is_review ? "Undo review" : "Review"}</button>}
                      </form>
                    )}
                  </td>
                  <td className="px-3 py-2 min-w-56">
                    {canEdit ? (
                      <form action={updateDay} className="flex gap-1">
                        <input type="hidden" name="day" value={d} />
                        <input type="hidden" name="op" value="topic" />
                        <input className="input py-1" name="learning_topic" defaultValue={o?.learning_topic ?? ""} dir="auto" placeholder={topic(d) ?? "e.g. Bava Metzia 21a"} />
                        <button className="btn-secondary px-2 py-1 text-xs" type="submit">Save</button>
                      </form>
                    ) : (
                      <span dir="auto">{topic(d) ?? ""}</span>
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
