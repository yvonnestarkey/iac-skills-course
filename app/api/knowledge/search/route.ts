import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge-gateway";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  if (!query.trim()) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }
  try {
    const result = await searchKnowledge({
      query,
      source_type: searchParams.get("source_type") || undefined,
      chapter_id: searchParams.get("chapter_id") || undefined,
      lesson_id: searchParams.get("lesson_id") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      cursor: searchParams.get("cursor") || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("searchKnowledge", error);
    return NextResponse.json({ error: "Could not search knowledge." }, { status: 500 });
  }
}
