import { amountInWords, micrFields, micrRightEdge, type CheckSettings } from "@/lib/checks";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usDate = (d: string) => { const [y, m, day] = d.split("-"); return `${m}/${day}/${y}`; };

export interface Check { number: number | string; date: string; payee: string; amount: number; base_nights: number; test_nights: number }

/** One letter-size page: the check on top (3.5 in) and two stubs. Styles in app/print/checks/[period]/checks.css. */
export function CheckSheet({ c, cs, periodLabel }: { c: Check; cs: CheckSettings; periodLabel: string }) {
  const blank = cs.stock === "blank";
  const memo = cs.memo || `Kollel ${periodLabel}`;
  const micr = micrFields(c.number, cs.routing_number, cs.account_number);
  const stub = (
    <>
      <div className="flex justify-between font-semibold">
        <span dir="auto">{cs.payer_name}</span>
        <span>Check #{c.number} · {usDate(c.date)}</span>
      </div>
      <div className="mt-3 flex justify-between">
        <span>Pay to: <strong dir="auto">{c.payee}</strong></span>
        <span>Period: {periodLabel}</span>
      </div>
      <table className="mt-4 w-full text-left">
        <tbody>
          {c.base_nights > 0 && <tr><td className="py-0.5">Nights at the regular rate</td><td className="text-right">{c.base_nights}</td></tr>}
          {c.test_nights > 0 && <tr><td className="py-0.5">Nights at the בחינה rate</td><td className="text-right">{c.test_nights}</td></tr>}
          <tr className="border-t font-semibold"><td className="pt-1">Total</td><td className="pt-1 text-right">${money(c.amount)}</td></tr>
        </tbody>
      </table>
    </>
  );

  return (
    <div className="check-sheet">
      <div className="check-inner" style={{ transform: `translate(${cs.offset_x}in, ${cs.offset_y}in)` }}>
        <div className="check-face">
          {blank && (
            <>
              <div className="ck-abs" style={{ left: "0.5in", top: "0.35in", maxWidth: "2.9in" }}>
                <div className="text-[11pt] font-bold leading-tight" dir="auto">{cs.payer_name}</div>
                <div className="whitespace-pre-line text-[8.5pt] leading-snug">{cs.payer_address}</div>
              </div>
              <div className="ck-abs text-center" style={{ left: "3.5in", top: "0.35in", width: "2.3in" }}>
                <div className="text-[9pt] font-semibold">{cs.bank_name}</div>
                <div className="text-[8pt]">{cs.bank_address}</div>
              </div>
              <div className="ck-abs text-right" style={{ right: "0.5in", top: "0.3in" }}>
                <div className="text-[13pt] font-bold">{c.number}</div>
                <div className="text-[7.5pt]">{cs.fractional_routing}</div>
              </div>
            </>
          )}
          <div className="ck-abs flex items-end gap-2" style={{ right: "0.5in", top: "0.85in" }}>
            {blank && <span className="ck-label">Date</span>}
            <span className={`${blank ? "ck-rule" : ""} w-[1.3in] text-center text-[11pt]`}>{usDate(c.date)}</span>
          </div>
          <div className="ck-abs flex items-end" style={{ left: "0.5in", top: "1.3in", width: "5.6in" }}>
            {blank && <span className="ck-label mr-2 w-[0.75in] leading-tight">Pay to the order of</span>}
            <span className={`${blank ? "ck-rule" : ""} flex-1 pl-2 text-[12pt] font-semibold`} dir="auto">{c.payee}</span>
          </div>
          <div className="ck-abs flex items-center" style={{ right: "0.5in", top: "1.3in" }}>
            {blank && <span className="mr-1 text-[12pt] font-semibold">$</span>}
            <span className={`${blank ? "border border-gray-700" : ""} w-[1.35in] px-2 py-0.5 text-right text-[12pt] font-bold`}>**{money(c.amount)}</span>
          </div>
          <div className="ck-abs flex items-end" style={{ left: "0.5in", right: "0.5in", top: "1.85in" }}>
            <span className={`${blank ? "ck-rule" : ""} flex-1 overflow-hidden whitespace-nowrap text-[11pt]`}>
              {amountInWords(c.amount)} {"*".repeat(60)}
            </span>
            {blank && <span className="ml-2 text-[9pt] font-semibold">DOLLARS</span>}
          </div>
          <div className="ck-abs flex items-end" style={{ left: "0.5in", top: "2.55in", width: "3.4in" }}>
            {blank && <span className="ck-label mr-2">Memo</span>}
            <span className={`${blank ? "ck-rule" : ""} flex-1 truncate text-[9.5pt]`} dir="auto">{memo}</span>
          </div>
          {blank && (
            <div className="ck-abs text-center" style={{ right: "0.5in", top: "2.45in", width: "3in" }}>
              <div className="ck-rule h-[0.3in]" />
              <div className="ck-label mt-0.5">Authorized signature</div>
            </div>
          )}
          {blank && cs.routing_number && cs.account_number && (
            <>
              <span className="micr" style={{ right: `${micrRightEdge(45)}in` }}>{micr.auxOnUs}</span>
              <span className="micr" style={{ right: `${micrRightEdge(33)}in` }}>{micr.transit}</span>
              <span className="micr" style={{ right: `${micrRightEdge(14)}in` }}>{micr.onUs}</span>
            </>
          )}
        </div>
        <div className="check-stub" style={{ top: "3.5in" }}>{stub}</div>
        <div className="check-stub" style={{ top: "7.25in" }}>{stub}</div>
      </div>
    </div>
  );
}
