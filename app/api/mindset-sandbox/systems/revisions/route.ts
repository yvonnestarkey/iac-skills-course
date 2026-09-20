import { NextResponse } from "next/server";
import { recordSystemsRevision, tableMissing } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.target_id || !body?.revised_understanding || !body?.systems_why) {
    return NextResponse.json({ error: "target_id, revised_understanding and systems_why are required." }, { status: 400 });
  }
  try {
    const result = await recordSystemsRevision({
      target_id: String(body.target_id),
      title: String(body.title || "Model revision"),
      previous_understanding: body.previous_understanding ? String(body.previous_understanding) : undefined,
      revised_understanding: String(body.revised_understanding),
      trigger: (body.trigger as { note: string; source_ids?: string[]; record_ids?: string[] }) || { note: "" },
      systems_why: String(body.systems_why),
      affected: body.affected as { record_ids?: string[]; concepts?: string[] } | undefined,
      revisit: Array.isArray(body.revisit) ? (body.revisit as { reason: string; source_id?: string; record_id?: string }[]) : undefined,
      unresolved_implications: body.unresolved_implications ? String(body.unresolved_implications) : undefined,
      needs_yvonne_review: body.needs_yvonne_review === true,
      payload: (body.payload as Record<string, unknown>) || {},
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record revision.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
