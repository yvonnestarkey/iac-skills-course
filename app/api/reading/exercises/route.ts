import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { fetchPracticeExercises } from "@/lib/reading-practice";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const rows = await fetchPracticeExercises();
  return NextResponse.json({ exercises: rows.map((row) => row.payload) });
}
