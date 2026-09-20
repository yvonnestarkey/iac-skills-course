import { NextResponse } from "next/server";
import { listKnowledgeSources } from "@/lib/knowledge-gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listKnowledgeSources());
  } catch (error) {
    console.error("listKnowledgeSources", error);
    return NextResponse.json({ error: "Could not list knowledge sources." }, { status: 500 });
  }
}
