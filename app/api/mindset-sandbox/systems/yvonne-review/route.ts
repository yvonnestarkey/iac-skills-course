import { NextResponse } from "next/server";
import { recordYvonneSystemsReview, tableMissing } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.target_id || (body.action !== "confirm" && body.action !== "correct")) {
    return NextResponse.json({ error: "target_id and action (confirm|correct) are required." }, { status: 400 });
  }
  try {
    const result = await recordYvonneSystemsReview({
      target_id: String(body.target_id),
      action: body.action,
      statement: body.statement ? String(body.statement) : undefined,
      rationale: body.rationale ? String(body.rationale) : undefined,
      title: body.title ? String(body.title) : undefined,
      payload: (body.payload as Record<string, unknown>) || {},
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record Yvonne review.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
