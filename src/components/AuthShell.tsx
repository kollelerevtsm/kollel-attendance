import { Brand } from "./Brand";

/** Sign-in pages: the kollel's name in gold on leather, with the form on a white panel. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 bg-leather-900 bg-[radial-gradient(ellipse_at_top,rgba(200,160,75,0.18),transparent_60%)] p-6">
      <Brand size="lg" />
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl shadow-black/30">{children}</div>
      <p className="text-xs text-white/40">Attendance &amp; payroll</p>
    </main>
  );
}
