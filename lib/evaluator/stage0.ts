import { callStructured, fetchPageImages, imageBlocks, newUsage } from "./anthropic";
import { normalisePageMap, requirementLabel, type ExpectedRequirement } from "./pagemap";
import { stage1Methodology } from "./methodology";
import type { BmcrRow, PageMap, UsageTally } from "./types";

const MAX_IMAGES_PER_CALL = 100;

type PageRef = { page: number; url: string };

function capPages(pages: PageRef[], label: string, warnings: string[]): PageRef[] {
  if (pages.length <= MAX_IMAGES_PER_CALL) return pages;
  warnings.push(`${label}: ${pages.length} pages exceeds ${MAX_IMAGES_PER_CALL}; only the first ${MAX_IMAGES_PER_CALL} were read.`);
  return pages.slice(0, MAX_IMAGES_PER_CALL);
}

function expectedList(expected: ExpectedRequirement[]): string {
  return expected.map((item) => `- ${item.code} = ${requirementLabel(item.code)} — ${item.title}`).join("\n");
}

const MAP_SCHEMA = {
  type: "object" as const,
  properties: {
    answer_order: { type: "array", items: { type: "string" }, description: "Requirement codes in the order the candidate actually answered them." },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          attempted: { type: "boolean" },
          script_pages: { type: "array", items: { type: "integer" } },
          report_pages: { type: "array", items: { type: "integer" } },
          mapped_by: { type: "string", enum: ["label", "content", "none"] },
          uncertain: { type: "boolean" },
          note: { type: "string" },
        },
        required: ["code", "attempted", "mapped_by", "uncertain"],
      },
    },
  },
  required: ["requirements"],
};

/** Map the candidate's script pages to requirements by their written labels, never by position. */
export async function mapScriptPages(input: {
  expected: ExpectedRequirement[];
  scriptPages: PageRef[];
  questionText: string;
  usage: UsageTally;
  warnings: string[];
}): Promise<{ map: PageMap; scriptPageCount: number }> {
  const pages = capPages(input.scriptPages, "Script", input.warnings);
  const images = await fetchPageImages(pages);
  const raw = await callStructured<unknown>({
    system: `${stage1Methodology().slice(0, 4000)}\n\nYou are mapping a candidate's marked exam script to the paper's requirements.\nRules: use the candidate's own written requirement labels (e.g. "Required (d)", "(a)", "1A") to assign pages. The candidate may answer in any order. If a label is missing or messy, match by content to the question text and set mapped_by to "content" and uncertain to true. A requirement the candidate left blank is attempted=false with no pages. A requirement can span non-contiguous pages. Do NOT assign pages by sequence.`,
    userContent: [
      { type: "text", text: `Requirements for this paper:\n${expectedList(input.expected)}\n\nQuestion text (for content matching only):\n${input.questionText.slice(0, 30000)}\n\nCandidate script pages follow. Return the page map for every requirement. Leave report_pages empty.` },
      ...imageBlocks("Script", images),
    ],
    toolName: "return_script_page_map",
    toolDescription: "Return which script pages hold the answer to each requirement.",
    schema: MAP_SCHEMA,
    usage: input.usage,
    maxTokens: 4000,
  });
  const { map, warnings } = normalisePageMap(raw, input.expected, { scriptPages: pages.length ? Math.max(...pages.map((p) => p.page)) : 0, reportPages: 0 });
  input.warnings.push(...warnings);
  return { map, scriptPageCount: pages.length };
}

/** Map the marking-report pages to requirements. */
export async function mapReportPages(input: {
  expected: ExpectedRequirement[];
  reportPages: PageRef[];
  usage: UsageTally;
  warnings: string[];
}): Promise<Record<string, number[]>> {
  const pages = capPages(input.reportPages, "Marking report", input.warnings);
  const images = await fetchPageImages(pages);
  const raw = await callStructured<{ requirements?: { code?: string; report_pages?: number[] }[] }>({
    system: `You are mapping a marker's marking report to the paper's requirements. Return, for each requirement, the report page numbers that contain the marker's marks and comments for that requirement. A requirement may span several pages. Do not assess the student.`,
    userContent: [
      { type: "text", text: `Requirements:\n${expectedList(input.expected)}\n\nMarking report pages follow.` },
      ...imageBlocks("Marking report", images),
    ],
    toolName: "return_report_page_map",
    toolDescription: "Return marking-report pages per requirement.",
    schema: {
      type: "object" as const,
      properties: {
        requirements: {
          type: "array",
          items: { type: "object", properties: { code: { type: "string" }, report_pages: { type: "array", items: { type: "integer" } } }, required: ["code", "report_pages"] },
        },
      },
      required: ["requirements"],
    },
    usage: input.usage,
    maxTokens: 3000,
  });
  const out: Record<string, number[]> = {};
  const maxPage = pages.length ? Math.max(...pages.map((p) => p.page)) : 0;
  for (const row of raw.requirements || []) {
    if (!row.code || !input.expected.some((item) => item.code === row.code)) continue;
    out[row.code] = (row.report_pages || []).filter((page) => Number.isInteger(page) && page >= 1 && page <= maxPage);
  }
  return out;
}

/** Read the student's own BMCR sheet: marks available and the marks they believed they knew. */
export async function readBmcr(input: {
  expected: ExpectedRequirement[];
  bmcrPages: PageRef[];
  usage: UsageTally;
  warnings: string[];
}): Promise<BmcrRow[]> {
  const pages = capPages(input.bmcrPages, "BMCR", input.warnings);
  const images = await fetchPageImages(pages);
  const raw = await callStructured<{ rows?: BmcrRow[] }>({
    system: `You read a student's completed BMCR worksheet. Per requirement the sheet shows the marks available, the marks the student believes they knew or could reasonably have obtained, and the student's own percentage. Transcribe exactly what the student wrote. If a cell is blank or illegible return null. Do not correct the student's arithmetic.`,
    userContent: [
      { type: "text", text: `Requirements:\n${expectedList(input.expected)}` },
      ...imageBlocks("BMCR worksheet", images),
    ],
    toolName: "return_bmcr_rows",
    toolDescription: "Transcribe the student's BMCR rows.",
    schema: {
      type: "object" as const,
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              available: { type: ["number", "null"] },
              student_known: { type: ["number", "null"] },
              student_percentage: { type: ["number", "null"] },
            },
            required: ["code", "available", "student_known", "student_percentage"],
          },
        },
      },
      required: ["rows"],
    },
    usage: input.usage,
    maxTokens: 3000,
  });
  const rows = (raw.rows || []).filter((row) => input.expected.some((item) => item.code === row.code));
  return input.expected.map((item) => rows.find((row) => row.code === item.code) || { code: item.code, available: null, student_known: null, student_percentage: null });
}

export { newUsage };
