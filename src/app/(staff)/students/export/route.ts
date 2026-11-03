import { NextResponse, type NextRequest } from "next/server";
import { getProfile, STAFF } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildWorkbook } from "@/lib/studentSheet";

export async function GET(req: NextRequest) {
  const me = await getProfile();
  if (!me || !STAFF.includes(me.role)) return new NextResponse("Not allowed", { status: 403 });
  const template = req.nextUrl.searchParams.get("template") === "1";

  let students: Record<string, unknown>[] = [];
  if (!template) {
    const supabase = await createClient();
    const { data } = await supabase.from("students").select("*").order("last_name").order("first_name");
    students = data ?? [];
  }
  const buf = await buildWorkbook(students);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${template ? "students_template" : "students"}.xlsx"`,
    },
  });
}
