import { callStructured, fetchPageImages, imageBlocks } from "./anthropic";
import { stage1Methodology } from "./methodology";
import { applyNotAttemptedRule, validateRequirement } from "./metrics";
import { requirementLabel } from "./pagemap";
import { COMMUNICATION_RATINGS, QUESTION_TYPES, type BmcrRow, type RequirementEvaluation, type RequirementPageMap, type UsageTally } from "./types";

type PageRef = { page: number; url: string };

const bucket = {
  type: "object",
  properties: { available: { type: "number" }, seen: { type: "number" }, awarded: { type: "number" } },
  required: ["available", "seen", "awarded"],
};

const REQUIREMENT_SCHEMA = {
  type: "object" as const,
  properties: {
    attempted: { type: "boolean" },
    technical_awarded: { type: ["number", "null"], description: "Technical marks the marker awarded (excluding PVAA)." },
    pvaa_awarded: { type: ["number", "null"] },
    question_type: { type: "string", enum: [...QUESTION_TYPES] },
    question_type_basis: { type: "string" },
    competency: { type: "object", properties: { topic: { type: "string" }, basis: { type: "string" } }, required: ["topic", "basis"] },
    buried_treasure: { type: ["object", "null"], properties: { direct: bucket, indirect: bucket, thinking: bucket }, required: ["direct", "indirect", "thinking"] },
    volume: { type: ["object", "null"], properties: { attempts: { type: "number" }, note: { type: "string" } }, required: ["attempts", "note"] },
    components: { type: ["object", "null"], properties: { available: { type: "boolean" }, recognised: { type: "boolean" }, exploited: { type: "boolean" }, evidence: { type: "string" } }, required: ["available", "recognised", "exploited", "evidence"] },
    core_issue: { type: ["object", "null"], properties: { case_signal: { type: "string" }, student_weighting: { type: "string" }, alignment: { type: "string", enum: ["aligned", "partly", "misaligned"] }, evidence: { type: "string" } }, required: ["case_signal", "student_weighting", "alignment", "evidence"] },
    rtfq: { type: ["object", "null"], properties: { required_shape: { type: "string" }, hidden_directions: { type: "string" }, subject_lens: { type: "string" }, delivered_shape: { type: "boolean" }, delivered_directions: { type: "boolean" }, delivered_lens: { type: "boolean" }, evidence: { type: "string" } }, required: ["required_shape", "hidden_directions", "subject_lens", "delivered_shape", "delivered_directions", "delivered_lens", "evidence"] },
    communication: { type: ["object", "null"], properties: { rating: { type: "string", enum: [...COMMUNICATION_RATINGS] }, evidence: { type: "string" } }, required: ["rating", "evidence"] },
    quick_comment: {
      type: "object",
      properties: {
        main_issue: { type: ["string", "null"], description: "Best-supported main thing between the student and the marks on this requirement. Observation language, not psychology. null if the evidence does not support one." },
        certainty: { type: "string", enum: ["supported", "uncertain"] },
        evidence: { type: "string" },
      },
      required: ["main_issue", "certainty", "evidence"],
    },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: ["attempted", "technical_awarded", "pvaa_awarded", "question_type", "question_type_basis", "competency", "quick_comment", "uncertainties"],
};

export async function evaluateRequirement(input: {
  requirement: { code: string; title: string; total_marks: number };
  pageMap: RequirementPageMap;
  scriptPages: PageRef[];
  reportPages: PageRef[];
  bmcr: BmcrRow | undefined;
  officialText: string;
  usage: UsageTally;
}): Promise<{ evaluation: RequirementEvaluation; warnings: string[] }> {
  const { requirement, pageMap } = input;
  const label = requirementLabel(requirement.code);
  const scriptSelected = input.scriptPages.filter((page) => pageMap.script_pages.includes(page.page));
  const reportSelected = input.reportPages.filter((page) => pageMap.report_pages.includes(page.page));
  const [scriptImages, reportImages] = await Promise.all([fetchPageImages(scriptSelected), fetchPageImages(reportSelected)]);

  const raw = await callStructured<Omit<RequirementEvaluation, "code" | "label" | "total_marks" | "bmcr">>({
    system: `${stage1Methodology()}\n\nYou are Stage 1 of the Script Evaluator for ONE requirement. Record observations only. Do not explain why the student behaved as they did. Report counts and flags; never calculate percentages. If the requirement was not attempted, set attempted=false and set the answer-based measures to null (only Question Type, Competency and the marker's marks are returned).`,
    userContent: [
      {
        type: "text",
        text: [
          `Requirement: ${label} (${requirement.code}) — ${requirement.title}. Total marks: ${requirement.total_marks}.`,
          `Attempted per page map: ${pageMap.attempted}${pageMap.uncertain ? " (mapping uncertain)" : ""}.`,
          `Student's own BMCR for this requirement: marks available ${input.bmcr?.available ?? "unknown"}, marks the student believed they knew ${input.bmcr?.student_known ?? "unknown"}.`,
          "",
          "Official question, solution/mark plan, commentary and competency material:",
          input.officialText,
          "",
          "Candidate's script pages for this requirement, then the marker's report pages for it, follow.",
        ].join("\n"),
      },
      ...imageBlocks("Script", scriptImages),
      ...imageBlocks("Marking report", reportImages),
    ],
    toolName: "return_requirement_evaluation",
    toolDescription: "Return the observation-only evaluation for this requirement.",
    schema: REQUIREMENT_SCHEMA,
    usage: input.usage,
    maxTokens: 6000,
  });

  const evaluation: RequirementEvaluation = applyNotAttemptedRule({
    ...raw,
    attempted: Boolean(raw.attempted) && pageMap.attempted,
    code: requirement.code,
    label,
    total_marks: requirement.total_marks,
    bmcr: { student_known: input.bmcr?.student_known ?? null, available: input.bmcr?.available ?? null },
    buried_treasure: raw.buried_treasure ?? null,
    volume: raw.volume ?? null,
    components: raw.components ?? null,
    core_issue: raw.core_issue ?? null,
    rtfq: raw.rtfq ?? null,
    communication: raw.communication ?? null,
    uncertainties: raw.uncertainties || [],
  });
  return { evaluation, warnings: validateRequirement(evaluation) };
}
