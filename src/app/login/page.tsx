import { Notice } from "@/components/Notice";
import { sendLoginLink } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-center text-xl font-semibold" dir="rtl">כולל ערב תורתך שעשועי</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Attendance &amp; Payroll</p>
        <Notice error={error} message={sent ? "Check your email for a sign-in link." : undefined} />
        <form action={sendLoginLink} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <button className="btn w-full" type="submit">Email me a sign-in link</button>
        </form>
      </div>
    </main>
  );
}
