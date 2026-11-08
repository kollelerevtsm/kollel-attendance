import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { crossChexRows, buildCrossChexWorkbook, CROSSCHEX_COLUMNS } from "./crosschexSheet";

const s = { first_name: "וואלווי", last_name: "ווייסבערג", pin: "3869", test_pin: null, phone: "718-555-3869", start_date: "2026-11-01" };

describe("CrossChex export", () => {
  it("makes a regular and a test employee per student", () => {
    const rows = crossChexRows([s]);
    expect(rows.map((r) => [r.workNo, r.first, r.last])).toEqual([["3869", "וואלווי", "ווייסבערג"], ["93869", "בחינה וואלווי", "ווייסבערג"]]);
  });

  it("matches the CrossChex template columns", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildCrossChexWorkbook([{ ...s, test_pin: "93870" }], "Kollel") as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual([...CROSSCHEX_COLUMNS]);
    expect(ws.getRow(3).getCell(3).value).toBe("93870");
    expect(ws.getRow(3).getCell(4).value).toBe("Kollel");
    expect(ws.getRow(3).getCell(9).value).toBe("93870");
    expect(ws.rowCount).toBe(3);
  });
});
