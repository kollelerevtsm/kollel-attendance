"use server";

import { revalidatePath } from "next/cache";
import { requireRole, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseRows, planImport, readSpreadsheet, type ImportPlanRow, type SheetStudent } from "@/lib/studentSheet";

export interface PreviewState {
  error?: string;
  plan?: ImportPlanRow[];
  payload?: string; // the parsed rows, sent back on confirm
  done?: string;
}

async function existingStudents() {
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("id,phone,email,pin,test_pin");
  return data ?? [];
}

export async function previewImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  await requireRole(...MANAGERS);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel (.xlsx) or CSV file." };
  if (file.size > 2_000_000) return { error: "That file is too large." };
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
    return { error: "Please save the file as .xlsx (Excel) or .csv. Older .xls files aren't supported." };
  }

  let rows: unknown[][];
  try {
    rows = await readSpreadsheet(file);
  } catch {
    return { error: "Couldn't read that file. Make sure it's an Excel .xlsx or .csv file." };
  }
  const { students, missingColumns } = parseRows(rows);
  if (missingColumns.length) {
    return { error: `The first row must have column headings. Missing: ${missingColumns.join(", ")}. Download the template to see the layout.` };
  }
  if (students.length === 0) return { error: "No students found in the file." };

  const plan = planImport(students, await existingStudents());
  return { plan, payload: JSON.stringify(students) };
}

export async function applyImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const me = await requireRole(...MANAGERS);
  let parsed: { line: number; s: SheetStudent | null; error?: string }[];
  try {
    parsed = JSON.parse(String(formData.get("payload")));
  } catch {
    return { error: "Something went wrong. Please upload the file again." };
  }
  // Plan again against the current list, in case it changed since the preview.
  const plan = planImport(parsed, await existingStudents());
  const supabase = await createClient();
  let added = 0, updated = 0;
  const failed: string[] = [];

  for (const row of plan) {
    if (row.action === "error" || !row.data) continue;
    const { start_date, ...rest } = row.data;
    const values = { ...rest, ...(start_date ? { start_date } : {}), ...(row.action === "add" ? { test_pin: `9${rest.pin}` } : {}) };
    const { error } = row.action === "add"
      ? await supabase.from("students").insert(values)
      : await supabase.from("students").update(values).eq("id", row.id!);
    if (error) failed.push(`Row ${row.line} (${row.name}): ${error.message.includes("email") ? "email already used by another student" : error.message}`);
    else if (row.action === "add") added++;
    else updated++;
  }

  await supabase.from("audit_log").insert({ user_id: me.id, action: "students.import", details: { added, updated, failed: failed.length } });
  revalidatePath("/students");
  const skipped = plan.filter((p) => p.action === "error").length;
  return {
    done: `Imported: ${added} added, ${updated} updated${skipped ? `, ${skipped} rows skipped` : ""}.`,
    error: failed.length ? failed.join(" · ") : undefined,
  };
}
