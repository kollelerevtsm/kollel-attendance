"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Phone menu: a button in the top bar that slides the sidebar over the page.
 * The drawer is rendered at the end of <body>, because the top bar's blur effect
 * would otherwise trap it inside the bar.
 */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const path = usePathname();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" className="rounded-md p-2 hover:bg-gray-100 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Menu size={22} />
      </button>
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden print:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-leather-900 pb-8 shadow-xl">
            <button type="button" className="absolute right-3 top-3 rounded-md p-2 text-white/70 hover:bg-white/10" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
