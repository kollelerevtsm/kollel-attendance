import ExcelJS from "exceljs";
import { testPinFor } from "./rules";

/** Columns of CrossChex Cloud's employee import template (Organization → Employee → Import → employee.xlsx). */
export const CROSSCHEX_COLUMNS = [
  "First Name", "*Last Name", "*Work NO.", "Department", "Position", "Hire Date", "Email", "Tel", "Att Password", "Card ID",
] as const;

export interface CrossChexStudent {
  first_name: string;
  last_name: string;
  pin: string;
  test_pin?: string | null;
  phone?: string | null;
  start_date?: string | null;
}

export interface CrossChexRow {
  first: string;
  last: string;
  workNo: string;
  position: string;
  hireDate: string | null;
  tel: string;
}

/** Two CrossChex employees per student: his regular ID and his test ID (enrolled with a different finger). */
export function crossChexRows(students: CrossChexStudent[]): CrossChexRow[] {
  const rows: CrossChexRow[] = [];
  for (const s of students) {
    const base = { first: s.first_name ?? "", hireDate: s.start_date ?? null, tel: s.phone ?? "" };
    rows.push({ ...base, last: s.last_name, workNo: s.pin, position: "Regular" });
    rows.push({ ...base, last: `${s.last_name} TEST`, workNo: s.test_pin || testPinFor(s.pin), position: "Test finger" });
  }
  return rows;
}

export async function buildCrossChexWorkbook(students: CrossChexStudent[], department: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow([...CROSSCHEX_COLUMNS]).font = { bold: true };
  for (const r of crossChexRows(students)) {
    ws.addRow([
      r.first, r.last, r.workNo, department, r.position,
      r.hireDate ? new Date(`${r.hireDate}T00:00:00Z`) : null,
      null, r.tel, null, null,
    ]);
  }
  ws.getColumn(3).numFmt = "@";
  ws.getColumn(6).numFmt = "yyyy-mm-dd";
  [14, 22, 12, 16, 14, 14, 24, 16, 14, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
