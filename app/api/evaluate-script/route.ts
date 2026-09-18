import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getOpenAI, matchKnowledgeBase, EVALUATION_MODEL } from "@/lib/knowledge";
import {
  APPLICATION_WEIGHT,
  KNOWLEDGE_WEIGHT,
  diagnosticReportSchema,
  firstPersonLeakSummary,
  mergeModelReport,
  parseQuestionBlocks,
  reportToStorage,
  summariseBlocks,
  withQuestionStats,
} from "@/lib/diagnostic-report";
import { studentUserFromAuth } from "@/lib/student-lesson";
import { sectionCapError } from "@/lib/exam-structure";
import { fetchDiagnosticProgress, formatMarkReportContext } from "@/lib/diagnostic-progress";
import { fetchLatestBmcr, fetchLatestVolumeAccuracy, formatBmcrContext, formatVolumeContext } from "@/lib/volume-accuracy";
import { fetchLatestBuriedTreasure, formatBuriedTreasureContext } from "@/lib/buried-treasure";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an expert SAICA/ICAZ/ICAN IAC Exam Evaluator.

Evaluate candidate scripts by explicitly separating marks into:
- Tier 1 Knowledge (~35%): general theory, IFRS/Tax definitions, standards listing, or generic steps.
- Tier 2 Application (~65%): scenario-linked facts, calculations, context-specific judgment, and practical synthesis.

Use the supplied mark splits. Do not recalculate Tier 1 or Tier 2 earned marks, max available, or percentages. Call the official section allocation Total Marks — never Available Marks.

For each question the user message already computes:
- Tier 1 Marks Earned vs Tier 1 Max Available
- Tier 2 Marks Earned vs Tier 2 Max Available
- Primary Mark Leakage Reason: exactly one of "Theory gap", "Scenario application gap", or "Incomplete depth"
- The required first-person diagnostic sentence

Copy that sentence verbatim into first_person_summary and set primary_leakage to the supplied reason. Then, in first person (I found..., I identified...), explain what they got right versus where marks leaked, consistent with that Primary Mark Leakage Reason. Each question's diagnosis must open with:
"Out of [Total Marks] in [Question Code], I identified [X] Tier 1 Knowledge marks and [Y] Tier 2 Application marks. You earned [A] on Knowledge and [B] on Application. Your main mark leak was [Primary Gap]."

Volume vs Accuracy rules (use the supplied ratios; do not recompute them):
- Volume % = (Points Wrote / Total Marks) * 100
- Accuracy % = (Marks You Got / Points Wrote) * 100
- Calculation/disclosure sections have Points Wrote = N/A. Do not use them in volume or accuracy ratios. Tag them N/A - Calculation.
If Volume % < 100% AND Accuracy % >= 65%, tag Volume Deficit: high point accuracy, but fewer points than Total Marks; they must expand breadth/depth to reach full mark potential.
If Volume % >= 100% AND Accuracy % < 50%, tag Accuracy Deficit: sufficient point volume, but low accuracy per point; they must write precise, scenario-locked technical statements.
Otherwise tag discussion sections Optimal. Use the supplied diagnostic tags when present.

Buried Treasure (case-study conversion) rules — use the supplied percentages; do not recompute them:
- Tier 1 Direct Marks (~10% / ~36 marks, target >= 80%): straight scenario extraction (given numbers, figures, share counts, dates).
- Tier 2 Indirect Marks (~35-40% / ~130 marks, target >= 60%): scenario trigger + small leap (15/115 VAT fraction, control weaknesses, Hamada beta un-levering).
- Tier 3 Thinking Marks (~50-55% / ~194 marks, target >= 50%): deeper reasoning and execution (journal entries, multi-stakeholder memos, scenario-locked audit steps).
If Tier 1 Direct conversion is below 80%, they are not extracting buried treasure from the scenario (theory/extraction gap).
If Tier 1 is at or above 80% and Tier 3 Thinking conversion is below 50%, diagnose a Tier 3 execution gap, not a theory gap.
The final report must explicitly say whether the student suffers from a theory gap or a Tier 3 execution gap using these conversion rates.

Incorporate writing volume, accuracy, BMCR mark capture, Buried Treasure conversion, and the uploaded mark-report context. Set primary_blocker to theory, execution, or both. Give exactly 3 concrete skill drills.`;

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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const paper_name = String(body?.paper_name || "").trim();
  const student_notes = String(body?.student_notes || "").trim();
  const blocks = parseQuestionBlocks(body);

  if (!paper_name) {
    return NextResponse.json({ error: "Enter the paper name." }, { status: 400 });
  }
  if (!blocks.length) {
    return NextResponse.json({ error: "Enter at least one question block with valid Tier 1 and Tier 2 marks." }, { status: 400 });
  }
  for (const block of blocks) {
    const capError = sectionCapError(
      block.question_code,
      block.tier1_available + block.tier2_available,
      block.tier1_earned + block.tier2_earned
    );
    if (capError) {
      return NextResponse.json({ error: capError }, { status: 400 });
    }
  }

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set on the server." }, { status: 500 });
  }

  const totals = summariseBlocks(blocks);
  const scoredBlocks = blocks.map((block) => withQuestionStats(block));
  const questionQuery = blocks.map((block) => block.question_code).join(" ");
  const progress = await fetchDiagnosticProgress(supabase, user.id).catch(() => null);
  if (!progress?.ready) {
    return NextResponse.json(
      {
        error:
          "Complete the BMCR Tool, Volume vs Accuracy, Buried Treasure, and upload your mark report before generating the AI evaluation.",
      },
      { status: 400 }
    );
  }
  const latestBmcr = await fetchLatestBmcr(supabase, user.id).catch(() => null);
  const latestVolume = await fetchLatestVolumeAccuracy(supabase, user.id).catch(() => null);
  const latestBuriedTreasure = await fetchLatestBuriedTreasure(supabase, user.id).catch(() => null);
  const diagnosticContext = [
    formatBmcrContext(latestBmcr),
    formatVolumeContext(latestVolume),
    formatBuriedTreasureContext(latestBuriedTreasure),
    formatMarkReportContext(progress.markReport),
  ].join("\n\n");

  let matches: Awaited<ReturnType<typeof matchKnowledgeBase>> = [];
  try {
    matches = await matchKnowledgeBase(`${paper_name} ${questionQuery} IAC examiner commentary application marks`, 5);
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
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: diagnosticReportSchema.name,
        strict: true,
        schema: diagnosticReportSchema.schema as unknown as Record<string, unknown>,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Paper: ${paper_name}`,
          `Overall total: ${totals.total_earned} / ${totals.total_available} (${totals.total_score_pct}%)`,
          `Tier 1 Knowledge (~${Math.round(KNOWLEDGE_WEIGHT * 100)}%): ${totals.tier1_earned} / ${totals.tier1_available} (${totals.knowledge_pct}%)`,
          `Tier 2 Application (~${Math.round(APPLICATION_WEIGHT * 100)}%): ${totals.tier2_earned} / ${totals.tier2_available} (${totals.application_pct}%)`,
          `Calculated primary blocker: ${totals.primary_blocker}`,
          `Student notes: ${student_notes || "(none)"}`,
          "",
          "Pre-exam diagnostic context (BMCR, Volume vs Accuracy, Buried Treasure, mark report upload):",
          diagnosticContext,
          "",
          "Question blocks with calculated Tier 1 Knowledge (~35%) vs Tier 2 Application (~65%) splits:",
          ...scoredBlocks.map((block) =>
            [
              `${block.question_code}:`,
              `- Total Marks: ${block.available_marks}`,
              `- Tier 1 Knowledge: ${block.tier1_earned} earned vs ${block.tier1_available} max available (${block.knowledge_earned_pct}%)`,
              `- Tier 2 Application: ${block.tier2_earned} earned vs ${block.tier2_available} max available (${block.application_earned_pct}%)`,
              `- Question total: ${block.question_total} / ${block.available_marks} (${block.question_total_pct}%)`,
              `- Primary Mark Leakage Reason: ${block.primary_leakage}`,
              `- Required first-person sentence: ${firstPersonLeakSummary(block, block.primary_leakage)}`,
            ].join("\n")
          ),
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

  const report = mergeModelReport(paper_name, student_notes, blocks, parsed);
  const stored = reportToStorage(report);

  const { data, error } = await supabase
    .from("script_evaluations")
    .insert({
      user_id: user.id,
      ...stored,
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
    student: studentUserFromAuth(user).email,
    sources: matches.map((row) => ({
      title: row.document_title,
      category: row.category,
      similarity: row.similarity,
    })),
    ...report,
    knowledge_summary: report.knowledge_summary,
    application_summary: report.application_summary,
    dropped_marks_breakdown: report.questions.map((question) => ({
      area: question.question_code,
      likely_loss: question.lost_marks.join("; "),
      examiner_note: question.got_right.join("; "),
    })),
    coaching_recommendation: report.skill_drills,
  });
}
