import { AuthShell } from "@/components/AuthShell";
import Link from "next/link";
import { Notice } from "@/components/Notice";
import { sendEmailLink, signInWithPassword } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const mode = sp.mode === "first" || sp.mode === "forgot" ? sp.mode : "signin";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const email = typeof sp.email === "string" ? sp.email : "";
  const sent = sp.sent === "1";

  return (
    <AuthShell>

        {mode === "signin" ? (
          <>
            <Notice error={error} />
            <form action={signInWithPassword} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input className="input" id="email" name="email" type="email" required autoComplete="email" defaultValue={email} />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              <button className="btn w-full" type="submit">Sign in</button>
            </form>
            <div className="mt-5 flex justify-between text-sm">
              <Link className="text-brand-700 underline" href="/login?mode=first">First time here?</Link>
              <Link className="text-brand-700 underline" href="/login?mode=forgot">Forgot password?</Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 font-semibold">{mode === "first" ? "First time here" : "Forgot password"}</h2>
            <p className="mb-4 text-sm text-gray-600">
              {mode === "first"
                ? "Enter your email. We'll send you a link to confirm it, and then you'll create your password."
                : "Enter your email. We'll send you a link, and then you'll choose a new password."}
            </p>
            <Notice error={error} message={sent ? `Check your email${email ? ` (${email})` : ""} and click the link. It may take a minute; check spam too.` : undefined} />
            <form action={sendEmailLink} className="space-y-4">
              <input type="hidden" name="mode" value={mode} />
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input className="input" id="email" name="email" type="email" required autoComplete="email" defaultValue={email} />
              </div>
              <button className="btn w-full" type="submit">{sent ? "Send again" : "Email me the link"}</button>
            </form>
            <p className="mt-5 text-center text-sm">
              <Link className="text-brand-700 underline" href="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </AuthShell>
  );
}
