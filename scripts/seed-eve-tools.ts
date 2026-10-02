/**
 * Seed Eve evaluator tools and supporting notes into coaching_insights.
 *
 *   npm run seed:eve
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const TOOLS_FILE = path.join(ROOT, "lib/data/eve-tools/tools.json");

type VaultDocument = {
  id: string;
  title: string;
  filename: string;
  content: string;
};

type Vault = {
  name: string;
  source: string;
  architecture: string;
  workingPrinciple: string;
  tools: string[];
  documents: VaultDocument[];
};

type InsightRow = {
  active: boolean;
  category: string;
  title: string;
  tool_code: string;
  pillar: string;
  subcategory: string;
  coaching_rule: string;
  diagnostic_routine: string;
  diagnostic_outcome: string;
  diagnostic_flow: Record<string, unknown>;
  nuance_notes: string | null;
  trigger_condition: Record<string, unknown>;
  saica_competency_mappings: string[] | null;
};

const TOOL_SEEDS: Array<{
  name: string;
  toolCode: string;
  documentId: string;
  heading?: string;
  outcome: string;
  routine: string;
  trigger: Record<string, unknown>;
}> = [
  {
    name: "BMCR",
    toolCode: "EVE_EVAL_BMCR",
    documentId: "bmcr",
    outcome: "BMCR_GAP",
    routine: "Compare actual technical marks to the student's post-exam Basic Marks. Do not diagnose why the gap occurred.",
    trigger: { runs_when_not_attempted: true },
  },
  {
    name: "Buried Treasure / Proximity",
    toolCode: "EVE_EVAL_BURIED_TREASURE",
    documentId: "buried-treasure-proximity",
    outcome: "PROXIMITY_CONVERSION",
    routine: "Classify each opportunity as Direct / Indirect / Thinking. Track whether it was visibly seen and whether it was awarded. Use Available as the denominator.",
    trigger: { requires_answer_evidence: true, skip_when_not_attempted: true },
  },
  {
    name: "Volume",
    toolCode: "EVE_EVAL_VOLUME",
    documentId: "volume-and-accuracy",
    heading: "Volume",
    outcome: "INSUFFICIENT_PRODUCTION",
    routine: "Count distinct mark-seeking attempts on the page. Do not count sentences, lines, paragraphs, or marks, and do not semantically deduplicate weak repeats.",
    trigger: { requires_answer_evidence: true, skip_when_not_attempted: true },
  },
  {
    name: "Accuracy",
    toolCode: "EVE_EVAL_ACCURACY",
    documentId: "volume-and-accuracy",
    heading: "Accuracy",
    outcome: "LOW_CONVERSION",
    routine: "Compute technical marks awarded / Volume to separate thin production from production that did not convert.",
    trigger: { requires_answer_evidence: true, skip_when_not_attempted: true },
  },
  {
    name: "Components",
    toolCode: "EVE_EVAL_COMPONENTS",
    documentId: "components",
    outcome: "STRUCTURE_NOT_USED",
    routine: "Ask whether useful structure was available, recognised, and exploited as a search space. Do not infer recognition from wording that merely resembles the mark plan.",
    trigger: { requires_answer_evidence: true, skip_when_not_attempted: true },
  },
  {
    name: "Core Issue",
    toolCode: "EVE_EVAL_CORE_ISSUE",
    documentId: "core-issue",
    outcome: "MISWEIGHTED_ATTENTION",
    routine: "Evaluate whether the student spent disproportionate time on the bucket the case was signalling. Read balance, depth, and weighting — not mere mention.",
    trigger: { requires_answer_evidence: true, skip_when_not_attempted: true },
  },
  {
    name: "RTFQ",
    toolCode: "EVE_EVAL_RTFQ",
    documentId: "rtfq",
    outcome: "REQUIRED_NOT_DELIVERED",
    routine: "Check whether the answer delivered the required shape, hidden directions/exclusions, and subject-matter lens. Do not diagnose why it failed.",
    trigger: { requires_answer_evidence: true, skip_when_not_attempted: true },
  },
  {
    name: "Question Type",
    toolCode: "EVE_EVAL_QUESTION_TYPE",
    documentId: "question-type-and-competency",
    heading: "Question Type",
    outcome: "QUESTION_TYPE",
    routine: "Classify the question as Discussion or Non-discussion. This is a longitudinal classifier, not a weakness diagnosis.",
    trigger: { runs_when_not_attempted: true },
  },
  {
    name: "Competency",
    toolCode: "EVE_EVAL_COMPETENCY",
    documentId: "question-type-and-competency",
    heading: "Competency",
    outcome: "COMPETENCY_TOPIC",
    routine: "Map the question to the high-level SAICA exam-topic taxonomy. Do not infer a broad competency weakness from one question.",
    trigger: { runs_when_not_attempted: true },
  },
  {
    name: "Communication",
    toolCode: "EVE_EVAL_COMMUNICATION",
    documentId: "communication",
    outcome: "COMMUNICATION_TREND",
    routine: "Score what made it onto the page as Complete, Underdeveloped, Unclear, or Miscommunicated. A mark not awarded is not automatically a Communication problem.",
    trigger: { requires_answer_evidence: true, skip_when_not_attempted: true },
  },
];

const NOTE_DOCUMENT_IDS = [
  "00-start-here",
  "evaluator-architecture",
  "working-principles",
  "not-attempted",
  "june-2026-paper-1-existing-locks",
  "june-2026-paper-2-part-ii-c",
  "open-questions",
] as const;

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function slugCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function extractSection(content: string, heading?: string) {
  if (!heading) return content.trim();
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|$)`, "m"));
  if (!match) {
    throw new Error(`Could not find heading "${heading}" in the vault document.`);
  }
  return match[1].trim();
}

function firstParagraph(text: string) {
  return (
    text
      .replace(/^#+\s+.+\n+/, "")
      .split(/\n\n+/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .find(Boolean) || text.slice(0, 240).trim()
  );
}

function competencyMappings(content: string) {
  const section = extractSection(content, "Competency");
  return section
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line && !line.startsWith("Do not infer") && !line.startsWith("High-level"));
}

function loadVault(): Vault {
  if (!existsSync(TOOLS_FILE)) {
    throw new Error(`Missing ${TOOLS_FILE}.`);
  }
  const vault = JSON.parse(readFileSync(TOOLS_FILE, "utf8")) as Vault;
  if (!Array.isArray(vault.tools) || vault.tools.length !== 10) {
    throw new Error(`Expected 10 evaluator tools in tools.json, found ${vault.tools?.length ?? 0}.`);
  }
  if (!Array.isArray(vault.documents) || !vault.documents.length) {
    throw new Error("tools.json has no documents.");
  }
  return vault;
}

function documentById(vault: Vault, id: string) {
  const document = vault.documents.find((entry) => entry.id === id);
  if (!document) throw new Error(`Vault is missing document "${id}".`);
  return document;
}

function buildRows(vault: Vault): InsightRow[] {
  const sharedFlow = {
    architecture: vault.architecture,
    working_principle: vault.workingPrinciple,
    source: vault.source,
    collect_intensely_report_lightly: true,
  };

  const missingTools = vault.tools.filter((name) => !TOOL_SEEDS.some((seed) => seed.name === name));
  if (missingTools.length) {
    throw new Error(`No seed mapping for tools: ${missingTools.join(", ")}`);
  }

  const toolRows = TOOL_SEEDS.map((seed) => {
    const document = documentById(vault, seed.documentId);
    const coachingRule = extractSection(document.content, seed.heading);
    return {
      active: true,
      category: "EVE_EVALUATOR_TOOL",
      title: seed.name,
      tool_code: seed.toolCode,
      pillar: "Evaluator",
      subcategory: seed.name,
      coaching_rule: coachingRule,
      diagnostic_routine: seed.routine,
      diagnostic_outcome: seed.outcome,
      diagnostic_flow: { ...sharedFlow, filename: document.filename, document_id: document.id },
      nuance_notes: seed.heading ? `Split from ${document.title}.` : null,
      trigger_condition: seed.trigger,
      saica_competency_mappings: seed.name === "Competency" ? competencyMappings(document.content) : null,
    };
  });

  const noteRows = NOTE_DOCUMENT_IDS.map((id) => {
    const document = documentById(vault, id);
    return {
      active: true,
      category: "EVE_EVALUATOR_NOTE",
      title: document.title,
      tool_code: `EVE_NOTE_${slugCode(id)}`,
      pillar: "Evaluator",
      subcategory: "Working note",
      coaching_rule: document.content.trim(),
      diagnostic_routine: firstParagraph(document.content),
      diagnostic_outcome: "METHODOLOGY_NOTE",
      diagnostic_flow: { ...sharedFlow, filename: document.filename, document_id: document.id },
      nuance_notes: "Supporting Eve evaluator methodology. Do not silently convert open questions into rules.",
      trigger_condition: { kind: "supporting_note" },
      saica_competency_mappings: null,
    };
  });

  return [...toolRows, ...noteRows];
}

async function upsertInsight(supabase: SupabaseClient, row: InsightRow) {
  const { data: existing, error: lookupError } = await supabase
    .from("coaching_insights")
    .select("id")
    .eq("tool_code", row.tool_code)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error(`${row.tool_code}: ${lookupError.message}`);

  if (existing?.id) {
    const { error } = await supabase.from("coaching_insights").update(row).eq("id", existing.id);
    if (error) throw new Error(`${row.tool_code}: ${error.message}`);
    return "updated";
  }

  const { error } = await supabase.from("coaching_insights").insert(row);
  if (error) throw new Error(`${row.tool_code}: ${error.message}`);
  return "inserted";
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const vault = loadVault();
  const rows = buildRows(vault);
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const action = await upsertInsight(supabase, row);
    if (action === "inserted") inserted += 1;
    else updated += 1;
    console.log(`${action}\t${row.tool_code}\t${row.title}`);
  }

  console.log(`Seeded ${rows.length} coaching_insights rows (${inserted} inserted, ${updated} updated).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
