// CrossChex Cloud (Anviz) — reading attendance records from the webhook and the Cloud API.

import { randomUUID } from "node:crypto";

export interface ScanRecord {
  external_id: string;
  user_pin: string;
  scanned_at: string; // ISO
  verify_method: string; // "pin" | "fingerprint" | "card" | other
  device_serial: string | null;
  raw: unknown;
}

/** CrossChex "check type" codes → how the person verified. */
export function verifyMethod(checktype: unknown): string {
  const c = Number(checktype);
  if (c === 1) return "pin";
  if ([64, 128, 192].includes(c)) return "fingerprint";
  if ([8, 56].includes(c)) return "card";
  if ([144, 193].includes(c)) return "fingerprint+card";
  return Number.isFinite(c) ? `code ${c}` : "unknown";
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Turn one CrossChex record into a scan; null if it isn't one. */
export function toScan(r: unknown): ScanRecord | null {
  if (!isObj(r)) return null;
  const emp = isObj(r.employee) ? r.employee : {};
  const dev = isObj(r.device) ? r.device : {};
  const pin = String(emp.workno ?? r.workno ?? r.user_id ?? "").trim();
  const time = String(r.checktime ?? r.check_time ?? "");
  if (!pin || !time || Number.isNaN(Date.parse(time))) return null;
  const serial = dev.serial_number ? String(dev.serial_number) : null;
  return {
    external_id: String(r.uuid ?? `${serial}-${pin}-${time}`),
    user_pin: pin.replace(/^0+(?=\d{4})/, ""), // the device may pad IDs with zeros
    scanned_at: new Date(time).toISOString(),
    verify_method: verifyMethod(r.checktype ?? r.check_type ?? r.verify_type ?? r.verifymode),
    device_serial: serial,
    raw: r,
  };
}

/** Pull every record out of a webhook body or API response, whatever its exact shape. */
export function extractScans(body: unknown): ScanRecord[] {
  const found: ScanRecord[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 4) return;
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth + 1));
    if (!isObj(v)) return;
    const scan = toScan(v);
    if (scan) return void found.push(scan);
    for (const key of ["payload", "data", "list", "records", "record"]) if (key in v) visit(v[key], depth + 1);
  };
  visit(body, 0);
  return found;
}

// ── Cloud API ────────────────────────────────────────────────

const apiUrl = () => process.env.CROSSCHEX_API_URL ?? "https://api.us.crosschexcloud.com/";

function header(nameSpace: string, nameAction: string) {
  return { nameSpace, nameAction, version: "1.0", requestId: randomUUID(), timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00") };
}

async function call(body: unknown): Promise<Obj> {
  const res = await fetch(apiUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Obj;
  const p = isObj(json.payload) ? json.payload : {};
  if (!res.ok || ("code" in json && json.code !== "200" && json.code !== 200 && !json.payload) || (typeof p.type === "string" && /ERROR|EXPIRES|MISS/.test(p.type))) {
    throw new Error(`CrossChex: ${JSON.stringify(p.message ?? p.type ?? json.msg ?? res.status)}`);
  }
  return json;
}

export async function getToken(): Promise<string> {
  const api_key = process.env.CROSSCHEX_API_KEY;
  const api_secret = process.env.CROSSCHEX_API_SECRET;
  if (!api_key || !api_secret) throw new Error("CrossChex API key/secret aren't set in Vercel yet.");
  const json = await call({ header: header("authorize.token", "token"), payload: { api_key, api_secret } });
  const token = isObj(json.payload) ? json.payload.token : undefined;
  if (typeof token !== "string") throw new Error("CrossChex didn't return a token. Check the API key and secret.");
  return token;
}

/** All records between two times (handles paging). */
export async function fetchRecords(begin: Date, end: Date): Promise<ScanRecord[]> {
  const token = await getToken();
  const out: ScanRecord[] = [];
  for (let page = 1; page <= 50; page++) {
    const json = await call({
      header: header("attendance.record", "getrecord"),
      authorize: { type: "token", token },
      payload: {
        begin_time: begin.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
        end_time: end.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
        order: "asc",
        page,
        per_page: 100,
      },
    });
    const p = isObj(json.payload) ? json.payload : {};
    out.push(...extractScans(p.list ?? []));
    if (page >= Number(p.pageCount ?? 1)) break;
  }
  return out;
}
