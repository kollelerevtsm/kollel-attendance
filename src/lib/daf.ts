// One daf per session night, continuing through Shas.

import { gematriya } from "@hebcal/core";

/** Bavli masechtos in order, with the last daf (Vilna Shas). Kinnim, Tamid and Middos follow Me'ilah. */
export const MASECHTOS: { key: string; he: string; en: string; last: number }[] = [
  { key: "berachos", he: "ברכות", en: "Berachos", last: 64 },
  { key: "shabbos", he: "שבת", en: "Shabbos", last: 157 },
  { key: "eruvin", he: "עירובין", en: "Eruvin", last: 105 },
  { key: "pesachim", he: "פסחים", en: "Pesachim", last: 121 },
  { key: "shekalim", he: "שקלים", en: "Shekalim", last: 22 },
  { key: "yoma", he: "יומא", en: "Yoma", last: 88 },
  { key: "sukkah", he: "סוכה", en: "Sukkah", last: 56 },
  { key: "beitzah", he: "ביצה", en: "Beitzah", last: 40 },
  { key: "rosh_hashanah", he: "ראש השנה", en: "Rosh Hashanah", last: 35 },
  { key: "taanis", he: "תענית", en: "Taanis", last: 31 },
  { key: "megillah", he: "מגילה", en: "Megillah", last: 32 },
  { key: "moed_katan", he: "מועד קטן", en: "Moed Katan", last: 29 },
  { key: "chagigah", he: "חגיגה", en: "Chagigah", last: 27 },
  { key: "yevamos", he: "יבמות", en: "Yevamos", last: 122 },
  { key: "kesubos", he: "כתובות", en: "Kesubos", last: 112 },
  { key: "nedarim", he: "נדרים", en: "Nedarim", last: 91 },
  { key: "nazir", he: "נזיר", en: "Nazir", last: 66 },
  { key: "sotah", he: "סוטה", en: "Sotah", last: 49 },
  { key: "gittin", he: "גיטין", en: "Gittin", last: 90 },
  { key: "kiddushin", he: "קידושין", en: "Kiddushin", last: 82 },
  { key: "bava_kamma", he: "בבא קמא", en: "Bava Kamma", last: 119 },
  { key: "bava_metzia", he: "בבא מציעא", en: "Bava Metzia", last: 119 },
  { key: "bava_basra", he: "בבא בתרא", en: "Bava Basra", last: 176 },
  { key: "sanhedrin", he: "סנהדרין", en: "Sanhedrin", last: 113 },
  { key: "makkos", he: "מכות", en: "Makkos", last: 24 },
  { key: "shevuos", he: "שבועות", en: "Shevuos", last: 49 },
  { key: "avodah_zarah", he: "עבודה זרה", en: "Avodah Zarah", last: 76 },
  { key: "horayos", he: "הוריות", en: "Horayos", last: 14 },
  { key: "zevachim", he: "זבחים", en: "Zevachim", last: 120 },
  { key: "menachos", he: "מנחות", en: "Menachos", last: 110 },
  { key: "chullin", he: "חולין", en: "Chullin", last: 142 },
  { key: "bechoros", he: "בכורות", en: "Bechoros", last: 61 },
  { key: "arachin", he: "ערכין", en: "Arachin", last: 34 },
  { key: "temurah", he: "תמורה", en: "Temurah", last: 34 },
  { key: "kereisos", he: "כריתות", en: "Kereisos", last: 28 },
  { key: "meilah", he: "מעילה", en: "Me'ilah", last: 37 },
  { key: "niddah", he: "נדה", en: "Niddah", last: 73 },
];

export function dafLabel(masechtaKey: string, daf: number): string {
  const m = MASECHTOS.find((x) => x.key === masechtaKey);
  return `${m?.he ?? masechtaKey} ${gematriya(daf)}`;
}

/**
 * Assign one daf per night, in order, starting at (masechta, daf) on the first night.
 * Nights in `skip` (review nights, test nights) get no new daf.
 */
export function assignDafim(nights: string[], skip: Set<string>, startMasechta: string, startDaf: number): Map<string, string> {
  const out = new Map<string, string>();
  let mi = MASECHTOS.findIndex((m) => m.key === startMasechta);
  if (mi < 0) return out;
  let daf = Math.max(2, startDaf);
  for (const night of nights) {
    if (skip.has(night)) continue;
    if (daf > MASECHTOS[mi].last) {
      mi = (mi + 1) % MASECHTOS.length;
      daf = 2;
    }
    out.set(night, dafLabel(MASECHTOS[mi].key, daf));
    daf++;
  }
  return out;
}

/**
 * Suggest the next test date: about 4 weeks after the last one, on the first session night
 * from that Sunday on.
 */
export function suggestNextTest(lastTest: string | null, today: string, isSession: (d: string) => boolean, addDays: (d: string, n: number) => string, weekday: (d: string) => number): string | null {
  let d = lastTest ? addDays(lastTest, 28) : today;
  if (d < today) d = today;
  while (weekday(d) !== 0) d = addDays(d, 1);
  for (let i = 0; i < 21; i++, d = addDays(d, 1)) {
    if (isSession(d)) return d;
  }
  return null;
}
