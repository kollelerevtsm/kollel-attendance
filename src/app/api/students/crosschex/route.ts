import { NextResponse, type NextRequest } from "next/server";
import { getProfile, STAFF } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildCrossChexWorkbook } from "@/lib/crosschexSheet";

/** A file for CrossChex Cloud → Organization → Employee → Import: two employees per active student. */
export async function GET(req: NextRequest) {
  const me = await getProfile();
  if (!me || !STAFF.includes(me.role)) return new NextResponse("Not allowed", { status: 403 });
  const department = req.nextUrl.searchParams.get("department")?.trim() || "Kollel";
  const supabase = await createClient();
  const { data } = await supabase
    .from("students").select("first_name,last_name,pin,test_pin,phone,start_date")
    .eq("active", true).order("last_name").order("first_name");
  const buf = await buildCrossChexWorkbook(data ?? [], department);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="crosschex_employees.xlsx"`,
    },
  });
}
