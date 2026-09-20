import { NextResponse } from "next/server";
import { getSystemsModelEvidence, tableMissing } from "@/lib/systems-model";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const recordId = new URL(request.url).searchParams.get("record_id") || undefined;
  try {
    return NextResponse.json(await getSystemsModelEvidence(recordId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load systems evidence.";
    if (tableMissing(message)) {
      return NextResponse.json({ error: "Systems model tables are not installed yet." }, { status: 503 });
    }
    console.error("getSystemsModelEvidence", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
