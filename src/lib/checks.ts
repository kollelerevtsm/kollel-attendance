/** Business-check helpers: amount in words, ABA routing check, and the MICR line. */

export interface CheckSettings {
  payer_name: string;
  payer_address: string;
  bank_name: string;
  bank_address: string;
  fractional_routing: string;
  routing_number: string;
  account_number: string;
  next_check_number: number;
  memo: string;
  stock: "blank" | "preprinted";
  offset_x: number;
  offset_y: number;
}

export const EMPTY_CHECK_SETTINGS: CheckSettings = {
  payer_name: "", payer_address: "", bank_name: "", bank_address: "", fractional_routing: "",
  routing_number: "", account_number: "", next_check_number: 1001, memo: "", stock: "blank", offset_x: 0, offset_y: 0,
};

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function under1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "")); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

/** 1234.5 → "One Thousand Two Hundred Thirty-Four and 50/100" */
export function amountInWords(amount: number): string {
  const cents = Math.round(amount * 100);
  let dollars = Math.floor(cents / 100);
  const c = String(cents % 100).padStart(2, "0");
  if (dollars === 0) return `Zero and ${c}/100`;
  const parts: string[] = [];
  for (const [size, word] of [[1_000_000, "Million"], [1000, "Thousand"]] as const) {
    if (dollars >= size) { parts.push(`${under1000(Math.floor(dollars / size))} ${word}`); dollars %= size; }
  }
  if (dollars) parts.push(under1000(dollars));
  return `${parts.join(" ")} and ${c}/100`;
}

/** ABA routing numbers carry a check digit: 3·d1 + 7·d2 + d3 + 3·d4 + … must be a multiple of 10. */
export function validRouting(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = routing.split("").map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

/**
 * The three MICR fields of a business check, in GnuMICR's letters: A = transit ⑆, C = on-us ⑈.
 * Printed right-aligned at fixed positions (see the check page).
 */
export function micrFields(checkNumber: number | string, routing: string, account: string) {
  return {
    auxOnUs: `C${String(checkNumber).padStart(6, "0")}C`, // check number, far left
    transit: `A${routing}A`,
    onUs: `${account}C`,
  };
}

/** Inches from the check's right edge to the right edge of MICR character position `n` (position 1 is rightmost). */
export const micrRightEdge = (n: number) => 5 / 16 + (n - 1) / 8;
