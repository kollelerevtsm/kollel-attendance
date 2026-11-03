import { describe, expect, it } from "vitest";
import { choosePin, computeNight, isSessionNight, testRateApplies, type Settings } from "./rules";
import { nightsInfo } from "./hebrew";

const settings: Settings = {
  session_start: "20:30",
  session_end: "21:30",
  clock_in_opens: "19:30",
  clock_out_closes: "22:00",
  required_minutes: 60,
  base_rate: 15,
  test_rate: 20,
  pay_period: "monthly",
  session_weekdays: [0, 1, 2, 3, 4],
  timezone: "America/New_York",
};

// Nov 2026 is EST (UTC-5): 8:30pm local = 01:30Z next day
const at = (iso: string) => new Date(iso);

describe("choosePin", () => {
  it("uses the last 4 digits", () => {
    expect(choosePin("(718) 555-1234", [])).toEqual({ pin: "1234", extended: false });
  });
  it("uses 5 digits when the last 4 are taken", () => {
    expect(choosePin("917-555-1234", ["1234"])).toEqual({ pin: "51234", extended: true });
  });
  it("rejects short phone numbers", () => {
    expect(() => choosePin("12", [])).toThrow();
  });
});

describe("isSessionNight", () => {
  it("Sunday–Thursday are on by default", () => {
    expect(isSessionNight("2026-11-08", [0, 1, 2, 3, 4], null, false)).toBe(true); // Sunday
    expect(isSessionNight("2026-11-13", [0, 1, 2, 3, 4], null, false)).toBe(false); // Friday
  });
  it("holiday suggestion turns a night off, principal's choice wins", () => {
    expect(isSessionNight("2026-11-08", [0, 1, 2, 3, 4], null, true)).toBe(false);
    expect(isSessionNight("2026-11-08", [0, 1, 2, 3, 4], true, true)).toBe(true);
    expect(isSessionNight("2026-11-08", [0, 1, 2, 3, 4], false, false)).toBe(false);
  });
});

describe("testRateApplies", () => {
  const tests = ["2026-11-10", "2026-12-08"];
  it("applies from the test until the night before the next test", () => {
    const took = new Set(["2026-11-10"]);
    expect(testRateApplies("2026-11-09", tests, took)).toBe(false);
    expect(testRateApplies("2026-11-10", tests, took)).toBe(true);
    expect(testRateApplies("2026-12-07", tests, took)).toBe(true);
    expect(testRateApplies("2026-12-08", tests, took)).toBe(false);
  });
  it("does not apply to a student who skipped the test", () => {
    expect(testRateApplies("2026-11-20", tests, new Set())).toBe(false);
  });
});

describe("computeNight", () => {
  const base = { night: "2026-11-09", settings, tookTestTonight: false, testRateActive: false };

  it("pays a full hour", () => {
    const r = computeNight({ ...base, scans: [at("2026-11-10T01:28:00Z"), at("2026-11-10T02:31:00Z")] });
    expect(r.status).toBe("paid");
    expect(r.minutes).toBe(63);
    expect(r.amount).toBe(15);
  });

  it("pays the test rate when active", () => {
    const r = computeNight({ ...base, testRateActive: true, scans: [at("2026-11-10T01:28:00Z"), at("2026-11-10T02:31:00Z")] });
    expect(r.amount).toBe(20);
  });

  it("pays nothing when short", () => {
    const r = computeNight({ ...base, scans: [at("2026-11-10T01:30:00Z"), at("2026-11-10T02:12:00Z")] });
    expect(r.status).toBe("short");
    expect(r.amount).toBe(0);
    expect(r.reason).toContain("9:12pm");
  });

  it("flags a missing clock-out", () => {
    const r = computeNight({ ...base, scans: [at("2026-11-10T01:30:00Z")] });
    expect(r.status).toBe("missing_out");
  });

  it("ignores scans outside 7:30–10:00pm", () => {
    const r = computeNight({ ...base, scans: [at("2026-11-10T00:10:00Z"), at("2026-11-10T03:30:00Z")] });
    expect(r.status).toBe("absent");
  });

  it("pays test takers on test night without scans", () => {
    const r = computeNight({ ...base, scans: [], tookTestTonight: true });
    expect(r.status).toBe("test");
    expect(r.amount).toBe(20);
  });
});

describe("nightsInfo", () => {
  it("suggests the night before Yom Kippur off and gives the Hebrew date", () => {
    const info = nightsInfo("2026-09-20", "2026-09-22");
    expect(info.get("2026-09-20")!.suggestedOff).toBe(true); // Kol Nidrei night
    expect(info.get("2026-09-21")!.suggestedOff).toBe(false);
    expect(info.get("2026-09-20")!.hebrewDate).toContain("תשרי");
  });
});
