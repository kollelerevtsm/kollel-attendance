const HEBREW = /[֐-׿]/;

/**
 * A student's name for lists.
 * Hebrew/Yiddish names read right to left as "first last" (first name on the right);
 * English names stay "Last, First".
 */
export function displayName(first: string | null | undefined, last: string | null | undefined): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (HEBREW.test(f) || HEBREW.test(l)) return [f, l].filter(Boolean).join(" ");
  return l && f ? `${l}, ${f}` : l || f;
}
