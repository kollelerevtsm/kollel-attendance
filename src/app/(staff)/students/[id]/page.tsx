import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, STAFF, MANAGERS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice, PageTitle } from "@/components/Notice";
import { StudentForm, type StudentRow } from "../StudentForm";
import { updateStudent } from "../actions";

export default async function StudentPage({ params, searchParams }: PageProps<"/students/[id]">) {
  const me = await requireRole(...STAFF);
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = data as StudentRow;

  return (
    <>
      <PageTitle title={`${s.first_name} ${s.last_name}`}>
        <Link className="btn-secondary" href="/students">Back</Link>
      </PageTitle>
      <Notice
        error={typeof sp.error === "string" ? sp.error : undefined}
        message={typeof sp.message === "string" ? sp.message : undefined}
      />
      <StudentForm student={s} action={updateStudent} canEdit={MANAGERS.includes(me.role)} />
    </>
  );
}
