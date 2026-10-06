import { callStructured, fetchPageImages, imageBlocks } from "./anthropic";
import { stage1Methodology } from "./methodology";
import { aggregateProximity, applyNotAttemptedRule, buildCoreIssue, validateRequirement, type RawCoreIssue } from "./metrics";
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
    components: {
      type: ["object", "null"],
      properties: {
        layers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              layer: { type: "string" },
              source: { type: "string", enum: ["required", "case_sections", "theory", "other"] },
              available: { type: "integer", minimum: 0 },
              recognised: { type: "integer", minimum: 0 },
              exploited: { type: "integer", minimum: 0 },
              note: { type: "string" },
            },
            required: ["layer", "source", "available", "recognised", "exploited", "note"],
          },
        },
        evidence: { type: "string" },
      },
      required: ["layers", "evidence"],
    },
    core_issue: {
      type: ["object", "null"],
      description: "Only the components listed in the prompt. Report how many statements the student wrote on each and how deep they went. Do not set priority; it is pre-calibrated.",
      properties: {
        components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              component: { type: "string" },
              attempts: { type: "integer", minimum: 0 },
              depth: { type: "string", enum: ["none", "surface", "developed"] },
            },
            required: ["component", "attempts", "depth"],
          },
        },
        evidence: { type: "string" },
      },
      required: ["components", "evidence"],
    },
    rtfq: {
      type: ["object", "null"],
      properties: {
        dimensions: {
          type: "array",
          description: "Exactly three entries: shape, directions, lens.",
          items: {
            type: "object",
            properties: {
              dimension: { type: "string", enum: ["shape", "directions", "lens"] },
              required: { type: "string" },
              delivered: { type: "string", enum: ["yes", "partly", "no"] },
              note: { type: "string" },
            },
            required: ["dimension", "required", "delivered", "note"],
          },
        },
        evidence: { type: "string" },
      },
      required: ["dimensions", "evidence"],
    },
    communication: {
      type: ["object", "null"],
      properties: {
        points: {
          type: "array",
          description: "One entry per statement the student wrote, in order (the same unit as Volume).",
          items: {
            type: "object",
            properties: {
              n: { type: "integer", minimum: 1 },
              statement: { type: "string" },
              category: { type: "string", enum: [...COMMUNICATION_RATINGS] },
              note: { type: "string" },
            },
            required: ["n", "statement", "category", "note"],
          },
        },
        trend: { type: "string", description: "The trend across the points in plain words. No numbers, counts or percentages." },
        evidence: { type: "string" },
      },
      required: ["points", "trend", "evidence"],
    },
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

  const raw = await callStructured<Omit<RequirementEvaluation, "code" | "label" | "total_marks" | "bmcr" | "buried_treasure" | "core_issue"> & { core_issue: RawCoreIssue | null }>({
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
          "The marker's report is the ONLY authority for marks awarded. Students may write their own notes, ticks or \"1 mark\" annotations on the script before uploading it; these are never marks. Use them only as evidence of what the student wrote, never to set awarded values.",
          "Components: report one entry per layer of structure (required structure such as SWOT buckets or named goals; case sections; underlying theory). For each layer give counts available / recognised / exploited and a super-brief note. Recognised needs evidence the student used the structure to hunt; generic topic discussion or words that merely resemble the mark plan do NOT count. Exclude any case section the requirement tells students not to discuss from the available count.",
          model?.core_issue?.length
            ? `Core Issue components (pre-calibrated; priority, including any dominant component, is NOT yours to judge). For each, report attempts (statements the student wrote on it, one per statement) and depth (none / surface / developed):\n${model.core_issue.map((c) => `- ${c.component} [${c.layer}]`).join("\n")}`
            : "No pre-calibrated Core Issue components exist for this requirement. Return core_issue as null. Do NOT invent priorities.",
          "RTFQ: return three dimensions. shape = the instruction word and its shape (discuss, calculate, evaluate, journal, recommend...); directions = hidden required, named entities, headings, exclusions, required perspective; lens = the actual issue or framework the required asks about. For each say what the required asked for, whether the answer delivered it (yes / partly / no) and a one-line note of the evidence on the page. Use partly when the answer is on the right track but only some of it was delivered. Record delivery only; never explain why the student did or did not deliver.",
          "Communication: judge only what is on the page, never what was in the student's head. Categorise EACH statement (the same unit as Volume, one per statement): Complete, Underdeveloped, Unclear or Miscommunicated. Discussion shape is fact -> implication -> relevance. A thin tail such as \"thus creating more value\" is Underdeveloped (the student should have continued). A sentence that stops mid-way, or illegible wording, is Unclear. A mark not awarded is NOT automatically a Communication problem. Then write the trend in plain words with no numbers.",
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
  if (gate.coreIssue && !model?.core_issue?.length) warnings.push(`${label}: no pre-calibrated Core Issue components; Core Issue not scored.`);
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
    core_issue: gate.coreIssue ? buildCoreIssue(model?.core_issue, raw.core_issue ?? null) : null,
    rtfq: gate.rtfq ? raw.rtfq ?? null : null,
    communication: gate.communication ? raw.communication ?? null : null,
    uncertainties: raw.uncertainties || [],
  });
  return { evaluation, warnings: [...warnings, ...validateRequirement(evaluation)] };
}
