import { NextResponse } from "next/server";
import { getSystemsModel, tableMissing } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSystemsModel());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the systems model.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    console.error("getSystemsModel", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
