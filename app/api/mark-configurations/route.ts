import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let paperName = searchParams.get("paper_name");

  let query = supabase.from("mark_configurations").select("*");

  if (paperName) {
    paperName = paperName.replace(/^(eq\.|ilike\.)/, "");
    query = query.ilike("paper_name", `%${paperName}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { searchParams } = new URL(req.url);
  let paperName = searchParams.get("paper_name");
  const body = await req.json();

  if (!paperName && body.paper_name) {
    paperName = body.paper_name;
  }

  if (!paperName) {
    return NextResponse.json({ error: "Missing paper_name parameter" }, { status: 400 });
  }

  paperName = paperName.replace(/^(eq\.|ilike\.)/, "");

  const { data, error } = await supabase
    .from("mark_configurations")
    .update({ config_json: body.config_json })
    .ilike("paper_name", `%${paperName}%`)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data[0] || { success: true }, { status: 200 });
}
