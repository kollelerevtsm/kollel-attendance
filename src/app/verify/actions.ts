"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_ATTEMPTS, markVerified } from "@/lib/twoStep";

// The code is sent and checked by Supabase (its "Magic Link" email, which includes {{ .Token }}),
// using the Gmail account already connected to Supabase. No extra email setup is needed.

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login");
  return data.user;
}

/** Email a code, unless one was sent in the last minute (or, when not forced, in the last 10 minutes). Returns an error or null. */
export async function sendCodeTo(userId: string, email: string, force: boolean): Promise<string | null> {
  const admin = createAdminClient();
  const { data: last } = await admin.from("mfa_codes").select("sent_at").eq("user_id", userId).maybeSingle();
  const age = last ? Date.now() - Date.parse(last.sent_at) : Infinity;
  if (age < 60_000) return force ? "A code was just sent. Please wait a minute before asking again." : null;
  if (!force && age < 10 * 60_000) return null;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    return /rate|seconds/i.test(error.message) ? "Please wait a minute before asking for another code." : `Couldn't send the code: ${error.message}`;
  }
  await admin.from("mfa_codes").upsert({
    user_id: userId,
    code_hash: "supabase",
    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    sent_at: new Date().toISOString(),
    attempts: 0,
  });
  return null;
}

export async function resendCode() {
  const user = await currentUser();
  const err = await sendCodeTo(user.id, user.email!, true);
  redirect(err ? `/verify?error=${encodeURIComponent(err)}` : "/verify?resent=1");
}

export async function verifyCode(formData: FormData) {
  const user = await currentUser();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const remember = formData.get("remember") === "on";
  const fail = (msg: string) => redirect(`/verify?error=${encodeURIComponent(msg)}`);

  const admin = createAdminClient();
  const { data: row } = await admin.from("mfa_codes").select("attempts").eq("user_id", user.id).maybeSingle();
  if ((row?.attempts ?? 0) >= MAX_ATTEMPTS) fail("Too many wrong tries. Click “Send a new code”.");
  if (code.length < 6) fail("Enter the code from the email.");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: user.email!, token: code, type: "email" });
  if (error) {
    await admin.from("mfa_codes").update({ attempts: (row?.attempts ?? 0) + 1 }).eq("user_id", user.id);
    fail(/expired/i.test(error.message)
      ? "That code has expired. Click “Send a new code”."
      : `That code isn't right. ${Math.max(0, MAX_ATTEMPTS - (row?.attempts ?? 0) - 1)} tries left.`);
  }
  await admin.from("mfa_codes").delete().eq("user_id", user.id);
  await markVerified(user.id, remember);
  redirect("/");
}
