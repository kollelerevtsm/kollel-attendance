import { describe, expect, it } from "vitest";
import { assignDafim, suggestNextTest } from "./daf";
import { addDays, weekday } from "./rules";

describe("daf auto-fill", () => {
  it("one daf per night, skipping review nights, rolling into the next masechta", () => {
    const nights = ["2026-12-13", "2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17"];
    const m = assignDafim(nights, new Set(["2026-12-15"]), "eruvin", 103);
    expect([...m.entries()]).toEqual([
      ["2026-12-13", "עירובין ק״ג"],
      ["2026-12-14", "עירובין ק״ד"],
      ["2026-12-16", "עירובין ק״ה"],
      ["2026-12-17", "פסחים ב׳"],
    ]);
  });
});

describe("next test suggestion", () => {
  it("about 4 weeks later, on a Sunday that is a session night", () => {
    const on = (d: string) => weekday(d) <= 4;
    expect(suggestNextTest("2026-11-08", "2026-11-03", on, addDays, weekday)).toBe("2026-12-06");
    expect(suggestNextTest("2026-11-08", "2026-11-03", (d) => on(d) && d !== "2026-12-06", addDays, weekday)).toBe("2026-12-07");
    expect(suggestNextTest(null, "2026-11-03", on, addDays, weekday)).toBe("2026-11-08");
  });
});
