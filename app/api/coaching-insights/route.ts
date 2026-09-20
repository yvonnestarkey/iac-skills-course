import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const INSIGHT_FIELDS = [
  "active",
  "category",
  "title",
  "tool_code",
  "diagnostic_routine",
  "diagnostic_outcome",
  "sub_sub_code",
  "coaching_rule",
  "mindset_ref",
  "vimeo_video_id",
  "course_ids",
  "saica_competency_mappings",
] as const;

function supabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function insightPayload(body: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!body) return null;
  const row: Record<string, unknown> = {};
  for (const field of INSIGHT_FIELDS) {
    if (field in body) row[field] = body[field];
  }
  if (!("active" in row)) row.active = true;
  const hasContent = Boolean(
    String(row.coaching_rule || "").trim() ||
      String(row.title || "").trim() ||
      String(row.tool_code || "").trim() ||
      String(row.diagnostic_routine || "").trim()
  );
  return hasContent ? row : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const payload = insightPayload(body);
    if (!payload) {
      return NextResponse.json(
        { error: "Provide a coaching_rule, title, tool_code, or diagnostic_routine." },
        { status: 400 }
      );
    }

    const supabase = supabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const { data, error } = await supabase.from("coaching_insights").insert(payload).select().maybeSingle();

    if (error) {
      console.error("Supabase fetch error:", error);
      return NextResponse.json({ error: error.message || JSON.stringify(error) }, { status: 500 });
    }

    return NextResponse.json({ insight: data }, { status: 201 });
  } catch (error) {
    console.error("Supabase fetch error:", error);
    const message = error instanceof Error ? error.message : "Could not save coaching insight.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
