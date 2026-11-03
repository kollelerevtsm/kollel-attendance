"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function inviteStaff(formData: FormData) {
  const me = await requireRole("admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role"));
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  if (!email || !["admin", "principal", "payroll"].includes(role)) {
    redirect(`/staff?error=${encodeURIComponent("Enter an email and choose a role.")}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("staff_invites").upsert({ email, role, full_name });
  if (error) redirect(`/staff?error=${encodeURIComponent(error.message)}`);
  // If they already signed in before, update their existing login too.
  await supabase.from("profiles").update({ role, full_name }).eq("email", email).neq("role", "student");
  await supabase.from("audit_log").insert({ user_id: me.id, action: "staff.invite", details: { email, role } });
  revalidatePath("/staff");
  redirect(`/staff?message=${encodeURIComponent(`${email} can now sign in as ${role}.`)}`);
}

export async function removeStaff(formData: FormData) {
  const me = await requireRole("admin");
  const email = String(formData.get("email"));
  if (email === me.email) redirect(`/staff?error=${encodeURIComponent("You can't remove yourself.")}`);
  const supabase = await createClient();
  await supabase.from("staff_invites").delete().eq("email", email);
  await supabase.from("profiles").delete().eq("email", email).neq("role", "student");
  await supabase.from("audit_log").insert({ user_id: me.id, action: "staff.remove", details: { email } });
  revalidatePath("/staff");
}
