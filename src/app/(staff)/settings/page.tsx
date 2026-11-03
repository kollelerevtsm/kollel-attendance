import { requireRole, MANAGERS } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { Notice, PageTitle } from "@/components/Notice";
import { deleteDayType, saveDayType, saveSettings } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { COLORS, type DayType } from "@/lib/specialDays";

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
  const { data: types } = await supabase.from("day_types").select("*").order("name");

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
          <p className="text-xs text-gray-500">Rate changes apply going forward. Nights already approved keep their rate.</p>
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
        {((types ?? []) as DayType[]).map((t) => <DayTypeForm key={t.id} t={t} />)}
        <DayTypeForm />
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
