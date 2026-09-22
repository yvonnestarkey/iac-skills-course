import { getServiceSupabase } from "@/lib/supabase-admin";

const BUCKET = "course-pdfs";
const PATH = "internal/mindset-action-request-log.json";
const MAX_EVENTS = 30;

export type ActionRequestEvent = {
  at: string;
  route: string;
  method: string;
  path: string;
  query: string;
  content_type: string | null;
  accept: string | null;
  origin: string | null;
  user_agent: string | null;
  openai_conversation_id: string | null;
  openai_ephemeral_user_id: string | null;
  body: unknown;
  status: number;
  response_content_type: string | null;
  response_bytes: number;
  response_error: string | null;
};

function header(request: Request, name: string): string | null {
  return request.headers.get(name);
}

export async function peekRequestBody(request: Request): Promise<unknown> {
  const text = await request.clone().text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 800);
  }
}

export function requestMeta(request: Request) {
  const url = new URL(request.url);
  return {
    method: request.method,
    path: url.pathname,
    query: url.search.replace(/^\?/, ""),
    content_type: header(request, "content-type"),
    accept: header(request, "accept"),
    origin: header(request, "origin"),
    user_agent: header(request, "user-agent"),
    openai_conversation_id: header(request, "openai-conversation-id"),
    openai_ephemeral_user_id: header(request, "openai-ephemeral-user-id"),
  };
}

async function readEvents(): Promise<ActionRequestEvent[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const downloaded = await supabase.storage.from(BUCKET).download(PATH);
  if (downloaded.error || !downloaded.data) return [];
  const text = await downloaded.data.text();
  try {
    const parsed = JSON.parse(text) as { events?: ActionRequestEvent[] };
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

export async function recordActionRequest(event: Omit<ActionRequestEvent, "at">) {
  const row: ActionRequestEvent = { at: new Date().toISOString(), ...event };
  console.error("ACTION_REQUEST", JSON.stringify(row));
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return;
    const events = [...(await readEvents()), row].slice(-MAX_EVENTS);
    const uploaded = await supabase.storage.from(BUCKET).upload(PATH, JSON.stringify({ events }, null, 2), {
      upsert: true,
      contentType: "application/json",
    });
    if (uploaded.error) console.error("ACTION_REQUEST_LOG", uploaded.error.message);
  } catch (error) {
    console.error("ACTION_REQUEST_LOG", error);
  }
}

export async function listActionRequests() {
  return readEvents();
}

export function responseSummary(response: Response, body: unknown) {
  const encoded = typeof body === "string" ? body : JSON.stringify(body ?? null);
  const parsed = typeof body === "object" && body && "error" in body ? String((body as { error?: unknown }).error || "") : "";
  return {
    response_content_type: response.headers.get("content-type"),
    response_bytes: encoded ? Buffer.byteLength(encoded) : 0,
    response_error: parsed || null,
  };
}
