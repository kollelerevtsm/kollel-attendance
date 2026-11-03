import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { setPassword, signOut } from "../login/actions";

export default async function SetPasswordPage({ searchParams }: PageProps<"/set-password">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const sp = await searchParams;
  const changing = data.user.user_metadata?.password_set === true;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">{changing ? "Change your password" : "Create your password"}</h1>
        <p className="mb-5 text-sm text-gray-600">
          For <strong>{data.user.email}</strong>. At least 8 characters, with a letter and a number. You&apos;ll use it to sign in from now on.
        </p>
        <Notice error={typeof sp.error === "string" ? sp.error : undefined} />
        <form action={setPassword} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Type it again</label>
            <input className="input" id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <button className="btn w-full" type="submit">Save password</button>
        </form>
        <form action={signOut} className="mt-4 text-center">
          <button className="text-sm text-gray-500 underline" type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
