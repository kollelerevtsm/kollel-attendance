import Link from "next/link";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getSettings, todayIn } from "@/lib/data";
import { Notice, PageTitle } from "@/components/Notice";
import { saveTestSheet } from "./actions";

export default async function TestsPage({ searchParams }: PageProps<"/tests">) {
  const me = await requireRole(...STAFF);
  const canEdit = MANAGERS.includes(me.role);
  const sp = await searchParams;
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const supabase = await createClient();

  const { data: dates } = await supabase.from("calendar_days").select("day").eq("is_test_date", true).order("day", { ascending: false });
  const testDates = (dates ?? []).map((d) => d.day as string);
  const requested = typeof sp.date === "string" ? sp.date : undefined;
  const selected = requested && testDates.includes(requested) ? requested : testDates.find((d) => d <= today) ?? testDates[testDates.length - 1];

  if (!selected) {
    return (
      <>
        <PageTitle title="Test sheet" />
        <div className="card text-gray-600">
          No test dates yet. Mark a test date on the <Link className="text-brand-700 underline" href="/calendar">Calendar</Link> first.
        </div>
      </>
    );
  }

  const [{ data: students }, { data: takers }] = await Promise.all([
    supabase.from("students").select("id,first_name,last_name,pin,active").eq("active", true).order("last_name").order("first_name"),
    supabase.from("test_takers").select("student_id,source").eq("test_date", selected),
  ]);
  const took = new Map((takers ?? []).map((t) => [t.student_id as string, t.source as string]));
  const nextTest = [...testDates].reverse().find((d) => d > selected);
  const closesOn = addDay(selected, settings.test_claim_days ?? 0);
  const closed = today > closesOn;
  const locked = closed && me.role !== "admin";

  return (
    <>
      <PageTitle title="Test sheet">
        <div className="flex flex-wrap gap-2">
          {testDates.map((d) => (
            <Link key={d} href={`/tests?date=${d}`} className={d === selected ? "btn" : "btn-secondary"}>
              {formatDate(d, { month: "short", day: "numeric", year: "numeric" })}
            </Link>
          ))}
        </div>
      </PageTitle>
      <Notice
        error={typeof sp.error === "string" ? sp.error : undefined}
        message={typeof sp.message === "string" ? sp.message : undefined}
      />
      <p className="mb-4 text-sm text-gray-600">
        Students ticked here are paid ${settings.test_rate} for the test night without clocking in, and ${settings.test_rate} a night
        from {formatDate(selected)} {nextTest ? `until ${formatDate(addDay(nextTest, -1))}` : "until the next test date is set"}.
        Everyone else gets ${settings.base_rate}.
      </p>
      <p className={`mb-4 text-sm ${closed ? "text-gray-600" : "text-green-800"}`}>
        {closed
          ? `Closed for claims since ${formatDate(addDay(closesOn, 1))}.${me.role === "admin" ? " As admin you can still change it." : ""}`
          : (settings.test_claim_days ?? 0) > 0
            ? `Open for claims until ${formatDate(closesOn)}. Students can also claim it by entering their PIN on the scanner until then.`
            : "Claims are accepted only on the test night."}
      </p>
      <form action={saveTestSheet} className="card space-y-4">
        <input type="hidden" name="date" value={selected} />
        <fieldset disabled={!canEdit || locked} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(students ?? []).map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
              <input type="checkbox" name="student" value={s.id} defaultChecked={took.has(s.id)} />
              <span dir="auto">{s.last_name}, {s.first_name}</span>
              {took.get(s.id) === "scanner" && <span className="ml-auto text-xs text-gray-400">from scanner</span>}
            </label>
          ))}
        </fieldset>
        <p className="text-sm text-gray-600">{took.size} of {(students ?? []).length} took this test.</p>
        {canEdit && !locked && <button className="btn" type="submit">Save test sheet</button>}
      </form>
    </>
  );
}

function addDay(d: string, n: number) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
}
