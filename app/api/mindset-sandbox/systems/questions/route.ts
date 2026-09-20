import { NextResponse } from "next/server";
import { tableMissing, upsertSystemsQuestion } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.title || !body?.statement) {
    return NextResponse.json({ error: "title and statement are required." }, { status: 400 });
  }
  try {
    const record = await upsertSystemsQuestion({
      id: body.id ? String(body.id) : undefined,
      title: String(body.title),
      statement: String(body.statement),
      related_record_ids: Array.isArray(body.related_record_ids) ? body.related_record_ids.map(String) : undefined,
      source_refs: Array.isArray(body.source_refs) ? (body.source_refs as { source_id: string }[]) : undefined,
      payload: (body.payload as Record<string, unknown>) || {},
      resolved: body.resolved === true,
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save question.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
