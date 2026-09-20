import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const searchQuery = searchParams.get("query");
  const category = searchParams.get("category");
  const limitParam = searchParams.get("limit");

  if (!searchQuery) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 }
    );
  }

  const limit = Math.min(
    Math.max(parseInt(limitParam || "20", 10) || 20, 1),
    100
  );

  const { data, error } = await supabase.rpc("search_knowledge_base", {
    p_query: searchQuery,
    p_category: category || null,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data);
}
