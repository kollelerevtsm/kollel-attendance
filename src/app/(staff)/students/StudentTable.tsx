"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { displayName } from "@/lib/names";
import type { StudentRow } from "./StudentForm";

type SortKey = "last" | "first" | "pin" | "test_pin" | "phone" | "email" | "fingerprint";

const cmp = (a: string, b: string) => a.localeCompare(b, ["he", "en"], { numeric: true, sensitivity: "base" });

export function StudentTable({ students }: { students: StudentRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("last");
  const [desc, setDesc] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const filtered = !needle ? students : students.filter((s) => {
      const text = [s.first_name, s.last_name, displayName(s.first_name, s.last_name), s.email ?? ""].join(" ").toLowerCase();
      const nums = [s.pin, s.test_pin ?? "", (s.phone ?? "").replace(/\D/g, "")];
      return text.includes(needle) || (digits.length > 0 && nums.some((n) => n.includes(digits)));
    });
    const key = (s: StudentRow): string => {
      switch (sort) {
        case "first": return `${s.first_name} ${s.last_name}`;
        case "last": return `${s.last_name} ${s.first_name}`;
        case "pin": return s.pin;
        case "test_pin": return s.test_pin ?? "";
        case "phone": return s.phone ?? "";
        case "email": return s.email ?? "￿";
        case "fingerprint": return s.fingerprint_enrolled ? "1" : "0";
      }
    };
    const sorted = [...filtered].sort((a, b) => cmp(key(a), key(b)));
    return desc ? sorted.reverse() : sorted;
  }, [students, q, sort, desc]);

  const header = (k: SortKey, label: string) => {
    const active = sort === k;
    const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${active ? "font-semibold text-gray-900" : ""}`}
        onClick={() => { if (active) setDesc(!desc); else { setSort(k); setDesc(false); } }}
      >
        {label}
        <Icon size={13} className={active ? "" : "opacity-40"} aria-hidden />
      </button>
    );
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            className="input pl-9 pr-9"
            type="search"
            placeholder="Search name, PIN, phone or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search students"
            dir="auto"
          />
          {q && (
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700" onClick={() => setQ("")} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Sort name by
          <select className="input w-auto py-1" value={sort === "first" ? "first" : "last"} onChange={(e) => { setSort(e.target.value as SortKey); setDesc(false); }}>
            <option value="last">Last name</option>
            <option value="first">First name</option>
          </select>
        </label>
        {q && <span className="text-sm text-gray-500">{rows.length} of {students.length}</span>}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">{header(sort === "first" ? "first" : "last", "Name")}</th>
              <th className="px-4 py-2">{header("pin", "PIN")}</th>
              <th className="px-4 py-2">{header("test_pin", "Test ID")}</th>
              <th className="px-4 py-2">{header("phone", "Phone")}</th>
              <th className="px-4 py-2">{header("email", "Email")}</th>
              <th className="px-4 py-2">{header("fingerprint", "Fingerprint")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-2">
                  <Link className="text-brand-700 hover:underline" href={`/students/${s.id}`} dir="auto">
                    {displayName(s.first_name, s.last_name)}
                  </Link>
                  {!s.active && <span className="ml-2 text-xs text-gray-400">inactive</span>}
                </td>
                <td className="px-4 py-2 font-mono">{s.pin}</td>
                <td className="px-4 py-2 font-mono text-gray-500">{s.test_pin ?? ""}</td>
                <td className="whitespace-nowrap px-4 py-2">{s.phone}</td>
                <td className="px-4 py-2">{s.email ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-2">
                  {s.fingerprint_enrolled ? <span className="text-green-700">Enrolled</span> : <span className="text-amber-700">Not yet</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">{q ? "No students match your search." : "No students yet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
