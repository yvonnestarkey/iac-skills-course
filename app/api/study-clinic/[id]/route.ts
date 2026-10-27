import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { fetchStudyClinicClip } from "@/lib/study-clinic";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = await params;
  const clip = await fetchStudyClinicClip(id);
  if (!clip) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  return NextResponse.json({ clip });
}
