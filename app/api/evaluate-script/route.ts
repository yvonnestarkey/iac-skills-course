import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getOpenAI, matchKnowledgeBase, EVALUATION_MODEL } from "@/lib/knowledge";
import {
  APPLICATION_WEIGHT,
  KNOWLEDGE_WEIGHT,
  asStringList,
  firstPersonLeakSummary,
  mergeModelReport,
  parseQuestionBlocks,
  reportToStorage,
  summariseBlocks,
  withQuestionStats,
} from "@/lib/diagnostic-report";
import { sectionCapError } from "@/lib/exam-structure";
import { fetchDiagnosticProgress, formatMarkReportContext } from "@/lib/diagnostic-progress";
import { fetchLatestBmcr, fetchLatestVolumeAccuracy, formatBmcrContext, formatVolumeContext } from "@/lib/volume-accuracy";
import { BURIED_TREASURE_TIERS, fetchLatestBuriedTreasure, formatBuriedTreasureContext, type BuriedTreasureLog } from "@/lib/buried-treasure";
import {
  computeBuriedTreasureDiagnostics,
  calculateMarksForPaper,
  formatBuriedTreasureDiagnostics,
  type MarkTierInput,
} from "@/lib/buried-treasure-calculator";
import {
  findPastPaper,
  paperBuriedTreasureCaps,
  pastPaperDisplayName,
  pastPaperSectionCapError,
  type PastPaper,
} from "@/lib/past-papers";
import { evaluateCompetencyBreakdown, formatCompetencyBreakdown } from "@/lib/competency-evaluator";
import { BURIED_TREASURE_FRAMEWORK_PROMPT, BURIED_TREASURE_SYSTEM_PROMPT } from "@/lib/prompts/buried-treasure";
import type { BuriedTreasureAnalysis, TierScore } from "@/types/evaluation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CLAUDE_SCRIPT_MODEL = "claude-3-5-sonnet-20241022";
const CLAUDE_PAGE_LIMIT = 20;
const SCRIPT_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

const CASE_STUDY_PROXIMITY_OUTPUT = `You MUST respond with a single JSON object (no markdown fences). Structure:

{
  "paper_name": string,
  "handwriting": { "legibility": "good" | "fair" | "poor", "notes": string },
  "qualitative_facts": string[],
  "directMarks": { "available": number, "earned": number, "percentage": number, "notes": string },
  "indirectMarks": { "available": number, "earned": number, "percentage": number, "notes": string },
  "thinkingMarks": { "available": number, "earned": number, "percentage": number, "notes": string },
  "saicaComparison": { "aligned": string[], "missed": string[], "incorrect": string[] },
  "hasTheoryGap": boolean,
  "primaryFailureCause": "THEORY_GAP" | "EXECUTION_GAP" | "BREADTH_OMISSION" | "MECHANICS_FAILURE",
  "diagnosticHeadline": string,
  "keyTakeaways": string[],
  "actionPlan": string[],
  "fullReportMarkdown": string
}

Evaluate the handwritten script pages: read the writing, extract qualitative facts the student used, and compare those facts and workings against the SAICA solution / mark plan and Eve coaching rules supplied in the user message.`;

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function imageMediaType(contentType: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (contentType.includes("png")) return "image/png";
  if (contentType.includes("webp")) return "image/webp";
  if (contentType.includes("gif")) return "image/gif";
  return "image/jpeg";
}

async function fetchExamContext(paperName: string) {
  const supabase = serviceSupabase();
  if (!supabase) {
    return { markConfiguration: null as unknown, coachingRules: [] as unknown[], saicaSolution: [] as unknown[] };
  }

  const [{ data: markRows }, { data: ruleRows }, { data: solutionRows }] = await Promise.all([
    supabase.from("mark_configurations").select("*").ilike("paper_name", `%${paperName}%`),
    supabase
      .from("coaching_insights")
      .select("title, tool_code, category, coaching_rule, diagnostic_routine, diagnostic_outcome")
      .eq("active", true)
      .limit(40),
    supabase
      .from("knowledge_base")
      .select("document_title, category, content")
      .or(
        [
          `document_title.ilike.%${paperName}%`,
          `content.ilike.%${paperName}%`,
          "category.ilike.%solution%",
          "category.ilike.%mark plan%",
          "category.ilike.%mark_plan%",
        ].join(",")
      )
      .limit(8),
  ]);

  return {
    markConfiguration: markRows?.[0] ?? null,
    coachingRules: ruleRows ?? [],
    saicaSolution: solutionRows ?? [],
  };
}

type ScriptPage = {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
  page: number;
};

function isPdfBytes(bytes: Buffer, contentType: string) {
  return contentType.includes("pdf") || bytes.subarray(0, 4).toString() === "%PDF";
}

async function scriptPagesFromUrls(urls: string[]): Promise<ScriptPage[]> {
  const pages: ScriptPage[] = [];
  for (const [index, url] of urls.slice(0, CLAUDE_PAGE_LIMIT).entries()) {
    if (!url) continue;
    const remote = await fetch(url);
    if (!remote.ok) continue;
    const bytes = Buffer.from(await remote.arrayBuffer());
    pages.push({
      mediaType: imageMediaType(remote.headers.get("content-type") || "image/jpeg"),
      data: bytes.toString("base64"),
      page: index + 1,
    });
  }
  return pages;
}

async function scriptPagesFromAttempt(
  supabase: { from: (table: string) => { select: (columns: string) => any } },
  attemptId: string,
  userId: string
): Promise<ScriptPage[]> {
  const { data } = await supabase
    .from("exam_attempts")
    .select("page_images")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  const packed = data && typeof data === "object" ? (data as { page_images?: { marked_script?: Array<{ url?: string; page?: number }> } }).page_images : null;
  const images = packed?.marked_script;
  if (!Array.isArray(images) || !images.length) return [];
  const pages: ScriptPage[] = [];
  for (const image of images.slice(0, CLAUDE_PAGE_LIMIT)) {
    const url = String(image?.url || "").trim();
    if (!url) continue;
    const remote = await fetch(url);
    if (!remote.ok) continue;
    const bytes = Buffer.from(await remote.arrayBuffer());
    pages.push({
      mediaType: imageMediaType(remote.headers.get("content-type") || "image/jpeg"),
      data: bytes.toString("base64"),
      page: Number(image.page) || pages.length + 1,
    });
  }
  return pages;
}

function scriptPagesFromImageBytes(bytes: Buffer, contentType: string): ScriptPage[] {
  return [
    {
      mediaType: imageMediaType(contentType),
      data: bytes.toString("base64"),
      page: 1,
    },
  ];
}

async function evaluateScriptWithClaude(input: {
  paperName: string;
  pages: ScriptPage[];
  pdfBase64?: string;
  markConfiguration: unknown;
  coachingRules: unknown[];
  saicaSolution: unknown[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const imageBlocks: ImageBlockParam[] = input.pages.map((page) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: page.mediaType,
      data: page.data,
    },
  }));
  const documentBlock = input.pdfBase64
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: input.pdfBase64,
        },
      }
    : null;
  const attachmentNote = input.pages.length
    ? `Script pages attached: ${input.pages.length} (${input.pages.map((page) => page.page).join(", ")}).`
    : "Handwritten script PDF attached.";

  const completion = await anthropic.messages.create({
    model: CLAUDE_SCRIPT_MODEL,
    max_tokens: 4096,
    temperature: 0.2,
    system: `${BURIED_TREASURE_FRAMEWORK_PROMPT.trim()}\n\n${CASE_STUDY_PROXIMITY_OUTPUT}`,
    messages: [
      {
        role: "user",
        content: [
          ...(documentBlock ? [documentBlock] : imageBlocks),
          {
            type: "text",
            text: [
              `Paper: ${input.paperName}`,
              attachmentNote,
              "",
              "Exam mark configuration from Supabase:",
              JSON.stringify(input.markConfiguration ?? {}, null, 2).slice(0, 12000),
              "",
              "Eve coaching rules from coaching_insights:",
              JSON.stringify(input.coachingRules, null, 2).slice(0, 12000),
              "",
              "SAICA solution / mark-plan excerpts from the knowledge base:",
              JSON.stringify(input.saicaSolution, null, 2).slice(0, 16000),
              "",
              "Read the handwritten script. Extract the qualitative facts the student used. Score Direct / Indirect / Thinking against the mark configuration and compare the answer to the SAICA solution. Return only the JSON object.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const text = completion.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(text) as Record<string, unknown>;
}

async function loadUploadedScript(request: NextRequest, jsonBody: Record<string, unknown> | null) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const paperName = String(form.get("paper_name") || "").trim();
    const attemptId = String(form.get("attempt_id") || "").trim();
    const userId = String(form.get("user_id") || "").trim();
    const pageImageUrls = String(form.get("page_image_urls") || "")
      .split(/\n|,/)
      .map((url) => url.trim())
      .filter(Boolean);
    const uploaded = form.get("file") || form.get("script") || form.get("script_file");
    const fileUrl = String(form.get("file_url") || form.get("script_url") || "").trim();
    if (uploaded instanceof File && uploaded.size > 0) {
      return {
        paperName,
        attemptId,
        userId,
        pageImageUrls,
        bytes: Buffer.from(await uploaded.arrayBuffer()),
        contentType: uploaded.type || "application/octet-stream",
        fileName: uploaded.name,
      };
    }
    if (fileUrl || pageImageUrls.length) {
      if (!fileUrl) {
        return {
          paperName,
          attemptId,
          userId,
          pageImageUrls,
          bytes: Buffer.alloc(0),
          contentType: "application/octet-stream",
          fileName: "script",
        };
      }
      const remote = await fetch(fileUrl);
      if (!remote.ok) throw new Error("Could not download the script file URL.");
      return {
        paperName,
        attemptId,
        userId,
        pageImageUrls,
        bytes: Buffer.from(await remote.arrayBuffer()),
        contentType: remote.headers.get("content-type") || "application/octet-stream",
        fileName: fileUrl.split("/").pop() || "script",
      };
    }
    return null;
  }

  const fileUrl = String(jsonBody?.file_url || jsonBody?.script_url || jsonBody?.script_file_url || "").trim();
  const paperName = String(jsonBody?.paper_name || "").trim();
  const attemptId = String(jsonBody?.attempt_id || "").trim();
  const userId = String(jsonBody?.user_id || "").trim();
  const pageImageUrls = Array.isArray(jsonBody?.page_image_urls)
    ? jsonBody.page_image_urls.map((url) => String(url || "").trim()).filter(Boolean)
    : [];
  if (!fileUrl && !pageImageUrls.length && !attemptId) return null;
  if (!fileUrl) {
    return {
      paperName,
      attemptId,
      userId,
      pageImageUrls,
      bytes: Buffer.alloc(0),
      contentType: "application/octet-stream",
      fileName: "script",
    };
  }
  const remote = await fetch(fileUrl);
  if (!remote.ok) throw new Error("Could not download the script file URL.");
  return {
    paperName,
    attemptId,
    userId,
    pageImageUrls,
    bytes: Buffer.from(await remote.arrayBuffer()),
    contentType: remote.headers.get("content-type") || "application/octet-stream",
    fileName: fileUrl.split("/").pop() || "script",
  };
}

function asScore(value: unknown) {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    earned: asFiniteNumber(row.earned) ?? 0,
    available: asFiniteNumber(row.available) ?? 0,
    percentage: asFiniteNumber(row.percentage) ?? 0,
  };
}

function claudeEvaluationRow(userId: string, paperName: string, evaluation: Record<string, unknown>) {
  const direct = asScore(evaluation.directMarks);
  const indirect = asScore(evaluation.indirectMarks);
  const thinking = asScore(evaluation.thinkingMarks);
  const takeaways = asStringList(evaluation.keyTakeaways);
  const actions = asStringList(evaluation.actionPlan);
  const facts = asStringList(evaluation.qualitative_facts);
  return {
    user_id: userId,
    paper_name: paperName,
    question_code: paperName,
    created_at: new Date().toISOString(),
    tier1_earned: direct.earned + indirect.earned,
    tier1_available: direct.available + indirect.available,
    tier2_earned: thinking.earned,
    tier2_available: thinking.available,
    tier1_direct_pct: direct.percentage,
    tier2_indirect_pct: indirect.percentage,
    tier3_thinking_pct: thinking.percentage,
    student_notes: facts.join("\n"),
    knowledge_summary: String(evaluation.diagnosticHeadline || ""),
    application_summary: takeaways.join(" "),
    diagnostic_summary: String(evaluation.fullReportMarkdown || evaluation.diagnosticHeadline || ""),
    primary_failure_cause: String(evaluation.primaryFailureCause || ""),
    coaching_recommendation: actions,
    dropped_marks_breakdown: evaluation,
    raw_student_responses: {
      qualitative_facts: facts,
      handwriting: evaluation.handwriting ?? null,
    },
    competency_breakdown: evaluation.saicaComparison ?? null,
  };
}

const FAILURE_CAUSES = ["THEORY_GAP", "EXECUTION_GAP", "BREADTH_OMISSION", "MECHANICS_FAILURE"] as const;
type FailureCause = (typeof FAILURE_CAUSES)[number];

const OUTPUT_SCHEMA_INSTRUCTIONS = `You MUST respond with a single JSON object (no markdown fences, no extra keys wrapped around it). The object must use this exact structure:

{
  "directMarks": { "available": number, "earned": number, "percentage": number },
  "indirectMarks": { "available": number, "earned": number, "percentage": number },
  "thinkingMarks": { "available": number, "earned": number, "percentage": number },
  "knowledgeScore": { "available": number, "earned": number, "percentage": number },
  "applicationScore": { "available": number, "earned": number, "percentage": number },
  "macroCommScore": { "available": number, "earned": number, "percentage": number },
  "hasTheoryGap": boolean,
  "primaryFailureCause": "THEORY_GAP" | "EXECUTION_GAP" | "BREADTH_OMISSION" | "MECHANICS_FAILURE",
  "diagnosticHeadline": string,
  "keyTakeaways": string[],
  "actionPlan": string[],
  "fullReportMarkdown": string
}

Field meaning:
- directMarks = Tier 1 Direct Marks
- indirectMarks = Tier 2 Indirect Marks
- thinkingMarks = Tier 3 Thinking Marks
- knowledgeScore = Tier 1 + Tier 2 combined
- applicationScore = Tier 3
- macroCommScore = standalone X1 / layout / presentation marks
- fullReportMarkdown = a supportive, brutally honest first-person Buried Treasure coaching report that explicitly links Volume/Accuracy trends with Buried Treasure conversion and includes the SAICA Competency Area performance table plus competency diagnostics`;

const SYSTEM_PROMPT = `${BURIED_TREASURE_SYSTEM_PROMPT.trim()}

${OUTPUT_SCHEMA_INSTRUCTIONS}`;

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTierScore(value: unknown, fallback?: TierScore | null): TierScore | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const available = asFiniteNumber(row.available) ?? fallback?.available ?? null;
  const earned = asFiniteNumber(row.earned) ?? fallback?.earned ?? null;
  if (available == null || earned == null) return null;
  const percentage = asFiniteNumber(row.percentage);
  return {
    available,
    earned,
    percentage: percentage ?? (available > 0 ? Math.round((earned / available) * 1000) / 10 : 0),
  };
}

function parseFailureCause(value: unknown, hasTheoryGap: boolean, thinkingPct: number): FailureCause {
  const cause = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if ((FAILURE_CAUSES as readonly string[]).includes(cause)) return cause as FailureCause;
  if (hasTheoryGap) return "THEORY_GAP";
  if (thinkingPct < 45) return "EXECUTION_GAP";
  return "BREADTH_OMISSION";
}

function unwrapAnalysisPayload(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed.directMarks || parsed.thinkingMarks) return parsed;
  for (const key of ["evaluation", "analysis", "buriedTreasure", "buried_treasure"]) {
    const nested = parsed[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return parsed;
}

function parseBuriedTreasureAnalysis(
  parsed: Record<string, unknown>,
  diagnostics: ReturnType<typeof computeBuriedTreasureDiagnostics>
): BuriedTreasureAnalysis | null {
  const source = unwrapAnalysisPayload(parsed);
  const directMarks = parseTierScore(source.directMarks, diagnostics.directMarks) || diagnostics.directMarks;
  const indirectMarks = parseTierScore(source.indirectMarks, diagnostics.indirectMarks) || diagnostics.indirectMarks;
  const thinkingMarks = parseTierScore(source.thinkingMarks, diagnostics.thinkingMarks) || diagnostics.thinkingMarks;

  const knowledgeScore =
    parseTierScore(source.knowledgeScore, diagnostics.knowledgeScore) || diagnostics.knowledgeScore;
  const applicationScore =
    parseTierScore(source.applicationScore, diagnostics.applicationScore) || diagnostics.applicationScore;
  const macroCommScore =
    parseTierScore(source.macroCommScore, diagnostics.macroCommScore) || diagnostics.macroCommScore;

  const hasTheoryGap =
    typeof source.hasTheoryGap === "boolean" ? source.hasTheoryGap : diagnostics.hasTheoryGap;
  const primaryFailureCause = parseFailureCause(
    source.primaryFailureCause,
    hasTheoryGap,
    thinkingMarks.percentage
  );
  const diagnosticHeadline = String(source.diagnosticHeadline || diagnostics.diagnosticHeadline || "").trim();
  const fullReportMarkdown = String(source.fullReportMarkdown || "").trim();
  if (!diagnosticHeadline || !fullReportMarkdown) return null;

  return {
    directMarks,
    indirectMarks,
    thinkingMarks,
    knowledgeScore,
    applicationScore,
    macroCommScore,
    hasTheoryGap,
    primaryFailureCause,
    diagnosticHeadline,
    keyTakeaways: asStringList(source.keyTakeaways),
    actionPlan: asStringList(source.actionPlan),
    fullReportMarkdown,
  };
}

function blockerFromCause(cause: FailureCause): "theory" | "execution" | "both" {
  if (cause === "THEORY_GAP") return "theory";
  if (cause === "BREADTH_OMISSION") return "both";
  return "execution";
}

function asMarkNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sumQuestionBuriedTreasureEarned(body: Record<string, unknown> | null): {
  direct: number;
  indirect: number;
  thinking: number;
} | null {
  const raw = Array.isArray(body?.questions) ? body.questions : [];
  let sawTierMarks = false;
  let direct = 0;
  let indirect = 0;
  let thinking = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.direct_earned != null || row.indirect_earned != null || row.thinking_earned != null) {
      sawTierMarks = true;
    }
    direct += asMarkNumber(row.direct_earned, 0);
    indirect += asMarkNumber(row.indirect_earned, 0);
    thinking += asMarkNumber(row.thinking_earned, 0);
  }
  return sawTierMarks ? { direct, indirect, thinking } : null;
}

function buriedTreasureMarkInput(
  body: Record<string, unknown> | null,
  log: BuriedTreasureLog | null,
  paper: PastPaper | null
): MarkTierInput {
  const nested =
    body?.buried_treasure && typeof body.buried_treasure === "object"
      ? (body.buried_treasure as Record<string, unknown>)
      : body || {};
  const caps = paper ? paperBuriedTreasureCaps(paper) : null;
  const earnedFromQuestions = sumQuestionBuriedTreasureEarned(body);
  const macroAvailable = asMarkNumber(
    nested.macro_comm_available ?? nested.macroCommAvailable ?? nested.x1_available,
    0
  );
  const macroEarned = asMarkNumber(nested.macro_comm_earned ?? nested.macroCommEarned ?? nested.x1_earned, 0);
  return {
    directMarks: {
      available: asMarkNumber(
        nested.direct_available ?? nested.tier1_available,
        caps?.direct_available ?? log?.tier1_available ?? BURIED_TREASURE_TIERS[0].available
      ),
      earned: asMarkNumber(
        nested.direct_earned ?? nested.tier1_earned,
        earnedFromQuestions?.direct ?? log?.tier1_earned ?? 0
      ),
    },
    indirectMarks: {
      available: asMarkNumber(
        nested.indirect_available ?? nested.tier2_available,
        caps?.indirect_available ?? log?.tier2_available ?? BURIED_TREASURE_TIERS[1].available
      ),
      earned: asMarkNumber(
        nested.indirect_earned ?? nested.tier2_earned,
        earnedFromQuestions?.indirect ?? log?.tier2_earned ?? 0
      ),
    },
    thinkingMarks: {
      available: asMarkNumber(
        nested.thinking_available ?? nested.tier3_available,
        caps?.thinking_available ?? log?.tier3_available ?? BURIED_TREASURE_TIERS[2].available
      ),
      earned: asMarkNumber(
        nested.thinking_earned ?? nested.tier3_earned,
        earnedFromQuestions?.thinking ?? log?.tier3_earned ?? 0
      ),
    },
    macroCommMarks: macroAvailable > 0 ? { available: macroAvailable, earned: macroEarned } : undefined,
  };
}

function studentSectionMarksFromBody(body: Record<string, unknown> | null): Record<string, number> {
  const marks: Record<string, number> = {};
  const raw = Array.isArray(body?.questions) ? body.questions : [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const code = String(row.question_code || "").trim();
    if (!code) continue;
    const direct = asMarkNumber(row.direct_earned, 0);
    const indirect = asMarkNumber(row.indirect_earned, 0);
    const thinking = asMarkNumber(row.thinking_earned, 0);
    const macro = asMarkNumber(row.macro_comm_earned ?? row.macroCommEarned, 0);
    marks[`${code}.direct`] = direct;
    marks[`${code}.indirect`] = indirect;
    marks[`${code}.thinking`] = thinking;
    marks[`${code}.macroComm`] = macro;
    marks[code] = asMarkNumber(row.earned_marks ?? row.marks_got, direct + indirect + thinking + macro);
  }
  return marks;
}

function applyDeterministicMetrics(
  analysis: BuriedTreasureAnalysis,
  diagnostics: ReturnType<typeof computeBuriedTreasureDiagnostics>
): BuriedTreasureAnalysis {
  return {
    ...analysis,
    directMarks: diagnostics.directMarks,
    indirectMarks: diagnostics.indirectMarks,
    thinkingMarks: diagnostics.thinkingMarks,
    knowledgeScore: diagnostics.knowledgeScore,
    applicationScore: diagnostics.applicationScore,
    macroCommScore: diagnostics.macroCommScore,
    hasTheoryGap: diagnostics.hasTheoryGap,
    primaryFailureCause: diagnostics.primaryFailureCause,
    diagnosticHeadline: analysis.diagnosticHeadline || diagnostics.diagnosticHeadline,
  };
}

export async function POST(request: NextRequest) {
  try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ success: false, error: "Supabase is not configured." }, { status: 500 });
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

  const contentType = request.headers.get("content-type") || "";
  const body = contentType.includes("multipart/form-data")
    ? null
    : ((await request.json().catch(() => null)) as Record<string, unknown> | null);

    const uploaded = await loadUploadedScript(request, body);
    if (uploaded) {
      const paperName = uploaded.paperName || String(body?.paper_name || "").trim();
      if (!paperName) {
        return NextResponse.json({ error: "Enter the paper name or select a past paper." }, { status: 400 });
      }
      const isPdf = uploaded.bytes.length > 0 && isPdfBytes(uploaded.bytes, uploaded.contentType);
      const isImage = uploaded.bytes.length > 0 && SCRIPT_IMAGE_TYPES.has(uploaded.contentType.toLowerCase());
      let pages =
        uploaded.pageImageUrls.length > 0
          ? await scriptPagesFromUrls(uploaded.pageImageUrls)
          : uploaded.attemptId
            ? await scriptPagesFromAttempt(supabase, uploaded.attemptId, user.id)
            : [];
      if (!pages.length && isImage) {
        pages = scriptPagesFromImageBytes(uploaded.bytes, uploaded.contentType);
      }
      const pdfBase64 = !pages.length && isPdf ? uploaded.bytes.toString("base64") : undefined;
      if (!pages.length && !pdfBase64) {
        return NextResponse.json(
          { error: "Upload a script PDF or image, or wait until the page scans have been stored." },
          { status: 400 }
        );
      }

      const context = await fetchExamContext(paperName);
      const evaluation = await evaluateScriptWithClaude({
        paperName,
        pages,
        pdfBase64,
        markConfiguration: context.markConfiguration,
        coachingRules: context.coachingRules,
        saicaSolution: context.saicaSolution,
      });

      const { data: saved, error: saveError } = await supabase
        .from("script_evaluations")
        .insert(claudeEvaluationRow(user.id, paperName, evaluation))
        .select("id")
        .maybeSingle();
      if (saveError) {
        throw new Error(saveError.message);
      }

      const attemptId = uploaded.attemptId || String(body?.attempt_id || "").trim();
      if (saved?.id && attemptId) {
        await supabase
          .from("exam_attempts")
          .update({ evaluation_id: saved.id, updated_at: new Date().toISOString() })
          .eq("id", attemptId)
          .eq("user_id", user.id);
      }

      return NextResponse.json({
        success: true,
        evaluation,
        evaluation_id: saved?.id || null,
        paper_name: paperName,
        page_count: pages.length,
        user_id: user.id,
      });
    }

  const paper_id = String(body?.paper_id || "").trim();
  const mappedPaper = findPastPaper(paper_id);
  if (paper_id && !mappedPaper) {
    return NextResponse.json({ error: "Unknown past paper. Choose one of the listed IAC sittings." }, { status: 400 });
  }
  const selectedPaper = mappedPaper?.paper || null;
  const paper_name =
    String(body?.paper_name || "").trim() ||
    (mappedPaper ? pastPaperDisplayName(mappedPaper.sitting, mappedPaper.paper) : "");
  const student_notes = String(body?.student_notes || "").trim();
  const script_text = String(body?.script_text || body?.raw_script || body?.script || "").trim();
  const blocks = parseQuestionBlocks(body);

  if (!paper_name) {
    return NextResponse.json({ error: "Enter the paper name or select a past paper." }, { status: 400 });
  }
  if (!blocks.length && !script_text && !student_notes) {
    return NextResponse.json({ error: "Enter at least one question block, notes, or raw script text." }, { status: 400 });
  }
  if (selectedPaper) {
    const rawQuestions = Array.isArray(body?.questions) ? body.questions : [];
    for (const item of rawQuestions) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const code = String(row.question_code || "").trim();
      if (!code) continue;
      const question = selectedPaper.questions.find((entry) => entry.code === code);
      if (!question) {
        return NextResponse.json(
          { error: `${code} is not a question on ${selectedPaper.title} (${selectedPaper.code}).` },
          { status: 400 }
        );
      }
      const capError = pastPaperSectionCapError(question, {
        direct: asMarkNumber(row.direct_earned, 0),
        indirect: asMarkNumber(row.indirect_earned, 0),
        thinking: asMarkNumber(row.thinking_earned, 0),
      });
      if (capError) {
        return NextResponse.json({ error: capError }, { status: 400 });
      }
    }
  } else {
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
  }

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set on the server." }, { status: 500 });
  }

  const totals = blocks.length
    ? summariseBlocks(blocks)
    : {
        tier1_earned: 0,
        tier1_available: 0,
        tier2_earned: 0,
        tier2_available: 0,
        total_earned: 0,
        total_available: 0,
        total_score_pct: 0,
        knowledge_pct: 0,
        application_pct: 0,
        primary_blocker: "both" as const,
      };
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
  const studentSectionMarks = studentSectionMarksFromBody(body);
  const buriedTreasureDiagnostics =
    calculateMarksForPaper(paper_id, studentSectionMarks) ||
    computeBuriedTreasureDiagnostics(buriedTreasureMarkInput(body, latestBuriedTreasure, selectedPaper));
  const competencyBreakdown = evaluateCompetencyBreakdown(paper_id, studentSectionMarks);

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
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Paper: ${paper_name}`,
          paper_id ? `Paper id: ${paper_id}` : "",
          selectedPaper
            ? `Selected past paper caps: Direct ${selectedPaper.buried_treasure.direct_available} / Indirect ${selectedPaper.buried_treasure.indirect_available} / Thinking ${selectedPaper.buried_treasure.thinking_available} of ${selectedPaper.total_marks} Total Marks`
            : "",
          blocks.length
            ? `Overall total: ${totals.total_earned} / ${totals.total_available} (${totals.total_score_pct}%)`
            : "",
          blocks.length
            ? `Mark-report Knowledge (~${Math.round(KNOWLEDGE_WEIGHT * 100)}%): ${totals.tier1_earned} / ${totals.tier1_available} (${totals.knowledge_pct}%)`
            : "",
          blocks.length
            ? `Mark-report Application (~${Math.round(APPLICATION_WEIGHT * 100)}%): ${totals.tier2_earned} / ${totals.tier2_available} (${totals.application_pct}%)`
            : "",
          `Student notes: ${student_notes || "(none)"}`,
          "",
          "Use the deterministic Buried Treasure metrics below as the source of truth. Copy these exact percentages into fullReportMarkdown, keyTakeaways, and actionPlan. Do not recalculate them.",
          formatBuriedTreasureDiagnostics(buriedTreasureDiagnostics),
          "",
          "Use the deterministic SAICA Competency Area metrics below as the source of truth for the competency table and diagnostics. Copy these exact figures into fullReportMarkdown. Do not recalculate them.",
          formatCompetencyBreakdown(competencyBreakdown),
          "",
          "Ingest Tools 1–3 below for qualitative context (BMCR, Volume/Accuracy, logged Buried Treasure). The deterministic metrics above override any conflicting conversion math.",
          "",
          "Tool 1 — BMCR marks (ingest; do not recalculate):",
          formatBmcrContext(latestBmcr),
          "",
          "Tool 2 — Volume vs Accuracy inputs (ingest; use supplied ratios):",
          formatVolumeContext(latestVolume),
          "",
          "Tool 3 — Buried Treasure log (classify Direct ~10% / Indirect ~35-40% / Thinking ~50-55%; compute conversion = Marks You Got / Available Marks; reconcile with this log if present):",
          formatBuriedTreasureContext(latestBuriedTreasure),
          "",
          "Mark report upload:",
          formatMarkReportContext(progress.markReport),
          "",
          script_text ? "Raw script text:" : "",
          script_text || "",
          "",
          scoredBlocks.length ? "Question blocks from the mark report:" : "",
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
        ]
          .filter((line) => line !== "")
          .join("\n"),
      },
    ],
  });

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content || "{}") as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const parsedAnalysis = parseBuriedTreasureAnalysis(parsed, buriedTreasureDiagnostics);
  if (!parsedAnalysis) {
    return NextResponse.json({ error: "The diagnostic did not return a valid Buried Treasure analysis." }, { status: 500 });
  }
  const evaluation = applyDeterministicMetrics(parsedAnalysis, buriedTreasureDiagnostics);

  const report = mergeModelReport(paper_name, student_notes, blocks.length ? blocks : [{
    question_code: paper_name || "Paper",
    tier1_earned: evaluation.knowledgeScore.earned,
    tier1_available: evaluation.knowledgeScore.available,
    tier2_earned: evaluation.applicationScore.earned,
    tier2_available: evaluation.applicationScore.available,
  }], {
    knowledge_summary: evaluation.diagnosticHeadline,
    application_summary: evaluation.keyTakeaways.join(" "),
    core_verdict: evaluation.diagnosticHeadline,
    skill_drills: evaluation.actionPlan,
    questions: [],
  });
  report.primary_blocker = blockerFromCause(evaluation.primaryFailureCause);
  const stored = reportToStorage(report);

  const { error } = await supabase
    .from("script_evaluations")
    .insert({
      user_id: user.id,
      ...stored,
      dropped_marks_breakdown: {
        ...(typeof stored.dropped_marks_breakdown === "object" ? stored.dropped_marks_breakdown : {}),
        buried_treasure: evaluation,
        competency_breakdown: competencyBreakdown,
      },
    });

  if (error) {
    throw new Error(error.message);
  }

  return NextResponse.json({ success: true, evaluation });
  } catch (err) {
    console.error("Evaluate API Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
