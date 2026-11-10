// Reading and writing the student list as a spreadsheet.

import ExcelJS from "exceljs";
import { choosePin, digitsOnly } from "./rules";

export const COLUMNS = [
  { key: "first_name", header: "First name", width: 16 },
  { key: "last_name", header: "Last name", width: 16 },
  { key: "phone", header: "Phone", width: 16 },
  { key: "email", header: "Email", width: 28 },
  { key: "address", header: "Address", width: 32 },
  { key: "father_name", header: "Father's name", width: 18 },
  { key: "father_in_law_name", header: "Father-in-law's name", width: 20 },
  { key: "start_date", header: "Start date", width: 12 },
  { key: "pin", header: "PIN", width: 8 },
  { key: "test_pin", header: "Test ID", width: 10 },
  { key: "active", header: "Active", width: 8 },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];

export interface SheetStudent {
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  father_name: string | null;
  father_in_law_name: string | null;
  start_date: string | null;
  pin: string | null;
  active: boolean;
}

export interface ExistingStudent {
  id: string;
  phone: string;
  email: string | null;
  pin: string;
  test_pin?: string | null;
}

export interface ImportPlanRow {
  line: number; // spreadsheet row number
  action: "add" | "update" | "error";
  id?: string;
  data?: SheetStudent & { pin: string };
  name: string;
  message: string;
}

// Header text → column key (case-insensitive, ignores punctuation).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const ALIASES: Record<string, ColumnKey> = {
  firstname: "first_name", first: "first_name", name: "first_name",
  lastname: "last_name", last: "last_name", surname: "last_name", familyname: "last_name",
  phone: "phone", phonenumber: "phone", cell: "phone", mobile: "phone", tel: "phone",
  email: "email", emailaddress: "email",
  address: "address",
  fathersname: "father_name", father: "father_name", fathername: "father_name",
  fatherinlawsname: "father_in_law_name", fatherinlaw: "father_in_law_name", fatherinlawname: "father_in_law_name", shver: "father_in_law_name",
  startdate: "start_date", start: "start_date",
  pin: "pin", userid: "pin", testid: "test_pin",
  active: "active",
};

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return cellText(o.result);
  }
  return String(v).trim();
}

function toDate(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

/** Rows as arrays of cell values (first row = headers) → students + per-row problems. */
export function parseRows(rows: unknown[][]): { students: { line: number; s: SheetStudent | null; error?: string }[]; missingColumns: string[] } {
  const header = (rows[0] ?? []).map((h) => ALIASES[norm(cellText(h))] ?? null);
  const missingColumns = (["first_name", "last_name", "phone"] as const)
    .filter((k) => !header.includes(k))
    .map((k) => COLUMNS.find((c) => c.key === k)!.header);
  const out: { line: number; s: SheetStudent | null; error?: string }[] = [];
  if (missingColumns.length) return { students: out, missingColumns };

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const get = (k: ColumnKey) => {
      const idx = header.indexOf(k);
      return idx >= 0 ? cellText(row[idx]) : "";
    };
    if (COLUMNS.every((c) => !get(c.key))) return; // empty row

    const s: SheetStudent = {
      first_name: get("first_name"),
      last_name: get("last_name"),
      phone: get("phone"),
      email: get("email").toLowerCase() || null,
      address: get("address") || null,
      father_name: get("father_name") || null,
      father_in_law_name: get("father_in_law_name") || null,
      start_date: toDate(get("start_date")),
      pin: digitsOnly(get("pin")).replace(/^0+(?=\d)/, "") || null,
      active: !/^(no|n|false|0|inactive)$/i.test(get("active")),
    };
    let error: string | undefined;
    if (!s.first_name || !s.last_name) error = "Missing first or last name";
    else if (digitsOnly(s.phone).length < 4) error = "Phone number is missing or too short";
    else if (s.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) error = "Email doesn't look right";
    else if (get("start_date") && !s.start_date) error = "Start date should look like 2026-11-03 or 11/3/2026";
    else if (s.pin && !/^[1-9]\d{2,9}$/.test(s.pin)) error = "PIN must be 3 or more digits";
    out.push({ line, s: error ? null : s, error });
  });
  return { students: out, missingColumns };
}

/**
 * Decide what happens to each row: a student with the same phone (or email) is updated,
 * anyone else is added with a PIN from their phone.
 */
export function planImport(parsed: { line: number; s: SheetStudent | null; error?: string }[], existing: ExistingStudent[]): ImportPlanRow[] {
  const byPhone = new Map(existing.map((e) => [digitsOnly(e.phone), e]));
  const byEmail = new Map(existing.filter((e) => e.email).map((e) => [e.email!.toLowerCase(), e]));
  const taken = new Set(existing.flatMap((e) => [e.pin, e.test_pin ?? `9${e.pin}`]));
  const seenPhones = new Set<string>();
  const plan: ImportPlanRow[] = [];

  for (const { line, s, error } of parsed) {
    if (!s) {
      plan.push({ line, action: "error", name: "", message: error ?? "Can't read this row" });
      continue;
    }
    const name = `${s.first_name} ${s.last_name}`;
    const phone = digitsOnly(s.phone);
    if (seenPhones.has(phone)) {
      plan.push({ line, action: "error", name, message: "Same phone as an earlier row in this file" });
      continue;
    }
    seenPhones.add(phone);

    const match = byPhone.get(phone) ?? (s.email ? byEmail.get(s.email) : undefined);
    if (match) {
      let pin = match.pin;
      if (s.pin && s.pin !== match.pin) {
        if (taken.has(s.pin)) {
          plan.push({ line, action: "error", name, message: `PIN ${s.pin} already belongs to another student` });
          continue;
        }
        taken.delete(match.pin);
        taken.add(s.pin);
        pin = s.pin;
      }
      plan.push({ line, action: "update", id: match.id, data: { ...s, pin }, name, message: pin !== match.pin ? `Update (PIN changes to ${pin})` : "Update" });
      continue;
    }

    let pin: string;
    if (s.pin) {
      if (taken.has(s.pin)) {
        plan.push({ line, action: "error", name, message: `PIN ${s.pin} already belongs to another student` });
        continue;
      }
      pin = s.pin;
    } else {
      let chosen = choosePin(phone, taken);
      while (taken.has(`9${chosen.pin}`)) {
        taken.add(chosen.pin);
        chosen = choosePin(phone, taken);
      }
      pin = chosen.pin;
    }
    taken.add(pin);
    taken.add(`9${pin}`);
    plan.push({ line, action: "add", data: { ...s, pin }, name, message: pin.length > 4 ? `Add (PIN ${pin}, 5 digits because the last 4 were taken)` : `Add (PIN ${pin})` });
  }
  return plan;
}

/** Read the first worksheet of an .xlsx file, or a .csv file, into rows. */
export async function readSpreadsheet(file: File): Promise<unknown[][]> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".csv")) return parseCsv(buf.toString("utf8").replace(/^﻿/, ""));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1)); // ExcelJS rows are 1-based
  });
  return rows;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Build an .xlsx of students (or an empty template when `students` is empty). */
export async function buildWorkbook(students: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Students");
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const s of students) {
    ws.addRow({ ...s, active: s.active === false ? "No" : "Yes" });
  }
  ws.getColumn("phone").numFmt = "@";
  ws.getColumn("pin").numFmt = "@";
  return Buffer.from(await wb.xlsx.writeBuffer());
}
