import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPEC = path.join(ROOT, "public/openapi.yaml");
const ROUTES = path.join(ROOT, "app/api");
const VERSION = "1.1.0";

const REQUIRED_EXISTING = [
  "searchKnowledgeBase",
  "getMarkConfigurations",
  "updateMarkConfiguration",
  "addCoachingInsight",
  "listCourseStructure",
  "getCourseLesson",
  "listKnowledgeSources",
  "searchKnowledge",
  "getKnowledgeItem",
  "getCourseJourney",
  "getCourseLessonFull",
  "getMindsetSandboxContext",
  "getEvaluatorAttemptEvidence",
  "getEvaluatorAttemptEvidenceByQuery",
];

const REQUIRED_SYSTEMS = [
  "getSystemsModel",
  "getSystemsModelByGet",
  "getSystemsModelEvidence",
  "addSystemsObservation",
  "upsertSystemsInterpretation",
  "recordSystemsRevision",
  "recordYvonneSystemsReview",
  "upsertSystemsQuestion",
  "getCurrentSystemsCheckpoint",
  "createSystemsCheckpoint",
  "getSystemsCheckpoint",
  "getSystemsWorkingState",
  "updateSystemsWorkingState",
];

const ROUTE_MAP: Record<string, string> = {
  getEvaluatorAttemptEvidence: "app/api/mindset-sandbox/evaluator-evidence/route.ts",
  getSystemsModel: "app/api/mindset-sandbox/systems/model/route.ts",
  getSystemsModelEvidence: "app/api/mindset-sandbox/systems/evidence/route.ts",
  addSystemsObservation: "app/api/mindset-sandbox/systems/observations/route.ts",
  upsertSystemsInterpretation: "app/api/mindset-sandbox/systems/interpretations/route.ts",
  recordSystemsRevision: "app/api/mindset-sandbox/systems/revisions/route.ts",
  recordYvonneSystemsReview: "app/api/mindset-sandbox/systems/yvonne-review/route.ts",
  upsertSystemsQuestion: "app/api/mindset-sandbox/systems/questions/route.ts",
  getCurrentSystemsCheckpoint: "app/api/mindset-sandbox/systems/checkpoints/route.ts",
  createSystemsCheckpoint: "app/api/mindset-sandbox/systems/checkpoints/route.ts",
  getSystemsCheckpoint: "app/api/mindset-sandbox/systems/checkpoints/[id]/route.ts",
  getSystemsWorkingState: "app/api/mindset-sandbox/systems/working-state/route.ts",
  updateSystemsWorkingState: "app/api/mindset-sandbox/systems/working-state/route.ts",
};

const ACTION_OPERATIONS = ["getEvaluatorAttemptEvidence", "getSystemsModel"] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function indentOf(line: string): number {
  return line.match(/^(\s*)/)?.[1].length ?? 0;
}

function objectSchemasMissingProperties(yaml: string): string[] {
  const lines = yaml.split("\n");
  const missing: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*type:\s*object\s*$/.test(lines[i])) continue;
    const indent = indentOf(lines[i]);
    let hasProperties = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const lead = indentOf(line);
      if (lead < indent) break;
      if (lead === indent && /^\s*properties:\s*(\{\s*\})?\s*$/.test(line)) {
        hasProperties = true;
        break;
      }
    }
    if (!hasProperties) missing.push(`line ${i + 1}`);
  }
  return missing;
}

function collectRefs(text: string): string[] {
  return [...text.matchAll(/\$ref:\s+"#\/components\/schemas\/([^"]+)"/g)].map((match) => match[1]);
}

function schemaBlock(yaml: string, name: string): string {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line === `    ${name}:`);
  if (start < 0) return "";
  const chunk = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^    [A-Za-z0-9]+:\s*$/.test(lines[i]) && indentOf(lines[i]) === 4) break;
    if (lines[i].startsWith("  ") && !lines[i].startsWith("    ")) break;
    chunk.push(lines[i]);
  }
  return chunk.join("\n");
}

function operationBlock(yaml: string, operationId: string): string {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.trim() === `operationId: ${operationId}`);
  if (start < 0) return "";
  let from = start;
  while (from > 0 && !/^\s{4}(get|post|patch|put|delete):\s*$/.test(lines[from])) from -= 1;
  const chunk = [lines[from]];
  for (let i = from + 1; i < lines.length; i++) {
    if (/^\s{4}(get|post|patch|put|delete):\s*$/.test(lines[i])) break;
    if (/^  \//.test(lines[i])) break;
    if (lines[i] === "components:") break;
    chunk.push(lines[i]);
  }
  return chunk.join("\n");
}

function reachableSchemas(yaml: string, operationIds: readonly string[]): string[] {
  const pending = new Set<string>();
  for (const id of operationIds) {
    for (const ref of collectRefs(operationBlock(yaml, id))) pending.add(ref);
  }
  const seen = new Set<string>();
  while (pending.size) {
    const name = pending.values().next().value as string;
    pending.delete(name);
    if (seen.has(name)) continue;
    seen.add(name);
    for (const ref of collectRefs(schemaBlock(yaml, name))) pending.add(ref);
  }
  return [...seen];
}

function descriptionTooLong(yaml: string): string[] {
  const lines = yaml.split("\n");
  const long: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const summary = lines[i].match(/^\s*summary:\s+(.*)$/);
    if (summary && summary[1].length > 300) long.push(`summary line ${i + 1} is ${summary[1].length} chars`);
    const description = lines[i].match(/^\s*description:\s+(.*)$/);
    if (description && description[1].length > 300) long.push(`description line ${i + 1} is ${description[1].length} chars`);
  }
  return long;
}

function main() {
  const yaml = readFileSync(SPEC, "utf8");
  assert(yaml.startsWith("openapi: 3.1."), "OpenAPI must be 3.1.x");
  assert(new RegExp(`version: ${VERSION.replace(".", "\\.")}`).test(yaml), `info.version should be ${VERSION}`);

  const operationIds = [...yaml.matchAll(/operationId:\s+(\S+)/g)].map((match) => match[1]);
  const duplicates = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);
  assert(!duplicates.length, `Duplicate operationIds: ${duplicates.join(", ")}`);

  for (const id of REQUIRED_EXISTING) assert(operationIds.includes(id), `Missing existing operationId ${id}`);
  for (const id of REQUIRED_SYSTEMS) assert(operationIds.includes(id), `Missing systems operationId ${id}`);

  const refs = collectRefs(yaml);
  const schemas = [...yaml.matchAll(/^    ([A-Za-z0-9]+):\s*$/gm)].map((match) => match[1]);
  for (const ref of refs) assert(schemas.includes(ref), `Unresolved schema ref ${ref}`);

  assert(!/path-level/.test(yaml), "unexpected marker");
  const pathBlocks = yaml.split("\n  /").slice(1);
  for (const block of pathBlocks) {
    const header = block.split("\n")[0];
    const beforeGet = block.split(/\n    (get|post|patch|put|delete):/)[0];
    assert(!/^\n    parameters:/m.test(`\n${beforeGet}`), `Path-level parameters on /${header}`);
  }

  const bytes = Buffer.byteLength(yaml);
  assert(bytes < 80_000, `OpenAPI is ${bytes} bytes; keep the Action schema compact`);

  const forbidden = ["/api/sql", "/api/query", "/rpc", "arbitrary SQL", "generic table CRUD"];
  for (const token of forbidden) assert(!yaml.toLowerCase().includes(token.toLowerCase()), `Forbidden surface: ${token}`);

  const apiFiles = walk(ROUTES).filter((file) => file.endsWith("route.ts")).map((file) => path.relative(ROOT, file));
  for (const [operationId, file] of Object.entries(ROUTE_MAP)) {
    assert(existsSync(path.join(ROOT, file)), `${operationId} route missing: ${file}`);
    assert(apiFiles.includes(file), `${operationId} is not an app route`);
  }

  const missingProperties = objectSchemasMissingProperties(yaml);
  assert(!missingProperties.length, `ChatGPT Actions require properties on every type: object (${missingProperties.join(", ")})`);
  assert(!/additionalProperties:\s*true/.test(yaml), "ChatGPT Actions reject unconstrained additionalProperties: true");

  const longCopy = descriptionTooLong(yaml);
  assert(!longCopy.length, `ChatGPT Actions description/summary limit is 300 chars (${longCopy.join("; ")})`);

  const reachable = reachableSchemas(yaml, ACTION_OPERATIONS);
  assert(reachable.includes("GetEvaluatorAttemptEvidenceRequest"), "getEvaluatorAttemptEvidence request schema missing");
  assert(reachable.includes("GetSystemsModelRequest"), "getSystemsModel request schema missing");
  assert(reachable.includes("EvaluatorAttemptEvidence"), "getEvaluatorAttemptEvidence 200 schema missing");
  assert(reachable.includes("SystemsModel"), "getSystemsModel 200 schema missing");
  for (const name of reachable) {
    const block = schemaBlock(yaml, name);
    assert(block.includes("properties:"), `Reachable schema ${name} is missing properties`);
    assert(!/additionalProperties:\s*true/.test(block), `Reachable schema ${name} has unconstrained additionalProperties`);
  }

  const evidenceRequest = schemaBlock(yaml, "GetEvaluatorAttemptEvidenceRequest");
  assert(/required:[\s\S]*attempt_id/.test(evidenceRequest), "Evaluator request must require attempt_id");
  const modelRequest = schemaBlock(yaml, "GetSystemsModelRequest");
  assert(/properties:\s*\{\s*\}/.test(modelRequest), "getSystemsModel request must be an explicit empty object");

  console.log(
    JSON.stringify(
      {
        ok: true,
        version: VERSION,
        operation_count: operationIds.length,
        bytes,
        existing_preserved: REQUIRED_EXISTING,
        systems_operations: REQUIRED_SYSTEMS,
        duplicate_operationIds: [],
        unresolved_refs: [],
        path_level_parameters: false,
        generic_sql_exposed: false,
        routes_match_implementation: true,
        chatgpt_actions: {
          compatible: true,
          object_schemas_missing_properties: [],
          unconstrained_additional_properties: false,
          description_limit_ok: true,
          action_operations: ACTION_OPERATIONS,
          reachable_schemas: reachable,
          request_bodies_explicit: true,
        },
      },
      null,
      2
    )
  );
}

main();
