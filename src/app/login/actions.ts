"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const back = (mode: string, params: Record<string, string>) =>
  redirect(`/login?${new URLSearchParams({ ...(mode ? { mode } : {}), ...params }).toString()}`);

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) back("", { error: "Enter your email and password." });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    back("", {
      error: /invalid/i.test(error.message)
        ? "Wrong email or password. First time here, or forgot your password? Use the links below."
        : error.message,
      email,
    });
  }
  redirect("/");
}

/**
 * Sends a sign-in link by email. Used for:
 *  - "first"  — first time: verifies the email, then asks them to create a password
 *  - "forgot" — forgot password: after the link, asks them to choose a new password
 */
export async function sendEmailLink(formData: FormData) {
  const mode = String(formData.get("mode") ?? "first") === "forgot" ? "forgot" : "first";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back(mode, { error: "Enter a valid email." });

  if (mode === "forgot") {
    // Make sure they're asked for a new password after clicking the link.
    try {
      const admin = createAdminClient();
      const { data: p } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (p) await admin.auth.admin.updateUserById(p.id, { user_metadata: { password_set: false } });
    } catch {
      // If the server key is missing, they can still sign in with the link and change the password from the menu.
    }
  }

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) back(mode, { error: /rate|seconds/i.test(error.message) ? "Please wait a minute before asking for another email." : error.message });
  back(mode, { sent: "1", email });
}

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fail = (msg: string) => redirect(`/set-password?error=${encodeURIComponent(msg)}`);
  if (password.length < 8) fail("Use at least 8 characters.");
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) fail("Use at least one letter and one number.");
  if (password !== confirm) fail("The two passwords don't match.");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
  if (error) {
    fail(/same|different/i.test(error.message) ? "Choose a password different from your old one." : error.message);
  }
  redirect("/?welcome=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
