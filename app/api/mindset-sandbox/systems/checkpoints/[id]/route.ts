import { NextResponse } from "next/server";
import { getSystemsCheckpoint, tableMissing } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const checkpoint = await getSystemsCheckpoint(id);
    if (!checkpoint) return NextResponse.json({ error: "Checkpoint not found." }, { status: 404 });
    return NextResponse.json({ checkpoint });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load checkpoint.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
