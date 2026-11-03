import Link from "next/link";
import { requireRole, MANAGERS } from "@/lib/auth";
import { PageTitle } from "@/components/Notice";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  await requireRole(...MANAGERS);
  return (
    <>
      <PageTitle title="Import students from Excel">
        <Link className="btn-secondary" href="/students">Back</Link>
      </PageTitle>
      <p className="mb-4 text-sm text-gray-600">
        The first row needs headings. Required: <strong>First name, Last name, Phone</strong>. Optional: Email, Address,
        Father&apos;s name, Father-in-law&apos;s name, Start date, PIN, Active. Leave PIN empty and it&apos;s set from the phone.
        You&apos;ll see a preview before anything is saved.
      </p>
      <ImportForm />
    </>
  );
}
