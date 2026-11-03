import { createClient } from "@supabase/supabase-js";

/**
 * Full-access Supabase client for background jobs (no user signed in).
 * Server-only: never import this from a page or component that runs in the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for background jobs");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
