import { NextResponse } from "next/server";
import { tableMissing, upsertSystemsInterpretation } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.title || !body?.statement) {
    return NextResponse.json({ error: "title and statement are required." }, { status: 400 });
  }
  try {
    const record = await upsertSystemsInterpretation({
      id: body.id ? String(body.id) : undefined,
      kind: body.kind === "relationship" || body.kind === "alternative" ? body.kind : "interpretation",
      title: String(body.title),
      statement: String(body.statement),
      rationale: body.rationale ? String(body.rationale) : undefined,
      source_refs: Array.isArray(body.source_refs) ? (body.source_refs as { source_id: string }[]) : undefined,
      supports_record_ids: Array.isArray(body.supports_record_ids) ? body.supports_record_ids.map(String) : undefined,
      challenges_record_ids: Array.isArray(body.challenges_record_ids) ? body.challenges_record_ids.map(String) : undefined,
      related_record_ids: Array.isArray(body.related_record_ids) ? body.related_record_ids.map(String) : undefined,
      needs_yvonne_review: body.needs_yvonne_review === true,
      payload: (body.payload as Record<string, unknown>) || {},
    });
    return NextResponse.json({ record }, { status: record.id && body.id ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save interpretation.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
