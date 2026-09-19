import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

function asChatHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = entry as { role?: unknown; content?: unknown };
      const role =
        row.role === "assistant" ? "assistant" : row.role === "system" ? "system" : row.role === "user" ? "user" : null;
      const content = String(row.content || "").trim();
      if (!role || !content) return null;
      return { role, content };
    })
    .filter((entry): entry is ChatTurn => Boolean(entry))
    .slice(-12);
}

export async function POST(req: Request) {
  try {
    const { question, user_id, messages } = await req.json();
    void user_id;

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    // 1. Query matching coaching insights from Supabase based on question keyword/topic matching
    const { data: insights, error: insightError } = await supabase
      .from("coaching_insights")
      .select("tool_code, diagnostic_routine, diagnostic_outcome, sub_sub_code, coaching_rule, mindset_ref, vimeo_video_id, course_ids")
      .eq("active", true)
      .limit(3);

    if (insightError) {
      console.error("Supabase fetch error:", insightError);
    }

    let coachingContext = "";
    let analogyContext = "";

    if (insights && insights.length > 0) {
      const topInsight = insights[0];
      coachingContext = `
RELEVANT COACHING RULE:
- Tool: ${topInsight.tool_code}
- Diagnostic Routine: ${topInsight.diagnostic_routine}
- Outcome: ${topInsight.diagnostic_outcome}
- Rule: ${topInsight.coaching_rule}
`;

      // 2. Fetch matching analogy from coaching_analogies table using sub_sub_code
      if (topInsight.sub_sub_code) {
        const { data: analogies, error: analogyError } = await supabase
          .from("coaching_analogies")
          .select("name, core_message, student_prompt, action_protocol")
          .contains("trigger_outcomes", [topInsight.sub_sub_code])
          .eq("active", true)
          .limit(1);

        if (analogyError) {
          console.error("Supabase fetch error:", analogyError);
        }

        if (analogies && analogies.length > 0) {
          const analogy = analogies[0];
          analogyContext = `
USE THIS SIGNATURE TEACHING ANALOGY:
- Metaphor Name: "${analogy.name}"
- Core Idea: ${analogy.core_message}
- Signature Question: "${analogy.student_prompt}"
- Action Protocol: ${analogy.action_protocol}

INSTRUCTION: Frame your guidance around the "${analogy.name}" metaphor. Use the signature question to make the realization click for the candidate.
`;
        }
      }
    }

    // 3. Construct System Prompt using Lead-Diagnostic Socratic Guidelines
    const systemPrompt = `
You are Eve, an empathetic, expert lead-diagnostic companion for SAICA, ICAZ, and ICAN candidates preparing for the January 2027 IAC Exam.

ROLE AND TONE:
- Empathetic, supportive, grounded, and concise.
- Talk like a peer mentor who knows the exact exam traps.

LEAD-DIAGNOSTIC GUIDELINES:
1. Validate & Reframe: Acknowledge the student's struggle briefly (1 sentence).
2. Classify: Do not leave the student overwhelmed. Classify their symptoms into 1-2 formal tools or routines (e.g., BMCR, Volume vs Accuracy, RTFQ).
3. Use Metaphors: If a signature teaching analogy is provided below, use it to make the lesson stick emotionally.
4. Binary / Choice Probes: Ask 1 concise, specific choice question to isolate their exact root cause. Avoid open-ended reflective questions like "What do you think?" or "How do you feel?"

${coachingContext}
${analogyContext}
`;

    const history = asChatHistory(messages);
    const asked = String(question).trim();
    const last = history[history.length - 1];
    const conversation =
      last?.role === "user" && last.content === asked ? history : [...history, { role: "user" as const, content: asked }];

    // 4. Send payload to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...conversation],
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || "I'm having trouble retrieving a response right now.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Ask Eve Error:", err);
    return NextResponse.json({ error: "Failed to get a response from Eve." }, { status: 500 });
  }
}
