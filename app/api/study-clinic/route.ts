import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { fetchStudyClinicClips, fetchStudyClinicPages } from "@/lib/study-clinic";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const staff = isStaffUser(user);
  const [clips, pages] = await Promise.all([
    fetchStudyClinicClips({ includeDrafts: staff }),
    fetchStudyClinicPages(),
  ]);
  return NextResponse.json({ clips, pages });
}
