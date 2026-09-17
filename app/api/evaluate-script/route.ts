import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getOpenAI, matchKnowledgeBase, EVALUATION_MODEL } from "@/lib/knowledge";
import { asDroppedMarks, asStringList, type ScriptEvaluationReport } from "@/lib/script-evaluation";
import { studentUserFromAuth } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an expert SAICA/ICAZ/ICAN IAC Exam Evaluator. Analyze the student's Tier 1 Knowledge (~35%) vs. Tier 2 Application (~65%) score breakdown. Cross-reference the provided examiner context to explain why they lost application marks and provide 3 concrete action steps for structured articulation.

Return JSON only with this shape:
{
  "knowledge_summary": "string",
  "application_summary": "string",
  "dropped_marks_breakdown": [
    { "area": "string", "likely_loss": "string", "examiner_note": "string" }
  ],
  "coaching_recommendation": ["step 1", "step 2", "step 3"]
}`;

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Auth is read-only here.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to run a diagnostic." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const paper_name = String(body?.paper_name || "").trim();
  const question_code = String(body?.question_code || "").trim();
  const student_notes = String(body?.student_notes || "").trim();
  const tier1_earned = asNumber(body?.tier1_earned);
  const tier1_available = asNumber(body?.tier1_available);
  const tier2_earned = asNumber(body?.tier2_earned);
  const tier2_available = asNumber(body?.tier2_available);

  if (!paper_name || !question_code) {
    return NextResponse.json({ error: "Enter the paper name and question code." }, { status: 400 });
  }
  if ([tier1_earned, tier1_available, tier2_earned, tier2_available].some((n) => Number.isNaN(n) || n < 0)) {
    return NextResponse.json({ error: "Enter valid Tier 1 and Tier 2 marks." }, { status: 400 });
  }
  if (tier1_earned > tier1_available || tier2_earned > tier2_available) {
    return NextResponse.json({ error: "Earned marks cannot exceed available marks." }, { status: 400 });
  }

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set on the server." }, { status: 500 });
  }

  let matches: Awaited<ReturnType<typeof matchKnowledgeBase>> = [];
  try {
    matches = await matchKnowledgeBase(`${paper_name} ${question_code} IAC examiner commentary application marks`, 5);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge search failed.";
    if (/match_knowledge_base|schema cache|does not exist|vector/i.test(message)) {
      return NextResponse.json(
        { error: "Could not search the knowledge base. Paste supabase/knowledge_base.sql in the SQL editor first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const examinerContext = matches
    .map(
      (row, index) =>
        `Source ${index + 1} (${row.category} · ${row.document_title}, similarity ${row.similarity.toFixed(2)}):\n${row.content}`
    )
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: EVALUATION_MODEL,
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Paper: ${paper_name}`,
          `Question: ${question_code}`,
          `Tier 1 Knowledge: ${tier1_earned} / ${tier1_available} (~35% of the paper)`,
          `Tier 2 Application: ${tier2_earned} / ${tier2_available} (~65% of the paper)`,
          `Student notes: ${student_notes || "(none)"}`,
          "",
          "Examiner context retrieved from the knowledge base:",
          examinerContext || "(No matching examiner commentary was found. Reason from IAC marking principles anyway.)",
        ].join("\n"),
      },
    ],
  });

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content || "{}") as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const report: ScriptEvaluationReport = {
    knowledge_summary: String(parsed.knowledge_summary || "").trim() || "Knowledge marks were recorded, but the model returned no summary.",
    application_summary:
      String(parsed.application_summary || "").trim() || "Application marks were recorded, but the model returned no summary.",
    dropped_marks_breakdown: asDroppedMarks(parsed.dropped_marks_breakdown),
    coaching_recommendation: asStringList(parsed.coaching_recommendation).slice(0, 3),
  };
  while (report.coaching_recommendation.length < 3) {
    report.coaching_recommendation.push("Practise articulating the required using a planned structure before writing.");
  }

  const { data, error } = await supabase
    .from("script_evaluations")
    .insert({
      user_id: user.id,
      paper_name,
      question_code,
      tier1_earned,
      tier1_available,
      tier2_earned,
      tier2_available,
      student_notes,
      knowledge_summary: report.knowledge_summary,
      application_summary: report.application_summary,
      dropped_marks_breakdown: report.dropped_marks_breakdown,
      coaching_recommendation: report.coaching_recommendation,
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (/script_evaluations|schema cache|does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: "Could not save the evaluation. Paste supabase/knowledge_base.sql in the SQL editor first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data?.id,
    created_at: data?.created_at,
    paper_name,
    question_code,
    tier1_earned,
    tier1_available,
    tier2_earned,
    tier2_available,
    student_notes,
    student: studentUserFromAuth(user).email,
    sources: matches.map((row) => ({
      title: row.document_title,
      category: row.category,
      similarity: row.similarity,
    })),
    ...report,
  });
}
