import { callStructured, fetchPageImages, imageBlocks } from "./anthropic";
import { stage1Methodology } from "./methodology";
import { aggregateProximity, applyNotAttemptedRule, validateRequirement } from "./metrics";
import { questionModelFor, toolsFor } from "./question-model";
import { requirementLabel } from "./pagemap";
import { COMMUNICATION_RATINGS, QUESTION_TYPES, type BmcrRow, type RequirementEvaluation, type RequirementPageMap, type UsageTally } from "./types";

type PageRef = { page: number; url: string };

const REQUIREMENT_SCHEMA = {
  type: "object" as const,
  properties: {
    attempted: { type: "boolean" },
    technical_awarded: { type: ["number", "null"], description: "Technical marks the marker awarded (excluding PVAA)." },
    pvaa_awarded: { type: ["number", "null"] },
    question_type: { type: "string", enum: [...QUESTION_TYPES], description: "Echo the question type given in the prompt." },
    question_type_basis: { type: "string" },
    competency: { type: "object", properties: { topic: { type: "string" }, basis: { type: "string" } }, required: ["topic", "basis"] },
    buried_treasure_items: {
      type: ["array", "null"],
      description: "One entry per modelled proximity item (marker's report row numbers). seen = visible evidence in the script that the candidate noticed the clue; awarded = the marker awarded that row.",
      items: { type: "object", properties: { row: { type: "number" }, seen: { type: "boolean" }, awarded: { type: "boolean" } }, required: ["row", "seen", "awarded"] },
    },
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
  paperId: string;
}): Promise<{ evaluation: RequirementEvaluation; warnings: string[] }> {
  const { requirement, pageMap } = input;
  const label = requirementLabel(requirement.code);
  const model = questionModelFor(input.paperId, requirement.code);
  const questionType = model?.question_type ?? null;
  const gate = toolsFor(questionType ?? "Discussion", pageMap.attempted);
  const scriptSelected = input.scriptPages.filter((page) => pageMap.script_pages.includes(page.page));
  const reportSelected = input.reportPages.filter((page) => pageMap.report_pages.includes(page.page));
  const [scriptImages, reportImages] = await Promise.all([fetchPageImages(scriptSelected), fetchPageImages(reportSelected)]);

  const raw = await callStructured<Omit<RequirementEvaluation, "code" | "label" | "total_marks" | "bmcr" | "buried_treasure">>({
    system: `${stage1Methodology()}\n\nYou are Stage 1 of the Script Evaluator for ONE requirement. Record observations only. Do not explain why the student behaved as they did. Report counts and flags; never calculate percentages. If the requirement was not attempted, set attempted=false and set the answer-based measures to null (only Question Type, Competency and the marker's marks are returned).`,
    userContent: [
      {
        type: "text",
        text: [
          `Requirement: ${label} (${requirement.code}) — ${requirement.title}. Total marks: ${requirement.total_marks}.`,
          `Attempted per page map: ${pageMap.attempted}${pageMap.uncertain ? " (mapping uncertain)" : ""}.`,
          questionType ? `Question type (pre-calibrated, do not change): ${questionType}.` : "Question type is not pre-calibrated; classify it.",
          `Tools to run for this requirement: ${
            [gate.buriedTreasure && "Buried Treasure", gate.volumeAccuracy && "Volume", gate.components && "Components", gate.coreIssue && "Core Issue", gate.rtfq && "RTFQ", gate.communication && "Communication"]
              .filter(Boolean)
              .join(", ") || "none beyond marks, Question Type and Competency"
          }. Return null for every tool not listed.`,
          model?.proximity_items.length
            ? `Pre-calibrated proximity items (marker's report row numbers). Return one buried_treasure_items entry per row:\n${model.proximity_items.map((item) => `- row ${item.row}: ${item.proximity}${item.note ? ` — ${item.note}` : ""}`).join("\n")}`
            : "No pre-calibrated proximity items exist for this requirement. Return buried_treasure_items as null. Do NOT invent a classification.",
          "technical_awarded excludes professional marks (Z structure marks, Comm marks, Y marks); record those in pvaa_awarded.",
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

  const warnings: string[] = [];
  if (gate.buriedTreasure && !model?.proximity_items.length) warnings.push(`${label}: no pre-calibrated proximity items; Buried Treasure not scored.`);
  const buriedTreasure = gate.buriedTreasure ? aggregateProximity(model, raw.buried_treasure_items ?? null) : null;

  const evaluation: RequirementEvaluation = applyNotAttemptedRule({
    ...raw,
    question_type: questionType ?? raw.question_type,
    attempted: Boolean(raw.attempted) && pageMap.attempted,
    code: requirement.code,
    label,
    total_marks: requirement.total_marks,
    bmcr: { student_known: input.bmcr?.student_known ?? null, available: input.bmcr?.available ?? null },
    buried_treasure_items: gate.buriedTreasure ? raw.buried_treasure_items ?? null : null,
    buried_treasure: buriedTreasure,
    volume: gate.volumeAccuracy ? raw.volume ?? null : null,
    components: gate.components ? raw.components ?? null : null,
    core_issue: gate.coreIssue ? raw.core_issue ?? null : null,
    rtfq: gate.rtfq ? raw.rtfq ?? null : null,
    communication: gate.communication ? raw.communication ?? null : null,
    uncertainties: raw.uncertainties || [],
  });
  return { evaluation, warnings: [...warnings, ...validateRequirement(evaluation)] };
}
