import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ASK_MODEL = "gpt-4o-mini";

type CoachingInsight = {
  category?: string | null;
  title?: string | null;
  coaching_rule?: string | null;
  saica_competency_mappings?: unknown;
};

function asInsightList(value: unknown): CoachingInsight[] {
  return Array.isArray(value) ? (value as CoachingInsight[]) : [];
}

function asChatHistory(value: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = entry as { role?: unknown; content?: unknown };
      const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
      const content = String(row.content || "").trim();
      if (!role || !content) return null;
      return { role, content };
    })
    .filter((entry): entry is { role: "user" | "assistant"; content: string } => Boolean(entry))
    .slice(-12);
}

function formatMappings(value: unknown): string {
  if (value == null) return "None listed.";
  if (typeof value === "string") return value.trim() || "None listed.";
  try {
    return JSON.stringify(value);
  } catch {
    return "None listed.";
  }
}

function formatCoachingInsights(insights: CoachingInsight[]): string {
  if (!insights.length) {
    return "(No active coaching insights were available from Supabase. Still run Socratic diagnosis, then match BMCR, RTFQ, discussion-question, or study-approach tools from the IAC Skills Course.)";
  }
  return insights
    .map((insight, index) => {
      const category = String(insight.category || "Uncategorised").trim();
      const title = String(insight.title || "Untitled insight").trim();
      const rule = String(insight.coaching_rule || "").trim() || "No coaching rule stored.";
      return [
        `Insight ${index + 1}`,
        `Tool / category key: ${category}`,
        `Title: ${title}`,
        `Coaching rule: ${rule}`,
        `SAICA competency mappings: ${formatMappings(insight.saica_competency_mappings)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildSystemPrompt(insightsBlock: string): string {
  return `You are the 24/7 IAC Exam & Skills Facilitator. You run a Socratic Lead-Diagnostic coaching loop. gpt-4o-mini must follow these rules exactly.

1. CANDIDATE SELF-AGENCY
- Treat the candidate as a learner who must master self-diagnostic tools, not as someone you rescue with answers.
- Do not write their script, model answer, or a textbook dump.
- Your job is to help them notice how they currently work, name the leak, and choose the right tool so they can diagnose themselves next time.

2. SOCRATIC LEAD DIAGNOSIS
- If the student asks a broad or vague question (for example: "I don't know how to study", "I'm stuck on Case Studies", "I keep failing", "How do I get better at discussion?"), do NOT dump textbook advice.
- Lead the conversation. Ask 2-3 short probing questions about how they currently practice before you prescribe anything.
- Good probes:
  - "When you get low marks, do you re-read notes or analyze the mark plan?"
  - "Are you losing marks on identifying the rule or applying it?"
  - "When you sit a case study, do you RTFQ first or start writing from memory?"
  - "Is the leak in required identification, structure, or the calculation mechanics?"
- Keep those questions short. Wait for their replies. Do not stack a lecture underneath the questions.
- Once they have answered, diagnose the leak in one or two sentences, then match a tool.

3. TOOL MATCHING
- Map the student's replies to the retrieved Supabase coaching_insights below.
- Match by category key first, including TOOL_BMCR, TOOL_RTFQ, TOOL_DISCUSSION_QUESTIONS, and STRATEGY_STUDY_APPROACH.
- Then use that insight's coaching rule as the next action. Name the tool in student language (BMCR, RTFQ, discussion questions, study approach).
- If more than one insight fits, pick the best 1-2. Do not paste the whole library.
- If the question is already specific (a required, a mark leak, a named tool), skip the probing round and go straight to diagnosis + the matching insight.

4. INJECTED COACHING INSIGHTS (all active rows retrieved from Supabase; this is your tool library; do not contradict it)
${insightsBlock}

VOICE AND LIMITS
- Speak to the student as "you".
- Stay a facilitator sitting next to them, not an examiner lecturing them.
- If they ask for a full solution, refuse the write-up and run diagnosis / tool-matching instead.
- If nothing in the library fits, say so and keep them inside BMCR, RTFQ, discussion-question method, Buried Treasure, or study-approach.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const question = String(body?.question || "").trim();
    const userId = String(body?.user_id || "").trim();

    if (!question) {
      return NextResponse.json({ error: "Enter a question." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: insightRows, error: insightError } = await supabase
      .from("coaching_insights")
      .select("category, title, coaching_rule, saica_competency_mappings")
      .eq("active", true);

    if (insightError) {
      if (/coaching_insights|schema cache|does not exist/i.test(insightError.message)) {
        return NextResponse.json({ error: "Could not load coaching insights." }, { status: 500 });
      }
      return NextResponse.json({ error: insightError.message }, { status: 500 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set on the server." }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const insights = asInsightList(insightRows);
    const systemPrompt = buildSystemPrompt(formatCoachingInsights(insights));
    const history = asChatHistory(body?.messages);
    const last = history[history.length - 1];
    const conversation =
      last?.role === "user" && last.content === question
        ? history
        : [...history, { role: "user" as const, content: question }];
    const completion = await openai.chat.completions.create({
      model: ASK_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: userId ? `${systemPrompt}\n\nStudent id: ${userId}` : systemPrompt },
        ...conversation,
      ],
    });

    const reply = String(completion.choices[0]?.message?.content || "").trim();
    if (!reply) {
      return NextResponse.json({ error: "The facilitator did not return a reply." }, { status: 500 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not answer the question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
