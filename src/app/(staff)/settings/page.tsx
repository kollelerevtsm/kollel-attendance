import { requireRole, MANAGERS } from "@/lib/auth";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { addDays } from "@/lib/rules";
import { COLORS, type DayType, type SpecialPeriod } from "@/lib/specialDays";
import { HOLIDAY_CATEGORIES } from "@/lib/hebrew";
import { MASECHTOS } from "@/lib/daf";
import { createClient } from "@/lib/supabase/server";
import { Notice, PageTitle } from "@/components/Notice";
import { addSpecialPeriod, deleteDayType, deleteSpecialPeriod, saveDayType, saveSettings } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (t: string) => t.slice(0, 5);

function TimeField({ name, label, value, help, prefix = "" }: { name: string; label: string; value: string; help?: string; prefix?: string }) {
  return (
    <div>
      <label className="label" htmlFor={prefix + name}>{label}</label>
      <input className="input" type="time" id={prefix + name} name={name} defaultValue={hhmm(value)} required />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await requireRole(...MANAGERS);
  const s = await getSettings();
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayIn(s.timezone);
  const [{ data: types }, { data: periodRows }] = await Promise.all([
    supabase.from("day_types").select("*").order("name"),
    supabase.from("special_periods").select("*").gte("end_date", addDays(today, -60)).order("start_date"),
  ]);
  const dayTypes = (types ?? []) as DayType[];
  const periods = (periodRows ?? []) as SpecialPeriod[];

  return (
    <>
      <PageTitle title="Settings" />
      <Notice
        error={typeof sp.error === "string" ? sp.error : undefined}
        message={typeof sp.message === "string" ? sp.message : undefined}
      />
      <form action={saveSettings} className="space-y-6">
        <section className="card space-y-4">
          <h2 className="font-semibold">Session times</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TimeField name="session_start" label="Session starts" value={s.session_start} />
            <TimeField name="session_end" label="Session ends" value={s.session_end} />
            <TimeField name="clock_in_opens" label="Clock-in opens" value={s.clock_in_opens} help="Scans before this time don't count." />
            <TimeField name="clock_out_closes" label="Clock-out closes" value={s.clock_out_closes} help="Scans after this time don't count." />
            <div>
              <label className="label" htmlFor="required_minutes">Minutes required for a paid night</label>
              <input className="input" type="number" min={1} id="required_minutes" name="required_minutes" defaultValue={s.required_minutes} required />
              <p className="mt-1 text-xs text-gray-500">Less than this between clock-in and clock-out pays $0.</p>
            </div>
          </div>
          <div>
            <span className="label">Session nights</span>
            <div className="flex flex-wrap gap-4">
              {DAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="session_weekdays" value={i} defaultChecked={s.session_weekdays.includes(i)} />
                  {d}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold">Pay</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="base_rate">Rate per night ($)</label>
              <input className="input" type="number" step="0.01" min={0} id="base_rate" name="base_rate" defaultValue={s.base_rate} required />
            </div>
            <div>
              <label className="label" htmlFor="test_rate">Rate per night after taking the test ($)</label>
              <input className="input" type="number" step="0.01" min={0} id="test_rate" name="test_rate" defaultValue={s.test_rate} required />
            </div>
            <div>
              <label className="label" htmlFor="pay_period">Pay period</label>
              <select className="input" id="pay_period" name="pay_period" defaultValue={s.pay_period}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every two weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="max-w-md">
            <label className="label" htmlFor="test_claim_days">Days after a test that it can still be claimed</label>
            <input className="input" type="number" min={0} max={60} id="test_claim_days" name="test_claim_days" defaultValue={s.test_claim_days ?? 0} />
            <p className="mt-1 text-xs text-gray-500">
              0 = only on the test night. For example 7: a student who takes the test up to a week late (entering their PIN on the scanner,
              or ticked on the test sheet) still gets the test rate. After that the test sheet is locked (the admin can still change it).
            </p>
          </div>
          <p className="text-xs text-gray-500">Rate changes apply going forward. Nights already approved keep their rate.</p>
        </section>

        <section id="holidays" className="card space-y-3">
          <h2 className="font-semibold">Nights off for holidays</h2>
          <p className="text-sm text-gray-600">Ticked nights are off automatically every year. You can still turn any single night on or off on the Calendar.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {HOLIDAY_CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="off_holidays" value={c.key} defaultChecked={(s.off_holidays ?? ["yomtov"]).includes(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </section>

        <section id="daf" className="card space-y-3">
          <h2 className="font-semibold">Daf schedule</h2>
          <p className="text-sm text-gray-600">
            Enter where the learning is on one night; the calendar fills in one daf per session night from there, skipping nights off,
            review nights and test nights. If the kollel gets out of step, change the starting point to the correct daf on a recent night.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="daf_start_masechta">Masechta</label>
              <select className="input" id="daf_start_masechta" name="daf_start_masechta" defaultValue={s.daf_start_masechta ?? ""}>
                <option value="">— not set —</option>
                {MASECHTOS.map((m) => <option key={m.key} value={m.key}>{m.he} ({m.en})</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="daf_start_daf">Daf</label>
              <input className="input" type="number" min={2} max={176} id="daf_start_daf" name="daf_start_daf" defaultValue={s.daf_start_daf ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="daf_start_date">Learned on the night of</label>
              <input className="input" type="date" id="daf_start_date" name="daf_start_date" defaultValue={s.daf_start_date ?? ""} />
            </div>
          </div>
        </section>

        <button className="btn" type="submit">Save settings</button>
      </form>

      <section id="special" className="mt-10 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Special day types</h2>
          <p className="text-sm text-gray-600">
            Days with different hours or pay, like Chol Hamoed. Create the type here, then add its dates on the Calendar.
            Leave a rate empty to use the regular rate.
          </p>
        </div>
        {dayTypes.map((t) => <DayTypeForm key={t.id} t={t} />)}
        <DayTypeForm />
      </section>

      <section id="special-dates" className="mt-10 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Special dates</h2>
          <p className="text-sm text-gray-600">
            Which dates follow a special day type. On these dates attendance uses that type&apos;s hours and pay.
            If two ranges overlap, the shorter one wins.
          </p>
        </div>
        <div className="card space-y-4">
          {periods.length === 0 && <p className="text-sm text-gray-500">No special dates yet.</p>}
          {periods.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-gray-600">
                <tr><th className="py-2">Day type</th><th className="py-2">From</th><th className="py-2">To</th><th className="py-2">Note</th><th /></tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const t = dayTypes.find((x) => x.id === p.day_type_id);
                  return (
                    <tr key={p.id} className={`border-b last:border-0 ${p.end_date < today ? "text-gray-400" : ""}`}>
                      <td className="py-2"><span className={`rounded px-2 py-0.5 ${COLORS[t?.color ?? "purple"] ?? COLORS.purple}`}>{t?.name}</span></td>
                      <td className="py-2">{formatDate(p.start_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="py-2">{p.end_date !== p.start_date ? formatDate(p.end_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                      <td className="py-2" dir="auto">{p.note}</td>
                      <td className="py-2 text-right">
                        <form action={deleteSpecialPeriod}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="text-xs text-red-700 underline" type="submit">Remove</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {dayTypes.length === 0 ? (
            <p className="text-sm text-gray-600">Add a day type above first.</p>
          ) : (
            <form action={addSpecialPeriod} className="flex flex-wrap items-end gap-3 border-t pt-4">
              <div>
                <label className="label" htmlFor="sp-type">Day type</label>
                <select className="input" id="sp-type" name="day_type_id" required>
                  {dayTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sp-from">From</label>
                <input className="input" id="sp-from" type="date" name="start_date" required />
              </div>
              <div>
                <label className="label" htmlFor="sp-to">To (empty = one day)</label>
                <input className="input" id="sp-to" type="date" name="end_date" />
              </div>
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="sp-note">Note</label>
                <input className="input" id="sp-note" name="note" dir="auto" placeholder="e.g. Pesach" />
              </div>
              <button className="btn" type="submit">Add dates</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

function DayTypeForm({ t }: { t?: DayType }) {
  const rate = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)));
  return (
    <div className="card space-y-3">
      <form action={saveDayType} className="space-y-3">
        {t && <input type="hidden" name="id" value={t.id} />}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="label">{t ? "Name" : "New day type"}</label>
            <input className="input" name="name" defaultValue={t?.name ?? ""} placeholder="e.g. Fast day" required dir="auto" />
          </div>
          <div>
            <label className="label">Color</label>
            <select className="input" name="color" defaultValue={t?.color ?? "purple"}>
              {Object.keys(COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {t && <span className={`rounded px-2 py-1 text-sm ${COLORS[t.color] ?? COLORS.purple}`}>{t.name}</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TimeField name="clock_in_opens" label="Clock-in opens" value={t?.clock_in_opens ?? ""} prefix={`${t?.id ?? "new"}-`} />
          <TimeField name="session_start" label="Starts" value={t?.session_start ?? ""} prefix={`${t?.id ?? "new"}-`} />
          <TimeField name="session_end" label="Ends" value={t?.session_end ?? ""} prefix={`${t?.id ?? "new"}-`} />
          <TimeField name="clock_out_closes" label="Clock-out closes" value={t?.clock_out_closes ?? ""} prefix={`${t?.id ?? "new"}-`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Minutes required</label>
            <input className="input" type="number" min={1} name="required_minutes" defaultValue={t?.required_minutes ?? ""} required />
          </div>
          <div>
            <label className="label">Rate ($, empty = regular)</label>
            <input className="input" type="number" step="0.01" min={0} name="base_rate" defaultValue={rate(t?.base_rate)} />
          </div>
          <div>
            <label className="label">Rate after test ($, empty = regular)</label>
            <input className="input" type="number" step="0.01" min={0} name="test_rate" defaultValue={rate(t?.test_rate)} />
          </div>
        </div>
        <button className={t ? "btn-secondary" : "btn"} type="submit">{t ? "Save" : "Add day type"}</button>
      </form>
      {t && (
        <form action={deleteDayType}>
          <input type="hidden" name="id" value={t.id} />
          <button className="text-xs text-red-700 underline" type="submit">Delete this day type and all its dates</button>
        </form>
      )}
    </div>
  );
}
