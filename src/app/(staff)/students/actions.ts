"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { choosePin, testPinFor } from "@/lib/rules";

function fields(formData: FormData) {
  const s = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  return {
    first_name: s("first_name"),
    last_name: s("last_name"),
    phone: s("phone"),
    email: s("email")?.toLowerCase() ?? null,
    address: s("address"),
    father_name: s("father_name"),
    father_in_law_name: s("father_in_law_name"),
    start_date: s("start_date") ?? undefined,
    fingerprint_enrolled: formData.get("fingerprint_enrolled") === "on",
    active: formData.get("active") === "on",
  };
}

const back = (path: string, error: string) => redirect(`${path}?error=${encodeURIComponent(error)}`);

function friendly(message: string) {
  if (message.includes("students_email_unique")) return "Another student already uses this email.";
  if (message.includes("students_pin_key")) return "Another student already has this PIN.";
  if (message.includes("students_test_pin_key")) return "Another student already has this test ID.";
  return message;
}

export async function createStudent(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const supabase = await createClient();
  const f = fields(formData);
  if (!f.first_name || !f.last_name || !f.phone) back("/students/new", "First name, last name and phone are required.");

  const { data: pins } = await supabase.from("students").select("pin,test_pin");
  const taken = new Set<string>();
  for (const p of pins ?? []) {
    taken.add(p.pin);
    if (p.test_pin) taken.add(p.test_pin);
  }
  let pin: { pin: string; extended: boolean };
  try {
    pin = choosePin(f.phone!, taken);
    while (taken.has(testPinFor(pin.pin))) {
      taken.add(pin.pin);
      pin = choosePin(f.phone!, taken);
    }
  } catch (e) {
    return back("/students/new", (e as Error).message);
  }

  const { data, error } = await supabase
    .from("students")
    .insert({ ...f, active: true, pin: pin.pin, test_pin: testPinFor(pin.pin) })
    .select("id")
    .single();
  if (error) back("/students/new", friendly(error.message));

  await supabase.from("audit_log").insert({ user_id: me.id, action: "student.create", details: { id: data!.id, pin: pin.pin } });
  revalidatePath("/students");
  const msg = pin.extended
    ? `Student added. The last 4 digits were already taken, so this student's PIN is ${pin.pin} (5 digits). Test ID: ${testPinFor(pin.pin)}.`
    : `Student added with PIN ${pin.pin} and test ID ${testPinFor(pin.pin)}.`;
  redirect(`/students?message=${encodeURIComponent(msg)}`);
}

export async function updateStudent(formData: FormData) {
  const me = await requireRole(...MANAGERS);
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const f = fields(formData);
  const pin = String(formData.get("pin") ?? "").trim();
  const testPin = String(formData.get("test_pin") ?? "").trim();
  const path = `/students/${id}`;
  if (!f.first_name || !f.last_name || !f.phone) back(path, "First name, last name and phone are required.");
  if (!/^[0-9]{4,10}$/.test(pin)) back(path, "PIN must be 4 or more digits.");
  if (!/^[0-9]{4,12}$/.test(testPin)) back(path, "Test ID must be 4 or more digits.");
  if (testPin === pin) back(path, "The test ID must be different from the PIN.");
  {
    const sb = await createClient();
    const { data: clash } = await sb.from("students").select("id").neq("id", id).or(`pin.eq.${pin},test_pin.eq.${pin},pin.eq.${testPin},test_pin.eq.${testPin}`);
    if (clash && clash.length) back(path, "That PIN or test ID is already used by another student.");
  }

  const { error } = await supabase.from("students").update({ ...f, pin, test_pin: testPin }).eq("id", id);
  if (error) back(path, friendly(error.message));

  await supabase.from("audit_log").insert({ user_id: me.id, action: "student.update", details: { id } });
  revalidatePath("/students");
  redirect(`${path}?message=${encodeURIComponent("Saved.")}`);
}
