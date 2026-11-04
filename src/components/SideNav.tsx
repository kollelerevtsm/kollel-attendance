"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ClipboardCheck, GraduationCap, LayoutDashboard, Settings, ShieldCheck, Users, Wallet, type LucideIcon,
} from "lucide-react";

type Role = "admin" | "principal" | "payroll" | "student";
interface Item { href: string; label: string; icon: LucideIcon; roles: Role[] }

const STAFF: Role[] = ["admin", "principal", "payroll"];
const GROUPS: { label?: string; items: Item[] }[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: STAFF }] },
  {
    label: "Daily",
    items: [
      { href: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: STAFF },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, roles: STAFF },
      { href: "/tests", label: "Test sheet", icon: GraduationCap, roles: STAFF },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/students", label: "Students", icon: Users, roles: STAFF },
      { href: "/staff", label: "Staff logins", icon: ShieldCheck, roles: ["admin"] },
    ],
  },
  { label: "Money", items: [{ href: "/payroll", label: "Payroll", icon: Wallet, roles: STAFF }] },
  { label: "Setup", items: [{ href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "principal"] }] },
];

export function SideNav({ role }: { role: Role }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-5 px-3" aria-label="Main">
      {GROUPS.map((g, i) => {
        const items = g.items.filter((it) => it.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={i}>
            {g.label && <p className="mb-1 px-3 text-xs font-medium text-white/40">{g.label}</p>}
            <ul className="space-y-0.5">
              {items.map((it) => {
                const active = path === it.href || path.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[15px] ${
                        active ? "bg-white/10 font-semibold text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-gold-400" aria-hidden />}
                      <Icon size={18} strokeWidth={1.8} className={active ? "text-gold-300" : ""} aria-hidden />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
