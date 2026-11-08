import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { requireRole, STAFF, type Role } from "@/lib/auth";
import { getSettings, todayIn } from "@/lib/data";
import { nightsInfo, parshaOfWeek } from "@/lib/hebrew";
import { SideNav } from "@/components/SideNav";
import { MobileNav } from "@/components/MobileNav";
import { Brand } from "@/components/Brand";
import { signOut } from "../login/actions";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", principal: "Principal", payroll: "Payroll", student: "Student" };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(...STAFF);
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const tonight = nightsInfo(today, today, settings.off_holidays).get(today)!;
  const name = profile.full_name ?? profile.email;
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  const sidebar = (
    <>
      <Link href="/dashboard" className="block px-4 pb-6 pt-7">
        <Brand hebrewDate={`ליל ${tonight.hebrewDate}`} />
      </Link>
      <div className="mx-6 mb-5 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" aria-hidden />
      <SideNav role={profile.role} />
    </>
  );

  return (
    <div className="flex min-h-screen overflow-x-clip">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto bg-leather-900 pb-6 lg:flex print:hidden">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur sm:px-4 lg:px-8 print:hidden">
          <MobileNav>{sidebar}</MobileNav>
          <p className="truncate text-sm text-gray-600" dir="rtl">{parshaOfWeek(today)}</p>
          <details className="relative ml-auto">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-gray-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-leather-800 text-xs font-semibold text-gold-300">{initials}</span>
              <span className="hidden text-sm sm:block">
                <span className="font-medium">{name}</span>
                <span className="text-gray-500"> · {ROLE_LABEL[profile.role]}</span>
              </span>
            </summary>
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-line bg-white p-1 shadow-lg">
              <Link href="/set-password" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-50">
                <KeyRound size={16} aria-hidden /> Change password
              </Link>
              <form action={signOut}>
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50" type="submit">
                  <LogOut size={16} aria-hidden /> Sign out
                </button>
              </form>
            </div>
          </details>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-4 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
