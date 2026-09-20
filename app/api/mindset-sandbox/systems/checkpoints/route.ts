import { NextResponse } from "next/server";
import { createSystemsCheckpoint, getCurrentCheckpoint, tableMissing } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ checkpoint: await getCurrentCheckpoint() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load checkpoint.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.version || !body?.title || !body?.synthesis) {
    return NextResponse.json({ error: "version, title and synthesis are required." }, { status: 400 });
  }
  try {
    const checkpoint = await createSystemsCheckpoint({
      version: String(body.version),
      title: String(body.title),
      synthesis: String(body.synthesis),
      model: (body.model as Record<string, unknown>) || undefined,
      supporting_record_ids: Array.isArray(body.supporting_record_ids) ? body.supporting_record_ids.map(String) : undefined,
      challenging_record_ids: Array.isArray(body.challenging_record_ids) ? body.challenging_record_ids.map(String) : undefined,
      open_question_ids: Array.isArray(body.open_question_ids) ? body.open_question_ids.map(String) : undefined,
      revision_id: body.revision_id ? String(body.revision_id) : undefined,
      created_by: body.created_by === "yvonne" ? "yvonne" : "ai",
    });
    return NextResponse.json({ checkpoint }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create checkpoint.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
