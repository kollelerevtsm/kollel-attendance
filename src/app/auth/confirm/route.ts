import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { markVerified } from "@/lib/twoStep";

// The sign-in link from the email lands here.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let error: { message: string } | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = { message: "The sign-in link is incomplete." };
  }

  // Clicking the emailed link proves they have the email, so it counts as the second step for this visit.
  if (!error) {
    const { data } = await supabase.auth.getUser();
    if (data.user) await markVerified(data.user.id, false);
  }

  const dest = new URL(error ? `/login?error=${encodeURIComponent("That link expired or was already used. Please request a new one.")}` : "/", url.origin);
  return NextResponse.redirect(dest);
}
