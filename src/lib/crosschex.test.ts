import { describe, expect, it } from "vitest";
import { extractScans, verifyMethod } from "./crosschex";

const rec = (over: object = {}) => ({
  uuid: "abc", checktype: 192, checktime: "2026-11-10T01:28:00+00:00",
  device: { serial_number: "123", name: "W1 Pro" },
  employee: { first_name: "Moshe", last_name: "Cohen", workno: "1234" }, ...over,
});

describe("crosschex records", () => {
  it("reads an API response page", () => {
    const scans = extractScans({ header: {}, payload: { count: 2, list: [rec(), rec({ uuid: "def", checktype: 1, employee: { workno: "00005678" } })] } });
    expect(scans.map((s) => [s.external_id, s.user_pin, s.verify_method, s.scanned_at])).toEqual([
      ["abc", "1234", "fingerprint", "2026-11-10T01:28:00.000Z"],
      ["def", "5678", "pin", "2026-11-10T01:28:00.000Z"],
    ]);
  });
  it("reads a webhook with a single record", () => {
    expect(extractScans({ header: { nameSpace: "attendance.record" }, payload: rec() })).toHaveLength(1);
    expect(extractScans(rec())).toHaveLength(1);
    expect(extractScans({ payload: { something: "else" } })).toHaveLength(0);
  });
  it("maps check types", () => {
    expect(verifyMethod(1)).toBe("pin");
    expect(verifyMethod(56)).toBe("card");
    expect(verifyMethod(6)).toBe("code 6");
  });
});
