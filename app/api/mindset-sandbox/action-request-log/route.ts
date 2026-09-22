import { NextResponse } from "next/server";
import { listActionRequests } from "@/lib/mindset-action-request-log";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: await listActionRequests() });
}
