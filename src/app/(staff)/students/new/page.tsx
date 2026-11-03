import Link from "next/link";
import { requireRole, MANAGERS } from "@/lib/auth";
import { Notice, PageTitle } from "@/components/Notice";
import { StudentForm } from "../StudentForm";
import { createStudent } from "../actions";

export default async function NewStudent({ searchParams }: PageProps<"/students/new">) {
  await requireRole(...MANAGERS);
  const sp = await searchParams;
  return (
    <>
      <PageTitle title="Add student"><Link className="btn-secondary" href="/students">Back</Link></PageTitle>
      <Notice error={typeof sp.error === "string" ? sp.error : undefined} />
      <StudentForm action={createStudent} canEdit />
    </>
  );
}
