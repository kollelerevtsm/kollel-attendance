/** Loading screen: a Gemara opens, its pages turn, and light rises from it. */
export function GemaraLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-10 ${fullScreen ? "min-h-screen bg-leather-900" : "min-h-[60vh]"}`}
    >
      <div className="gemara mt-16" aria-hidden>
        <div className="gemara-rays" />
        <div className="gemara-glow" />
        <div className="gemara-under" />
        <div className="gemara-page left" />
        <div className="gemara-page right" />
        <div className="gemara-sheet" />
        <div className="gemara-sheet" />
        <div className="gemara-sheet" />
        <div className="gemara-spine" />
        <div className="gemara-cover" dir="rtl">ש״ס</div>
      </div>
      <p className={`text-lg ${fullScreen ? "text-gold-300" : "text-leather-700"}`} dir="rtl">תורתך שעשועי</p>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
