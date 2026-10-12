import { callStructured, fetchPageImages, imageBlocks } from "./anthropic";
import { stage1Methodology } from "./methodology";
import { aggregateProximity, applyNotAttemptedRule, buildComponents, buildCoreIssue, componentNodeId, finalizeCommunication, validateRequirement, type RawComponents, type RawCoreIssue } from "./metrics";
import { questionModelFor, toolsFor } from "./question-model";
import { requirementLabel } from "./pagemap";
import { DISCUSSION_BASES, COMMUNICATION_RATINGS, INTRO_STATUSES, QUESTION_TYPES, RTFQ_DELIVERED, type BmcrRow, type RequirementEvaluation, type RequirementPageMap, type UsageTally } from "./types";

type PageRef = { page: number; url: string };

const REQUIREMENT_SCHEMA = {
  type: "object" as const,
  properties: {
    attempted: { type: "boolean" },
    technical_awarded: { type: ["number", "null"], description: "Technical marks the marker awarded (excluding PVAA)." },
    pvaa_awarded: { type: ["number", "null"] },
    question_type: { type: "string", enum: [...QUESTION_TYPES], description: "Echo the question type given in the prompt." },
    discussion_basis: { type: ["string", "null"], enum: [...DISCUSSION_BASES, null], description: "Echo the discussion basis given in the prompt, or null." },
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
        nodes: {
          type: "array",
          description: "Only when a layered component tree is given in the prompt: one entry per node id.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              recognised: { type: "boolean", description: "The student used the structure to hunt for this (evidence on the page); generic topic talk does not count." },
              exploited: { type: "boolean", description: "The marker awarded a mark that came from this node." },
              note: { type: "string", description: "Very brief evidence." },
            },
            required: ["id", "recognised", "exploited", "note"],
          },
        },
        code_chain: {
          type: "array",
          description: "Only when the tree has Code of Professional Conduct issues: one entry per Code issue the student raised, checked against the whole chain.",
          items: {
            type: "object",
            properties: {
              issue: { type: "string" },
              indicator: { type: "string", enum: ["yes", "partly", "no"] },
              threat: { type: "string", enum: ["yes", "partly", "no"] },
              principle: { type: "string", enum: ["yes", "partly", "no"] },
              explanation: { type: "string", enum: ["yes", "partly", "no"] },
              significance: { type: "string", enum: ["yes", "partly", "no"] },
              safeguard: { type: "string", enum: ["yes", "partly", "no"] },
            },
            required: ["issue", "indicator", "threat", "principle", "explanation", "significance", "safeguard"],
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
        off_plan_note: { type: "string", description: "Valid points the student made that are not on the mark plan (they are not wrong): say briefly where the answer was expanded or contracted differently from what the case signalled. Empty string if none." },
        evidence: { type: "string" },
      },
      required: ["components", "off_plan_note", "evidence"],
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
        overall: {
          type: "object",
          description: "Assessment of the WHOLE answer, not point by point. Some students write the theory first and apply it at the end; that is fine.",
          properties: {
            introduction: { type: "string", enum: [...INTRO_STATUSES], description: "present = the answer opens by naming the knowledge base and the objective; absent = it jumps into detail." },
            introduction_note: { type: "string" },
            knowledge: { type: ["string", "null"], enum: [...RTFQ_DELIVERED, null], description: "COMPLIANCE discussions only: was the theory underpinning the discussion (the rules, e.g. the standard or Act) stated? Null for non-compliance." },
            application: { type: ["string", "null"], enum: [...RTFQ_DELIVERED, null], description: "COMPLIANCE only: were the case facts applied to the rules? Null for non-compliance." },
            so_what: { type: ["string", "null"], enum: [...RTFQ_DELIVERED, null], description: "COMPLIANCE only: were conclusions for the client drawn? Null for non-compliance." },
            note: { type: "string" },
          },
          required: ["introduction", "introduction_note", "knowledge", "application", "so_what", "note"],
        },
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
              explains_why: { type: "string", enum: ["yes", "no", "not_applicable"], description: "COACH-ONLY. For a statement that names a threat, risk, control weakness, misstatement or issue: did the student also explain WHY it is a problem and HOW it could cause harm (yes), or stop at the what (no)? not_applicable when the statement names no such item (a definition, a procedure, a conclusion)." },
            },
            required: ["n", "statement", "category", "note", "explains_why"],
          },
        },
        trend: { type: "string", description: "The trend across the points in plain words. No numbers, counts or percentages." },
        evidence: { type: "string" },
      },
      required: ["overall", "points", "trend", "evidence"],
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
  const discussionBasis = questionType === "Discussion" ? model?.discussion_basis ?? null : null;
  const gate = toolsFor(questionType ?? "Discussion", pageMap.attempted);
  const scriptSelected = input.scriptPages.filter((page) => pageMap.script_pages.includes(page.page));
  const reportSelected = input.reportPages.filter((page) => pageMap.report_pages.includes(page.page));
  const [scriptImages, reportImages] = await Promise.all([fetchPageImages(scriptSelected), fetchPageImages(reportSelected)]);

  const raw = await callStructured<Omit<RequirementEvaluation, "code" | "label" | "total_marks" | "bmcr" | "buried_treasure" | "core_issue" | "components"> & { core_issue: RawCoreIssue | null; components: RawComponents | null }>({
    system: `${stage1Methodology()}\n\nYou are Stage 1 of the Script Evaluator for ONE requirement. Record observations only. Do not explain why the student behaved as they did. Report counts and flags; never calculate percentages. If the requirement was not attempted, set attempted=false and set the answer-based measures to null (only Question Type, Competency and the marker's marks are returned).`,
    userContent: [
      {
        type: "text",
        text: [
          `Requirement: ${label} (${requirement.code}) — ${requirement.title}. Total marks: ${requirement.total_marks}.`,
          `Attempted per page map: ${pageMap.attempted}${pageMap.uncertain ? " (mapping uncertain)" : ""}.`,
          questionType ? `Question type (pre-calibrated, do not change): ${questionType}.` : "Question type is not pre-calibrated; classify it.",
          discussionBasis
            ? `Discussion basis (pre-calibrated, do not change): ${discussionBasis === "compliance" ? "compliance, a discussion that applies RULES (a standard, Act or law). Expected shape: should be -> is -> so what, opened by an introduction naming the knowledge base and the objective" : "non-compliance, a discussion that applies TOOLS (a framework such as SWOT, strategy or risk models). Expected shape: framework bucket -> case fact -> so what, opened by an introduction naming the tool and the objective"}.`
            : "Discussion basis is not pre-calibrated; return discussion_basis as null.",
          `Tools to run for this requirement: ${
            [gate.buriedTreasure && "Buried Treasure", gate.volumeAccuracy && "Volume", gate.components && "Components", gate.coreIssue && "Core Issue", gate.rtfq && "RTFQ", gate.communication && "Communication"]
              .filter(Boolean)
              .join(", ") || "none beyond marks, Question Type and Competency"
          }. Return null for every tool not listed.`,
          model?.proximity_items.length
            ? `Pre-calibrated proximity items (marker's report row numbers). Return one buried_treasure_items entry per row:\n${model.proximity_items.map((item) => `- row ${item.row}: ${item.proximity}${item.note ? ` — ${item.note}` : ""}`).join("\n")}`
            : "No pre-calibrated proximity items exist for this requirement. Return buried_treasure_items as null. Do NOT invent a classification.",
          "The marker's report is the ONLY authority for marks awarded. Students may write their own notes, ticks or \"1 mark\" annotations on the script before uploading it; these are never marks. Use them only as evidence of what the student wrote, never to set awarded values.",
          model?.component_tree?.length
            ? `Components (pre-calibrated layered tree; do not invent nodes). Return layers as an empty array. Return one nodes entry per id below. recognised = the student used this structure to hunt for points (evidence on the page; generic topic discussion or wording that merely resembles the mark plan does NOT count). exploited = the marker awarded a mark from it (marker's report only). Judge every node, including those marked beyond the basics.${model.component_tree.some((n) => n.chain === "cpc") ? " The Code of Professional Conduct chain applies ONLY to issues about the Code: for each Code issue the student raised (in their own words), return a code_chain entry saying whether the answer dealt with each step (yes / partly / no): indicator (the case fact that signals the issue), threat (the named threat), principle (the fundamental principle affected), explanation (what the student is actually worried about, i.e. WHY it matters), significance (how significant the threat is in this case), safeguard. Other ethics issues do not follow the chain." : ""}\n${model.component_tree.map((n, i) => `- ${componentNodeId(i)} [${n.path.join(" > ")}] ${n.label}${n.chain ? " (Code issue)" : ""}${n.basic_theory ? "" : " (beyond the basics)"}`).join("\n")}`
            : "Components: report one entry per layer of structure (required structure such as SWOT buckets or named goals; case sections; underlying theory). For each layer give counts available / recognised / exploited and a super-brief note. Recognised needs evidence the student used the structure to hunt; generic topic discussion or words that merely resemble the mark plan do NOT count. Exclude any case section the requirement tells students not to discuss from the available count.",