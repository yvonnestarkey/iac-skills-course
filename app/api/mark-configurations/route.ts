import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function paperNameFrom(request: NextRequest, body?: Record<string, unknown> | null): string {
  const fromQuery = String(request.nextUrl.searchParams.get("paper_name") || "").trim();
  if (fromQuery) return fromQuery;
  return String(body?.paper_name || "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const paperName = paperNameFrom(request);
    if (!paperName) {
      return NextResponse.json({ error: "paper_name is required." }, { status: 400 });
    }

    const supabase = supabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("mark_configurations")
      .select("paper_name, config_json")
      .eq("paper_name", paperName)
      .maybeSingle();

    if (error) {
      console.error("Supabase fetch error:", error);
      return NextResponse.json({ error: error.message || JSON.stringify(error) }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Mark configuration not found." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Supabase fetch error:", error);
    const message = error instanceof Error ? error.message : "Could not load mark configuration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const paperName = paperNameFrom(request, body);
    if (!paperName) {
      return NextResponse.json({ error: "paper_name is required." }, { status: 400 });
    }
    if (!body || !("config_json" in body)) {
      return NextResponse.json({ error: "config_json is required." }, { status: 400 });
    }

    const supabase = supabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("mark_configurations")
      .update({ config_json: body.config_json })
      .eq("paper_name", paperName)
      .select("paper_name, config_json")
      .maybeSingle();

    if (error) {
      console.error("Supabase fetch error:", error);
      return NextResponse.json({ error: error.message || JSON.stringify(error) }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Mark configuration not found." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Supabase fetch error:", error);
    const message = error instanceof Error ? error.message : "Could not update mark configuration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
