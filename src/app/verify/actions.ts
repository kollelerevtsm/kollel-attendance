"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail";
import { CODE_MINUTES, MAX_ATTEMPTS, hashCode, markVerified, newCode } from "@/lib/twoStep";

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login");
  return data.user;
}

/** Email a fresh code, unless one was sent less than a minute ago (unless forced). Returns an error message or null. */
export async function sendCodeTo(userId: string, email: string, force: boolean): Promise<string | null> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("mfa_codes").select("sent_at,expires_at").eq("user_id", userId).maybeSingle();
  const recent = existing && Date.now() - Date.parse(existing.sent_at) < 60_000;
  const valid = existing && Date.parse(existing.expires_at) > Date.now();
  if (recent || (!force && valid)) return recent && force ? "A code was just sent. Please wait a minute before asking again." : null;

  const code = newCode();
  await admin.from("mfa_codes").upsert({
    user_id: userId,
    code_hash: hashCode(userId, code),
    expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
    sent_at: new Date().toISOString(),
    attempts: 0,
  });
  try {
    await sendMail(
      email,
      `Your sign-in code: ${code}`,
      `Your Kollel Erev sign-in code is ${code}. It expires in ${CODE_MINUTES} minutes. If you didn't try to sign in, change your password.`,
      `<p>Your Kollel Erev sign-in code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in ${CODE_MINUTES} minutes. If you didn't try to sign in, change your password.</p>`,
    );
  } catch (e) {
    return (e as Error).message;
  }
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
  const { data: row } = await admin.from("mfa_codes").select("*").eq("user_id", user.id).maybeSingle();
  if (!row || Date.parse(row.expires_at) < Date.now()) fail("That code has expired. Click “Send a new code”.");
  if (row!.attempts >= MAX_ATTEMPTS) fail("Too many wrong tries. Click “Send a new code”.");
  if (code.length !== 6 || hashCode(user.id, code) !== row!.code_hash) {
    await admin.from("mfa_codes").update({ attempts: row!.attempts + 1 }).eq("user_id", user.id);
    fail(`That code isn't right. ${Math.max(0, MAX_ATTEMPTS - row!.attempts - 1)} tries left.`);
  }
  await admin.from("mfa_codes").delete().eq("user_id", user.id);
  await markVerified(user.id, remember);
  redirect("/");
}
