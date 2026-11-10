"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * A search box that hides table rows not matching what's typed.
 * Rows to search carry `data-search="..."`, inside the element with id `target`.
 */
export function RowSearch({ target, placeholder = "Search name or PIN" }: { target: string; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [count, setCount] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    const root = document.getElementById(target);
    if (!root) return;
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-search]"));
    let shown = 0;
    for (const r of rows) {
      const hay = (r.dataset.search ?? "").toLowerCase();
      const match = !needle || hay.includes(needle) || (digits.length > 0 && hay.replace(/[^\d ]/g, "").includes(digits));
      r.hidden = !match;
      if (match) shown++;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(needle ? { shown, total: rows.length } : null);
  }, [q, target]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
      <div className="relative w-full max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
        <input className="input !pl-9 !pr-9" type="search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" dir="auto" />
        {q && (
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700" onClick={() => setQ("")} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>
      {count && <span className="text-sm text-gray-500">{count.shown} of {count.total}</span>}
    </div>
  );
}
