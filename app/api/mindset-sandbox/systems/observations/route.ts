import { NextResponse } from "next/server";
import { addSystemsObservation, tableMissing } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.title || !body?.statement) {
    return NextResponse.json({ error: "title and statement are required." }, { status: 400 });
  }
  try {
    const record = await addSystemsObservation({
      title: String(body.title),
      statement: String(body.statement),
      rationale: body.rationale ? String(body.rationale) : undefined,
      source_refs: Array.isArray(body.source_refs) ? (body.source_refs as { source_id: string }[]) : [],
      payload: (body.payload as Record<string, unknown>) || {},
      created_by: body.created_by === "yvonne" ? "yvonne" : "ai",
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save observation.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
