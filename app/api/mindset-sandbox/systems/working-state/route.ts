import { NextResponse } from "next/server";
import { getSystemsWorkingState, tableMissing, updateSystemsWorkingState } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ working_state: await getSystemsWorkingState() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load working state.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  try {
    const working_state = await updateSystemsWorkingState({
      version: body.version ? String(body.version) : undefined,
      current_checkpoint_id: body.current_checkpoint_id === null ? null : body.current_checkpoint_id ? String(body.current_checkpoint_id) : undefined,
      state: (body.state as Record<string, unknown>) || undefined,
    });
    return NextResponse.json({ working_state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update working state.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
