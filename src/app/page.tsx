import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/no-access");
  redirect(profile.role === "student" ? "/me" : "/dashboard");
}
