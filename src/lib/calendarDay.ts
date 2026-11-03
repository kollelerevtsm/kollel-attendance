// What the calendar says about one night, combining the principal's choices with the torahscha.app schedule.
// The principal's choices always win.

export interface CalendarRow {
  day: string;
  is_session: boolean | null;
  learning_topic: string | null;
  is_test_date: boolean;
  sync_type?: string | null;
  sync_topic?: string | null;
}

/** Schedule types that mean "no learning tonight" (Yom Tov). Chol Hamoed stays on. */
export const OFF_TYPES = ["yt"];

/** The on/off override for isSessionNight(): principal's choice, else off for Yom Tov days in the schedule. */
export function sessionOverride(row: CalendarRow | undefined): boolean | null {
  if (!row) return null;
  if (row.is_session === true || row.is_session === false) return row.is_session;
  return row.sync_type && OFF_TYPES.includes(row.sync_type) ? false : null;
}

export function topicOf(row: CalendarRow | undefined): string | null {
  return row?.learning_topic || row?.sync_topic || null;
}
