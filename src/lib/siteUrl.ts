import { headers } from "next/headers";

const MAIN_SITE = "https://kolleltsm.vercel.app";

/**
 * The public address of the app, used in emailed links.
 * Never the long "...-kollel-clucking.vercel.app" address: Vercel puts a login wall on it.
 */
export async function siteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fromEnv && !/-kollel-clucking\.vercel\.app$/.test(fromEnv)) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (!host || /-kollel-clucking\.vercel\.app$/.test(host)) return MAIN_SITE;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Where emailed sign-in links land. The email templates use {{ .RedirectTo }}. */
export async function confirmUrl(): Promise<string> {
  return `${await siteUrl()}/auth/confirm`;
}
