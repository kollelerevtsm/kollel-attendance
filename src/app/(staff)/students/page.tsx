import Link from "next/link";
import { displayName } from "@/lib/names";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/Notice";
import type { StudentRow } from "./StudentForm";

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const me = await requireRole(...STAFF);
  const sp = await searchParams;
  const showInactive = sp.all === "1";
  const supabase = await createClient();
  let query = supabase.from("students").select("*").order("last_name").order("first_name");
  if (!showInactive) query = query.eq("active", true);
  const { data } = await query;
  const students = (data ?? []) as StudentRow[];

  return (
    <>
      <PageTitle title={`Students (${students.length})`}>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href={showInactive ? "/students" : "/students?all=1"}>
            {showInactive ? "Hide inactive" : "Show inactive"}
          </Link>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download */}
          <a className="btn-secondary" href="/students/export">Export to Excel</a>
          {MANAGERS.includes(me.role) && <Link className="btn-secondary" href="/students/import">Import from Excel</Link>}
          {MANAGERS.includes(me.role) && <Link className="btn" href="/students/new">Add student</Link>}
        </div>
      </PageTitle>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">PIN</th>
              <th className="px-4 py-2">Test ID</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Fingerprint</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link className="text-brand-700 hover:underline" href={`/students/${s.id}`} dir="auto">
                    {displayName(s.first_name, s.last_name)}
                  </Link>
                  {!s.active && <span className="ml-2 text-xs text-gray-400">inactive</span>}
                </td>
                <td className="px-4 py-2 font-mono">{s.pin}</td>
                <td className="px-4 py-2 font-mono text-gray-500">{s.test_pin ?? ""}</td>
                <td className="px-4 py-2">{s.phone}</td>
                <td className="px-4 py-2">{s.email ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-2">
                  {s.fingerprint_enrolled ? <span className="text-green-700">Enrolled</span> : <span className="text-amber-700">Not yet</span>}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No students yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
