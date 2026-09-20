import { NextResponse } from "next/server";
import { getCourseJourney } from "@/lib/knowledge-gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCourseJourney());
  } catch (error) {
    console.error("getCourseJourney", error);
    return NextResponse.json({ error: "Could not load the course journey." }, { status: 500 });
  }
}
