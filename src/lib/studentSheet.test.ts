import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, parseCsv, parseRows, planImport } from "./studentSheet";

describe("student import", () => {
  const rows = [
    ["First Name", "Last Name", "Phone Number", "E-mail", "Father's Name", "Father in law", "PIN"],
    ["Moshe", "Cohen", "718-555-1234", "MOSHE@x.com", "Avraham", "Yaakov", ""],
    ["Dovid", "Levi", "(917) 555-1234", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["Yossi", "", "555-0000", "", "", "", ""],
    ["Shmuel", "Katz", "646-555-7777", "", "", "", "4444"],
  ];

  it("reads flexible headers and flags bad rows", () => {
    const { students, missingColumns } = parseRows(rows);
    expect(missingColumns).toEqual([]);
    expect(students).toHaveLength(4);
    expect(students[0].s?.email).toBe("moshe@x.com");
    expect(students[0].s?.father_in_law_name).toBe("Yaakov");
    expect(students[2].error).toMatch(/name/);
  });

  it("adds new students, updates matches by phone, and avoids PIN clashes", () => {
    const { students } = parseRows(rows);
    const plan = planImport(students, [{ id: "x", phone: "7185551234", email: null, pin: "1234" }]);
    expect(plan.map((p) => [p.action, p.data?.pin])).toEqual([
      ["update", "1234"],
      ["add", "51234"],
      ["error", undefined],
      ["add", "4444"],
    ]);
  });

  it("reports missing required columns", () => {
    expect(parseRows([["Name", "Email"]]).missingColumns).toEqual(["Last name", "Phone"]);
  });

  it("parses CSV with quotes", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });

  it("writes an Excel file that reads back", async () => {
    const buf = await buildWorkbook([{ first_name: "Moshe", last_name: "Cohen", phone: "718-555-1234", pin: "1234", active: true }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const values = wb.worksheets[0].getRow(2).values as unknown[];
    expect(values.slice(1, 4)).toEqual(["Moshe", "Cohen", "718-555-1234"]);
  });
});
