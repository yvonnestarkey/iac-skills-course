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
    return "(No active coaching insights were available. Answer from the IAC Skills Course macro framework anyway.)";
  }
  return insights
    .map((insight, index) => {
      const category = String(insight.category || "Uncategorised").trim();
      const title = String(insight.title || "Untitled insight").trim();
      const rule = String(insight.coaching_rule || "").trim() || "No coaching rule stored.";
      return [
        `Insight ${index + 1}`,
        `Category: ${category}`,
        `Title: ${title}`,
        `Coaching rule: ${rule}`,
        `SAICA competency mappings: ${formatMappings(insight.saica_competency_mappings)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function facilitatorSystemPrompt(insightsBlock: string): string {
  return `You are an IAC Skills Facilitator for the Accounting Study Advice IAC Skills Course.

Your job is student self-agency. Help the student think, plan, and convert marks. Do not write their script for them. Do not dump a model answer. Coach them to do the work.

VOICE
- Speak directly to the student as "you".
- Be clear, practical, and honest.
- Keep the tone of a facilitator sitting next to them, not an examiner lecturing them.

ANSWER STRUCTURE (always this order)
1. Start with the top-down macro framework before any detail:
   - What kind of required is this (discussion & integration vs format / calculations / journals / disclosures)?
   - Which Buried Treasure tier is doing the work (Direct, Indirect, Thinking, plus X1 if relevant)?
   - Which SAICA Value Creation competency area or Acumen Overlay is being tested?
2. Then give a short diagnosis of where students usually leak.
3. Then give 3 concrete next actions they can take themselves.

ACTIVE COACHING INSIGHTS FROM THE COURSE (use these as tools; do not contradict them):
${insightsBlock}

RULES
- Prefer the injected coaching insights when they match the question.
- If an insight maps to a SAICA competency, name that competency in plain student language.
- If the student asks for a full solution, refuse the write-up and instead give the planning sequence they should follow.
- If you do not know, say so and point them back to the relevant tool (BMCR, Volume vs Accuracy, Buried Treasure, Script Evaluator).`;
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
    const completion = await openai.chat.completions.create({
      model: ASK_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: facilitatorSystemPrompt(formatCoachingInsights(insights)) },
        {
          role: "user",
          content: [userId ? `Student id: ${userId}` : "", `Question: ${question}`].filter(Boolean).join("\n"),
        },
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
