import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "admin" | "principal" | "payroll" | "student";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  student_id: string | null;
}

/** The signed-in user's profile, or null if they have no access. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  // Everyone must have created a password (after verifying their email, or after "forgot password").
  if (auth.user.user_metadata?.password_set !== true) redirect("/set-password");
  let { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (!data) {
    // Invited or added as a student after their first sign-in.
    await supabase.rpc("claim_profile");
    ({ data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle());
  }
  return (data as Profile) ?? null;
}

/** Use at the top of every page and server action. Redirects if the user isn't allowed. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/no-access");
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}

export const STAFF: Role[] = ["admin", "principal", "payroll"];
export const MANAGERS: Role[] = ["admin", "principal"];
