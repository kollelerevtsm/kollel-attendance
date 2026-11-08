import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getCheckSettings } from "@/lib/checkSettings";
import { Notice, PageTitle } from "@/components/Notice";
import { saveCheckSetup } from "./actions";

export default async function CheckSetupPage({ searchParams }: PageProps<"/payroll/check-setup">) {
  await requireRole("admin", "payroll");
  const sp = await searchParams;
  const c = await getCheckSettings();

  return (
    <>
      <PageTitle title="Check setup">
        <Link className="btn-secondary" href="/payroll">Back</Link>
      </PageTitle>
      <Notice error={typeof sp.error === "string" ? sp.error : undefined} message={typeof sp.message === "string" ? sp.message : undefined} />
      <p className="mb-5 max-w-2xl text-sm text-gray-600">
        Used to print business checks (one check per page, check on top with two stubs). Only the admin and payroll can see this page.
      </p>

      <form action={saveCheckSetup} className="max-w-2xl space-y-6" autoComplete="off">
        <section className="card space-y-4">
          <h2 className="font-semibold">Check paper</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="stock" value="blank" defaultChecked={c.stock === "blank"} className="mt-1" />
            <span><strong>Blank check paper</strong> — the app prints everything, including the bank details and the MICR numbers at the bottom.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="stock" value="preprinted" defaultChecked={c.stock === "preprinted"} className="mt-1" />
            <span><strong>Checks from the bank (already printed)</strong> — the app only fills in the date, name, amount and memo.</span>
          </label>
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold">Who the checks are from</h2>
          <div>
            <label className="label" htmlFor="payer_name">Name on the checks</label>
            <input className="input" id="payer_name" name="payer_name" defaultValue={c.payer_name} placeholder="כולל ערב תורתך שעשועי" dir="auto" required />
          </div>
          <div>
            <label className="label" htmlFor="payer_address">Address (2–3 lines)</label>
            <textarea className="input" id="payer_address" name="payer_address" rows={3} defaultValue={c.payer_address} />
          </div>
          <div>
            <label className="label" htmlFor="memo">Memo on every check (optional)</label>
            <input className="input" id="memo" name="memo" defaultValue={c.memo} placeholder="Leave empty to print the pay period" dir="auto" />
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold">Bank (for blank check paper)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="bank_name">Bank name</label>
              <input className="input" id="bank_name" name="bank_name" defaultValue={c.bank_name} />
            </div>
            <div>
              <label className="label" htmlFor="bank_address">Bank city / branch (optional)</label>
              <input className="input" id="bank_address" name="bank_address" defaultValue={c.bank_address} />
            </div>
            <div>
              <label className="label" htmlFor="routing_number">Routing number (9 digits)</label>
              <input className="input font-mono" id="routing_number" name="routing_number" defaultValue={c.routing_number} inputMode="numeric" pattern="[0-9]{9}" />
            </div>
            <div>
              <label className="label" htmlFor="account_number">Account number</label>
              <input className="input font-mono" id="account_number" name="account_number" defaultValue={c.account_number} inputMode="numeric" />
            </div>
            <div>
              <label className="label" htmlFor="fractional_routing">Fraction code (optional)</label>
              <input className="input font-mono" id="fractional_routing" name="fractional_routing" defaultValue={c.fractional_routing} placeholder="e.g. 1-2/210" />
              <p className="mt-1 text-xs text-gray-500">The small fraction at the top-right of your bank&apos;s checks.</p>
            </div>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold">Numbers and printing</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="next_check_number">Next check number</label>
              <input className="input" type="number" min={1} id="next_check_number" name="next_check_number" defaultValue={c.next_check_number} required />
            </div>
            <div>
              <label className="label" htmlFor="offset_x">Move right (inches)</label>
              <input className="input" type="number" step="0.01" min={-1} max={1} id="offset_x" name="offset_x" defaultValue={c.offset_x} />
            </div>
            <div>
              <label className="label" htmlFor="offset_y">Move down (inches)</label>
              <input className="input" type="number" step="0.01" min={-1} max={1} id="offset_y" name="offset_y" defaultValue={c.offset_y} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Print one test check on plain paper first and hold it against a check sheet. If it&apos;s off, adjust here (use minus numbers to move left or up).
            Print at 100% size (&ldquo;Actual size&rdquo;, not &ldquo;Fit to page&rdquo;).
          </p>
        </section>

        <button className="btn" type="submit">Save</button>
      </form>
    </>
  );
}
