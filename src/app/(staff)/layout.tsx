import Link from "next/link";
import { requireRole, STAFF, type Role } from "@/lib/auth";
import { signOut } from "../login/actions";

const NAV: { href: string; label: string; roles: Role[]; soon?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "principal", "payroll"] },
  { href: "/attendance", label: "Attendance", roles: ["admin", "principal", "payroll"] },
  { href: "/students", label: "Students", roles: ["admin", "principal", "payroll"] },
  { href: "/calendar", label: "Calendar", roles: ["admin", "principal", "payroll"] },
  { href: "/tests", label: "Test sheet", roles: ["admin", "principal", "payroll"] },
  { href: "/payroll", label: "Payroll", roles: ["admin", "principal", "payroll"] },
  { href: "/settings", label: "Settings", roles: ["admin", "principal"] },
  { href: "/staff", label: "Staff logins", roles: ["admin"] },
];

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", principal: "Principal", payroll: "Payroll", student: "Student" };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(...STAFF);
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="font-semibold" dir="rtl">כולל ערב תורתך שעשועי</Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.filter((n) => n.roles.includes(profile.role)).map((n) => (
              <Link key={n.href} href={n.href} className="text-gray-700 hover:text-blue-700">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
            <span>{profile.full_name ?? profile.email} · {ROLE_LABEL[profile.role]}</span>
            <Link className="text-gray-700 underline hover:text-blue-700" href="/set-password">Change password</Link>
            <form action={signOut}>
              <button className="text-gray-700 underline hover:text-blue-700" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
