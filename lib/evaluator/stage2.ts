import { callStructured } from "./anthropic";
import { stage2Methodology } from "./methodology";
import { enforceCoachHypothesisEvidence } from "./metrics";
import type { EvaluationDataset, EvaluationReport, UsageTally } from "./types";

const REPORT_SCHEMA = {
  type: "object" as const,
  properties: {
    headline: { type: "string" },
    patterns: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          what_we_see: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          why_it_matters: { type: "string" },
          relevant_tool: { type: "string" },
          working_hypotheses: {
            type: "array",
            items: { type: "object", properties: { hypothesis: { type: "string" }, would_confirm: { type: "string" }, would_reject: { type: "string" } }, required: ["hypothesis", "would_confirm", "would_reject"] },
          },
          probe_question: { type: "string" },
          next_step: { type: "string" },
          confidence: { type: "string", enum: ["supported", "tentative"] },
        },
        required: ["title", "what_we_see", "evidence", "why_it_matters", "relevant_tool", "working_hypotheses", "probe_question", "next_step", "confidence"],
      },
    },
    requirement_comments: {
      type: "array",
      items: { type: "object", properties: { code: { type: "string" }, comment: { type: "string" }, certainty: { type: "string", enum: ["supported", "uncertain"] } }, required: ["code", "comment", "certainty"] },
    },
    coach_hypotheses: {
      type: "array",
      maxItems: 4,
      description: "COACH-ONLY. Whole-script transferable skill gaps, not comments on single answers.",
      items: {
        type: "object",
        properties: {
          skill_gap: { type: "string" },
          pattern: { type: "string" },
          evidence_requirements: { type: "array", items: { type: "string" }, description: "Requirement codes (e.g. P1Q1_a) that show the pattern." },
          evidence: { type: "array", items: { type: "string" } },
          working_hypothesis: { type: "string" },
          would_confirm: { type: "string" },
          would_reject: { type: "string" },
          probe: { type: "string" },
          skill_to_train: { type: "string" },
          confidence: { type: "string", enum: ["supported", "tentative"] },
        },
        required: ["skill_gap", "pattern", "evidence_requirements", "evidence", "working_hypothesis", "would_confirm", "would_reject", "probe", "skill_to_train", "confidence"],
      },
    },
    technical_gaps: { type: "array", items: { type: "string" } },
    still_to_investigate: { type: "array", items: { type: "string" } },
    coach_flags: {
      type: "array",
      items: { type: "object", properties: { type: { type: "string", enum: ["wellbeing", "quit_risk", "data_quality", "other"] }, note: { type: "string" } }, required: ["type", "note"] },
    },
  },
  required: ["headline", "patterns", "requirement_comments", "coach_hypotheses", "technical_gaps", "still_to_investigate", "coach_flags"],
};

export async function synthesiseReport(input: { dataset: EvaluationDataset; usage: UsageTally; model: string }): Promise<EvaluationReport> {
  const raw = await callStructured<Omit<EvaluationReport, "version" | "attempt_id" | "generated_at" | "model">>({
    system: `${stage2Methodology()}

You are Stage 2 of the Script Evaluator: you turn an observation-only evaluation dataset into a short student report. Rules:
- Choose 2–4 transferable patterns the evidence supports across requirements, not a metric dump. Technical knowledge gaps go in "technical_gaps" unless the evidence supports a broader knowledge constraint.
- Follow the feedback chain: what we see → evidence → why it matters → relevant tool → what to do next.
- Observation is not diagnosis. Present explanations as working hypotheses with what would confirm or reject them. One script is never enough for a firm psychological conclusion; mark such patterns "tentative".
- Student-facing language is behavioural and plain. No MMS jargon (no "fixed mindset", "goal orientation", "implicit belief"). The psychology stays in the backend; use it only to choose the probe and the frame.
- The probe is a short question the student can answer about their own process, framed as an experiment, not a verdict.
- Do not make big decisions for the student. Next steps are small experiments using the course tools.
- Put anything that is not for the student (wellbeing language, quit-risk signals, data quality problems, mapping uncertainty) in coach_flags. Do not invent wellbeing concerns from exam performance alone.
- BMCR verdicts are fixed and simple (metrics.bmcr_verdict): not_enough_theory (Basic < 50% of total), enough_theory_converting, enough_theory_not_converting (Basic ≥ 50% but < 70% of Basic converted → a "something else" problem, not theory). Report the verdict as a fact; do not soften or reinterpret thresholds. Never say the student needs more theory when the verdict is enough_theory_*.
- RTFQ comes first. When a requirement's RTFQ shape or lens is "no", every other tool result for it is provisional (it measures an answer to a different question): say so before interpreting those results, and do not draw skill-gap conclusions from them.
- Volume, Accuracy, Components and Core Issue only exist for discussion questions; calculation questions carry fewer measures by design, so absent measures are not evidence of anything.
- coach_hypotheses are COACH-ONLY and look across the WHOLE script. The student will never see this question again, so name transferable skills that will help them pass (hunting the case for signals, sizing an answer to the case, finishing a thought, converting marks, recognising what the requirement asks for), not comments on this question's content. Use the tools as the observable evidence, and consider patterns that repeat across requirements or across tools. Each needs a working hypothesis in Eve's lens, what would confirm it, what would reject it, a probe the coach can ask, and the skill or tool to train. Never state a psychological cause as fact; one script is never enough. Do not invent a hypothesis for a pattern that appears in only one requirement unless you mark it tentative. Compare discussion styles (compliance rules vs non-compliance tools) when both appear. Generic or panicked answers are an observation (what is on the page); do not claim why.
- Requirement comments are a one-line "main thing between the student and the marks", allowing "uncertain".`,
    userContent: [
      {
        type: "text",
        text: `Evaluation dataset (JSON). Ratios in "metrics" were computed in code and are authoritative.\n\n${JSON.stringify(
          { requirements: input.dataset.requirements, metrics: input.dataset.metrics, page_map: input.dataset.page_map, warnings: input.dataset.warnings },
          null,
          2
        )}`,
      },
    ],
    toolName: "return_student_report",
    toolDescription: "Return the synthesised student report and coach flags.",
    schema: REPORT_SCHEMA,
    usage: input.usage,
    maxTokens: 8000,
  });
  return {
    version: 1,
    attempt_id: input.dataset.attempt_id,
    generated_at: new Date().toISOString(),
    model: input.model,
    ...raw,
    coach_hypotheses: enforceCoachHypothesisEvidence(raw.coach_hypotheses ?? [], input.dataset.requirements.map((r) => r.code)),
  };
}
