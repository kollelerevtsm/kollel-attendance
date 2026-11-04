/** The kollel's name in gold, as on a sefer binding. */
export function Brand({ hebrewDate, size = "md" }: { hebrewDate?: string; size?: "md" | "lg" }) {
  return (
    <div dir="rtl" className="text-center">
      <p className={`font-bold leading-tight text-gold-400 ${size === "lg" ? "text-4xl" : "text-[22px]"}`}>כולל ערב</p>
      <p className={`leading-tight text-gold-300 ${size === "lg" ? "text-2xl" : "text-base"}`}>תורתך שעשועי</p>
      {hebrewDate && <p className="mt-2 text-sm text-white/55">{hebrewDate}</p>}
    </div>
  );
}
