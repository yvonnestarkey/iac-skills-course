import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { toJsonl, toMarkdown } from "@/lib/eve-training/corpus";
import { loadTrainingCorpus } from "@/lib/eve-training/load";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Coach-only download of the anonymised Eve training corpus: ?format=jsonl (default) or ?format=md. */
export async function GET(request: NextRequest) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access only." }, { status: 403 });
  const client = getServiceSupabase();
  if (!client) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const { examples } = await loadTrainingCorpus(client);
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const md = request.nextUrl.searchParams.get("format") === "md";
  const body = md ? toMarkdown(examples, now) : toJsonl(examples);
  return new NextResponse(body, {
    headers: {
      "content-type": md ? "text/markdown; charset=utf-8" : "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="Eve training corpus ${day}.${md ? "md" : "jsonl"}"`,
      "cache-control": "no-store",
    },
  });
}
