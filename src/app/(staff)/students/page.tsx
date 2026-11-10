import Link from "next/link";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice, PageTitle } from "@/components/Notice";
import type { StudentRow } from "./StudentForm";
import { StudentTable } from "./StudentTable";

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
          <a className="btn-secondary" href="/api/students/crosschex" title="Upload in CrossChex Cloud: Organization → Employee → Import. Two employees per student: regular ID and test ID (name starts with בחינה).">Export for CrossChex</a>
          {MANAGERS.includes(me.role) && <Link className="btn-secondary" href="/students/import">Import from Excel</Link>}
          {MANAGERS.includes(me.role) && <Link className="btn" href="/students/new">Add student</Link>}
        </div>
      </PageTitle>
      <Notice message={typeof sp.message === "string" ? sp.message : undefined} />
      <StudentTable students={students} />
    </>
  );
}
