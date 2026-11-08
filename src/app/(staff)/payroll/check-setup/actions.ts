"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validRouting } from "@/lib/checks";

const back = (k: "error" | "message", m: string) => redirect(`/payroll/check-setup?${k}=${encodeURIComponent(m)}`);

export async function saveCheckSetup(formData: FormData) {
  const me = await requireRole("admin", "payroll");
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const routing = g("routing_number").replace(/\D/g, "");
  const account = g("account_number").replace(/\D/g, "");
  const next = Number(g("next_check_number"));
  const offX = Number(g("offset_x") || 0);
  const offY = Number(g("offset_y") || 0);
  const stock = g("stock") === "preprinted" ? "preprinted" : "blank";

  if (!g("payer_name")) back("error", "Enter the name printed on the checks.");
  if (stock === "blank") {
    if (!validRouting(routing)) back("error", "That routing number isn't valid. It should be the 9 digits at the bottom-left of one of your checks.");
    if (!/^\d{4,17}$/.test(account)) back("error", "Enter the account number (4–17 digits).");
    if (!g("bank_name")) back("error", "Enter the bank's name.");
  }
  if (!Number.isInteger(next) || next < 1) back("error", "The next check number must be a whole number.");
  if (![offX, offY].every((n) => Number.isFinite(n) && Math.abs(n) <= 1)) back("error", "Print adjustments must be between -1 and 1 inch.");

  const supabase = await createClient();
  const { error } = await supabase.from("check_settings").upsert({
    id: 1,
    payer_name: g("payer_name"),
    payer_address: g("payer_address"),
    bank_name: g("bank_name"),
    bank_address: g("bank_address"),
    fractional_routing: g("fractional_routing"),
    routing_number: routing,
    account_number: account,
    next_check_number: next,
    memo: g("memo"),
    stock,
    offset_x: offX,
    offset_y: offY,
    updated_at: new Date().toISOString(),
  });
  if (error) back("error", error.message.includes("check_settings") && error.message.includes("does not exist")
    ? "Run 0010_checks_test_periods.sql in Supabase first."
    : error.message);
  await supabase.from("audit_log").insert({ user_id: me.id, action: "checks.setup", details: { routing_last4: routing.slice(-4), account_last4: account.slice(-4) } });
  revalidatePath("/payroll");
  back("message", "Saved.");
}
