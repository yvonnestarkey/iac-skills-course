import { NextResponse } from "next/server";
import { getSystemsModel, tableMissing } from "@/lib/systems-model";
import { peekRequestBody, recordActionRequest, requestMeta, responseSummary } from "@/lib/mindset-action-request-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function readModel() {
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

async function handle(request: Request) {
  const body = await peekRequestBody(request);
  const response = await readModel();
  const payload = await response.clone().json().catch(() => null);
  await recordActionRequest({
    route: "systems-model",
    ...requestMeta(request),
    body,
    status: response.status,
    ...responseSummary(response, payload),
  });
  return response;
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function OPTIONS(request: Request) {
  await recordActionRequest({
    route: "systems-model",
    ...requestMeta(request),
    body: await peekRequestBody(request),
    status: 204,
    response_content_type: null,
    response_bytes: 0,
    response_error: null,
  });
  return new NextResponse(null, { status: 204, headers: { Allow: "GET, HEAD, OPTIONS, POST" } });
}
