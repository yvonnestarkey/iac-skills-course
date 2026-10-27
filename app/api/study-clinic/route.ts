import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { fetchStudyClinicClips } from "@/lib/study-clinic";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const clips = await fetchStudyClinicClips();
  return NextResponse.json({ clips });
}
