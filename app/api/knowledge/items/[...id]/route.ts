import { NextResponse } from "next/server";
import { getKnowledgeItem } from "@/lib/knowledge-gateway";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string[] }> }) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const stableId = searchParams.get("id") || (id || []).map((part) => decodeURIComponent(part)).join(":");
  const offset = Number(searchParams.get("offset") || 0);
  const limit = Number(searchParams.get("limit") || 12000);
  try {
    const item = await getKnowledgeItem(stableId, offset, limit);
    if (!item) return NextResponse.json({ error: "Knowledge item not found." }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    console.error("getKnowledgeItem", error);
    return NextResponse.json({ error: "Could not load knowledge item." }, { status: 500 });
  }
}
