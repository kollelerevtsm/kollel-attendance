// Two-step verification: a 6-digit code sent by email, and a signed cookie that marks
// this browser as verified (for this visit, or for 90 days if "remember this browser" was ticked).

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "tfa_s";
export const TRUST_COOKIE = "tfa_t";
export const TRUST_DAYS = 90;
const SESSION_HOURS = 12;
export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.TWO_STEP_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("Missing TWO_STEP_SECRET");
  return s;
}

export function sign(userId: string, expiresAt: number, key = secret()): string {
  const payload = `${userId}.${expiresAt}`;
  const mac = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyToken(token: string | undefined, userId: string, now = Date.now(), key = secret()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, exp, mac] = parts;
  if (uid !== userId || !(Number(exp) > now)) return false;
  const expected = createHmac("sha256", key).update(`${uid}.${exp}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}:${secret()}`).digest("hex");
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Has this browser passed two-step verification for this user? */
export async function isVerified(userId: string): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value, userId) || verifyToken(jar.get(TRUST_COOKIE)?.value, userId);
}

/** Mark this browser as verified. Call only from a server action or route handler. */
export async function markVerified(userId: string, remember: boolean) {
  const jar = await cookies();
  const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  jar.set(SESSION_COOKIE, sign(userId, Date.now() + SESSION_HOURS * 3600_000), base);
  if (remember) {
    jar.set(TRUST_COOKIE, sign(userId, Date.now() + TRUST_DAYS * 86400_000), { ...base, maxAge: TRUST_DAYS * 86400 });
  }
}

/** Forget this visit's verification (sign out). The 90-day "trusted browser" mark stays. */
export async function clearSessionVerification() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
