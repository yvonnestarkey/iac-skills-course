import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { buildCalendarIcs } from "@/lib/calendar-feed";

// The browser owns the .ics generator, so it publishes the finished feed here
// and this route just hosts it for subscribers.
const FEED_DIR = path.join(process.cwd(), "calendars");
const TOKEN = /^[A-Za-z0-9_-]+$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function feedPath(raw: string): string | null {
  const token = raw.replace(/\.ics$/i, "");
  if (!TOKEN.test(token)) return null;
  return path.join(FEED_DIR, `${token}.ics`);
}

type Context = { params: Promise<{ token: string }> };

function calendarResponse(ics: string) {
  return new NextResponse(ics, {
    headers: {
      ...CORS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, must-revalidate",
    },
  });
}

export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  const file = feedPath(token);
  if (!file) return NextResponse.json({ error: "Bad feed token" }, { status: 400, headers: CORS });
  try {
    const ics = await fs.readFile(file, "utf8");
    return calendarResponse(ics);
  } catch {
    const origin = new URL(request.url).origin;
    const generated = await buildCalendarIcs(token.replace(/\.ics$/i, ""), origin);
    if (generated) return calendarResponse(generated);
    return NextResponse.json({ error: "No such feed" }, { status: 404, headers: CORS });
  }
}

export async function PUT(request: Request, { params }: Context) {
  const { token } = await params;
  const file = feedPath(token);
  if (!file) return NextResponse.json({ error: "Bad feed token" }, { status: 400, headers: CORS });
  const body = await request.text();
  if (!body.includes("BEGIN:VCALENDAR")) {
    return NextResponse.json({ error: "Not a calendar" }, { status: 422, headers: CORS });
  }
  await fs.mkdir(FEED_DIR, { recursive: true });
  await fs.writeFile(file, body, "utf8");
  return NextResponse.json({ ok: true, bytes: body.length }, { headers: CORS });
}

export { PUT as POST };

export async function DELETE(_request: Request, { params }: Context) {
  const { token } = await params;
  const file = feedPath(token);
  if (!file) return NextResponse.json({ error: "Bad feed token" }, { status: 400, headers: CORS });
  await fs.rm(file, { force: true });
  return NextResponse.json({ ok: true }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
