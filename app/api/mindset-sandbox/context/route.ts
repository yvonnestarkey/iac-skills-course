import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CONTEXT_COLUMNS = "context_type, title, version, source_filename, updated_at, content";
const CURRENT_TYPES = ["project_canon", "working_state"] as const;

type ContextType = (typeof CURRENT_TYPES)[number];

type ContextRecord = {
  context_type: ContextType;
  title: string;
  version: string;
  source_filename: string | null;
  updated_at: string;
  content: string;
};

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asRecord(row: Record<string, unknown>): ContextRecord | null {
  const contextType = String(row.context_type || "");
  if (contextType !== "project_canon" && contextType !== "working_state") return null;
  return {
    context_type: contextType,
    title: String(row.title || ""),
    version: String(row.version || ""),
    source_filename: row.source_filename ? String(row.source_filename) : null,
    updated_at: String(row.updated_at || ""),
    content: String(row.content || ""),
  };
}

export async function GET() {
  const supabase = supabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("mindset_sandbox_context")
    .select(CONTEXT_COLUMNS)
    .eq("status", "current")
    .in("context_type", [...CURRENT_TYPES]);

  if (error) {
    console.error("Mindset sandbox context fetch error:", error);
    return NextResponse.json({ error: "Could not load Mindset Sandbox context." }, { status: 500 });
  }

  const records = ((data || []) as Record<string, unknown>[]).map(asRecord).filter(Boolean) as ContextRecord[];
  const projectCanon = records.find((row) => row.context_type === "project_canon") || null;
  const workingState = records.find((row) => row.context_type === "working_state") || null;

  return NextResponse.json({
    project_canon: projectCanon,
    working_state: workingState,
  });
}
