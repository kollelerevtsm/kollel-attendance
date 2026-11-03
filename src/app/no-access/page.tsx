import { signOut } from "../login/actions";

export default function NoAccess() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card max-w-md text-center">
        <h1 className="mb-2 text-xl font-semibold">No access yet</h1>
        <p className="mb-6 text-sm text-gray-600">
          This email isn&apos;t set up in the system. Ask the office to add you as staff, or to add this email to your student record.
        </p>
        <form action={signOut}>
          <button className="btn-secondary" type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
