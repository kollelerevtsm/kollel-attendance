import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice, PageTitle } from "@/components/Notice";
import { inviteStaff, removeStaff } from "./actions";

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: invites } = await supabase.from("staff_invites").select("*").order("role").order("email");

  return (
    <>
      <PageTitle title="Staff logins" />
      <Notice
        error={typeof sp.error === "string" ? sp.error : undefined}
        message={typeof sp.message === "string" ? sp.message : undefined}
      />
      <p className="mb-4 text-sm text-gray-600">
        Staff sign in with a link sent to their email. Students sign in with the email on their student record, so they don&apos;t need to be added here.
      </p>
      <form action={inviteStaff} autoComplete="off" className="card mb-6 grid gap-4 md:grid-cols-4 md:items-end">
        <div>
          <label className="label" htmlFor="full_name">Name</label>
          <input className="input" id="full_name" name="full_name" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select className="input" id="role" name="role" defaultValue="principal">
            <option value="principal">Principal</option>
            <option value="payroll">Payroll</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="btn" type="submit">Add</button>
      </form>
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th><th /></tr>
          </thead>
          <tbody>
            {(invites ?? []).map((i) => (
              <tr key={i.email} className="border-b last:border-0">
                <td className="px-4 py-2">{i.full_name}</td>
                <td className="px-4 py-2">{i.email}</td>
                <td className="px-4 py-2 capitalize">{i.role}</td>
                <td className="px-4 py-2 text-right">
                  {i.email !== me.email && (
                    <form action={removeStaff}>
                      <input type="hidden" name="email" value={i.email} />
                      <button className="text-xs text-red-700 underline" type="submit">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
