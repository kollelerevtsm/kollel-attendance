// Business rules for attendance, PINs and pay.
// Pure functions only (no database), so they can be unit-tested.

/** "test" = from one בחינה to the day before the next. */
export type PayPeriod = "weekly" | "biweekly" | "monthly" | "test";

export interface Settings {
  session_start: string; // "20:30" or "20:30:00"
  session_end: string;
  clock_in_opens: string;
  clock_out_closes: string;
  required_minutes: number;
  base_rate: number;
  test_rate: number;
  pay_period: PayPeriod;
  session_weekdays: number[]; // 0 = Sunday
  timezone: string;
  off_holidays?: string[];
  test_claim_days?: number;
  /** On test night, a student who took the test must still clock in and out to be paid. */
  test_night_attendance?: boolean;
  daf_start_masechta?: string | null;
  daf_start_daf?: number | null;
  daf_start_date?: string | null;
}

// ── PINs ─────────────────────────────────────────────────────

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * The PIN is the last 4 digits of the phone number. If another student
 * already has those 4 digits, use the last 5 (then 6…) instead.
 */
/** An ID the way CrossChex stores it: no leading zeros ("0243" → "243"). */
export function normalizePin(pin: string): string {
  return pin.replace(/^0+(?=\d)/, "");
}

export function choosePin(
  phone: string,
  takenPins: Iterable<string>,
): { pin: string; extended: boolean } {
  const digits = digitsOnly(phone);
  if (digits.length < 4) {
    throw new Error("Phone number must have at least 4 digits.");
  }
  const taken = new Set(takenPins);
  for (let len = 4; len <= digits.length; len++) {
    // CrossChex drops leading zeros from employee IDs (0243 becomes 243), so we do too.
    const pin = normalizePin(digits.slice(-len));
    if (pin.length < 3) continue;
    if (!taken.has(pin)) return { pin, extended: len > 4 };
  }
  throw new Error("Every PIN from this phone number is already in use.");
}

// ── Time helpers ─────────────────────────────────────────────

/** "20:30" or "20:30:00" → minutes after midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToLabel(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")}${h24 < 12 ? "am" : "pm"}`;
}

/** Local calendar date ("YYYY-MM-DD") and minutes-after-midnight of an instant in a time zone. */
export function localParts(instant: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" date. */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// ── Calendar ─────────────────────────────────────────────────

/**
 * Is this a session night?
 * The principal's choice wins; otherwise it's a session weekday that isn't a suggested holiday.
 */
export function isSessionNight(
  date: string,
  sessionWeekdays: number[],
  override: boolean | null | undefined,
  suggestedOff: boolean,
): boolean {
  if (override === true || override === false) return override;
  return sessionWeekdays.includes(weekday(date)) && !suggestedOff;
}

// ── Test rate ────────────────────────────────────────────────

/**
 * A student earns the test rate on a night if they took the most recent test
 * held on or before that night. Before the first test, everyone gets the base rate.
 */
export function testRateApplies(
  night: string,
  testDates: string[],
  datesStudentTookTest: Set<string>,
): boolean {
  let latest: string | null = null;
  for (const t of testDates) {
    if (t <= night && (latest === null || t > latest)) latest = t;
  }
  return latest !== null && datesStudentTookTest.has(latest);
}

// ── One student, one night ───────────────────────────────────

export type NightStatus = "paid" | "short" | "absent" | "missing_in" | "missing_out" | "test";

export interface NightResult {
  status: NightStatus;
  clockIn: Date | null;
  clockOut: Date | null;
  minutes: number | null;
  rate: number;
  amount: number;
  reason: string;
}

/**
 * Work out a student's result for one session night.
 *
 * - Scans count only on that night's date, between clock_in_opens and clock_out_closes.
 * - First counted scan = clock in, last = clock out.
 * - Paid when minutes between them ≥ required_minutes; otherwise $0.
 * - On a test date, a student who took the test is paid the test rate without clocking in.
 */
export function computeNight(input: {
  night: string;
  scans: Date[];
  settings: Settings;
  tookTestTonight: boolean;
  testRateActive: boolean;
  /** Times entered by the principal; these replace the scanner's clock-in / clock-out. */
  manualIn?: Date | null;
  manualOut?: Date | null;
}): NightResult {
  const { night, scans, settings, tookTestTonight, testRateActive, manualIn, manualOut } = input;
  const rate = testRateActive || tookTestTonight ? settings.test_rate : settings.base_rate;

  if (tookTestTonight && !settings.test_night_attendance) {
    return {
      status: "test",
      clockIn: null,
      clockOut: null,
      minutes: null,
      rate: settings.test_rate,
      amount: settings.test_rate,
      reason: "Took the test",
    };
  }

  const opens = timeToMinutes(settings.clock_in_opens);
  const closes = timeToMinutes(settings.clock_out_closes);
  let counted = scans
    .filter((s) => {
      const p = localParts(s, settings.timezone);
      return p.date === night && p.minutes >= opens && p.minutes <= closes;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  if (manualIn) counted = [manualIn, ...counted.filter((s) => s > manualIn)];
  if (manualOut) counted = [...counted.filter((s) => s < manualOut), manualOut];

  const none = { clockIn: null, clockOut: null, minutes: null, rate, amount: 0 };

  if (counted.length === 0) {
    return { ...none, status: "absent", reason: "No scans" };
  }

  if (counted.length === 1) {
    const only = counted[0];
    const mins = localParts(only, settings.timezone).minutes;
    const beforeEnd = mins < timeToMinutes(settings.session_end);
    return beforeEnd
      ? { ...none, clockIn: only, status: "missing_out", reason: `Clocked in at ${minutesToLabel(mins)}, no clock-out` }
      : { ...none, clockOut: only, status: "missing_in", reason: `Clocked out at ${minutesToLabel(mins)}, no clock-in` };
  }

  const clockIn = counted[0];
  const clockOut = counted[counted.length - 1];
  // Only time inside the session counts: arriving early or staying late adds nothing.
  const sessionStart = zonedTimeToDate(night, settings.session_start, settings.timezone);
  const sessionEnd = zonedTimeToDate(night, settings.session_end, settings.timezone);
  const from = Math.max(clockIn.getTime(), sessionStart.getTime());
  const to = Math.min(clockOut.getTime(), sessionEnd.getTime());
  const minutes = Math.max(0, Math.floor((to - from) / 60000));
  const inLabel = minutesToLabel(localParts(clockIn, settings.timezone).minutes);
  const outLabel = minutesToLabel(localParts(clockOut, settings.timezone).minutes);

  if (minutes >= settings.required_minutes) {
    return { status: "paid", clockIn, clockOut, minutes, rate, amount: rate, reason: `${inLabel}–${outLabel}` };
  }
  return {
    status: "short",
    clockIn,
    clockOut,
    minutes,
    rate,
    amount: 0,
    reason: `Only ${minutes} min in session (${inLabel}–${outLabel}); ${settings.required_minutes} required`,
  };
}

/** "YYYY-MM-DD" + "HH:MM" in a time zone → the exact instant. */
export function zonedTimeToDate(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Find the zone's offset at that moment, then correct (twice handles DST edges).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timeZone);
    const [py, pm, pd] = p.date.split("-").map(Number);
    const shown = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

export const STATUS_LABEL: Record<NightStatus, string> = {
  paid: "Paid",
  short: "Short",
  absent: "Absent",
  missing_in: "No clock-in",
  missing_out: "No clock-out",
  test: "Test",
};

/**
 * Which test does a claim on `night` count for? The latest test on or before that night,
 * if the night is within `claimDays` after it. Null if no test is open for claims.
 */
export function testOpenOn(night: string, testDates: string[], claimDays: number): string | null {
  let latest: string | null = null;
  for (const t of testDates) if (t <= night && (latest === null || t > latest)) latest = t;
  return latest !== null && night <= addDays(latest, Math.max(0, claimDays)) ? latest : null;
}

/** The scanner ID used with a student's "test finger": 9 followed by his PIN. */
export function testPinFor(pin: string): string {
  return `9${pin}`;
}
