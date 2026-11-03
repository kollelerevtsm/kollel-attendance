// Reads the daily learning schedule from torahscha.app.

export const SCHEDULE_URL = "https://api.torahscha.app/api/schedule?continuous=true";

export interface ScheduleEntry {
  date: string;
  day_type: string;
  daf_he: string | null;
  extra: string | null;
  chazaras_hachodesh: string | null;
  masechta_he: string | null;
}

export interface SyncRow {
  day: string;
  sync_type: string;
  sync_topic: string;
  synced_at: string;
  is_test_date: boolean;
}

export async function fetchSchedule(): Promise<ScheduleEntry[]> {
  const res = await fetch(SCHEDULE_URL, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`torahscha.app answered ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected schedule format from torahscha.app");
  return data.filter((d) => typeof d?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && typeof d.day_type === "string");
}

export function topicFor(e: ScheduleEntry): string {
  const chazara = e.chazaras_hachodesh ? `חזרת החודש: ${e.chazaras_hachodesh}` : "";
  const join = (...parts: (string | null | false)[]) => parts.filter(Boolean).join(" · ");
  switch (e.day_type) {
    case "daf":
      return join(`${e.masechta_he ?? ""} ${e.daf_he ?? ""}`.trim(), chazara);
    case "chazara":
      return join("חזרה", e.extra !== "חזרה" && e.extra, chazara);
    case "test":
      return join(`בחינה: ${e.masechta_he ?? ""} ${e.extra ?? ""}`.trim(), chazara);
    default:
      return join(e.extra, chazara) || e.day_type;
  }
}

/**
 * Turn the schedule into calendar updates from `fromDate` on.
 * Test days are marked as test dates; a day that stops being a test in the schedule is unmarked
 * only if the mark came from the schedule.
 */
export function planSync(
  entries: ScheduleEntry[],
  existing: Map<string, { is_test_date: boolean; sync_type: string | null }>,
  fromDate: string,
  now = new Date().toISOString(),
): SyncRow[] {
  return entries
    .filter((e) => e.date >= fromDate)
    .map((e) => {
      const prev = existing.get(e.date);
      const isTest = e.day_type === "test" ? true : prev?.sync_type === "test" ? false : prev?.is_test_date ?? false;
      return { day: e.date, sync_type: e.day_type, sync_topic: topicFor(e), synced_at: now, is_test_date: isTest };
    });
}
