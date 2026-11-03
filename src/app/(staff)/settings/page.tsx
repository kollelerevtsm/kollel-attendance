import { requireRole, MANAGERS } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { Notice, PageTitle } from "@/components/Notice";
import { saveSettings } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (t: string) => t.slice(0, 5);

function TimeField({ name, label, value, help }: { name: string; label: string; value: string; help?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" type="time" id={name} name={name} defaultValue={hhmm(value)} required />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await requireRole(...MANAGERS);
  const s = await getSettings();
  const sp = await searchParams;

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
    </>
  );
}
