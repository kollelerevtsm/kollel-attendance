import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isVerified, TRUST_DAYS } from "@/lib/twoStep";
import { Notice } from "@/components/Notice";
import { signOut } from "../login/actions";
import { resendCode, sendCodeTo, verifyCode } from "./actions";

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login");
  if (await isVerified(data.user.id)) redirect("/");
  const sp = await searchParams;

  // Send a code automatically when the page opens (not more than once a minute).
  const sendError = typeof sp.error === "string" ? null : await sendCodeTo(data.user.id, data.user.email, false);
  const error = typeof sp.error === "string" ? sp.error : sendError ?? undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Check your email</h1>
        <p className="mb-5 text-sm text-gray-600">
          We sent a 6-digit code to <strong>{data.user.email}</strong>. Enter it below to finish signing in.
        </p>
        <Notice error={error} message={sp.resent === "1" ? "A new code is on its way." : undefined} />
        <form action={verifyCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="code">Code</label>
            <input
              className="input text-center font-mono text-2xl tracking-[0.4em]"
              id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remember" defaultChecked />
            Remember this browser for {TRUST_DAYS} days
          </label>
          <button className="btn w-full" type="submit">Verify</button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <form action={resendCode}><button className="text-blue-700 underline" type="submit">Send a new code</button></form>
          <form action={signOut}><button className="text-gray-500 underline" type="submit">Sign out</button></form>
        </div>
        <p className="mt-4 text-xs text-gray-500">Only tick “remember” on your own computer or phone, not a shared one.</p>
      </div>
    </main>
  );
}
