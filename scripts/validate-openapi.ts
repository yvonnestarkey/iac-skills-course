import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPEC = path.join(ROOT, "public/openapi.yaml");
const ROUTES = path.join(ROOT, "app/api");

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
];

const REQUIRED_SYSTEMS = [
  "getSystemsModel",
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

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function main() {
  const yaml = readFileSync(SPEC, "utf8");
  assert(yaml.startsWith("openapi: 3.1."), "OpenAPI must be 3.1.x");
  assert(/version: 1\.0\.7/.test(yaml), "info.version should be 1.0.7");

  const operationIds = [...yaml.matchAll(/operationId:\s+(\S+)/g)].map((match) => match[1]);
  const duplicates = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);
  assert(!duplicates.length, `Duplicate operationIds: ${duplicates.join(", ")}`);

  for (const id of REQUIRED_EXISTING) assert(operationIds.includes(id), `Missing existing operationId ${id}`);
  for (const id of REQUIRED_SYSTEMS) assert(operationIds.includes(id), `Missing systems operationId ${id}`);

  const refs = [...yaml.matchAll(/\$ref:\s+"#\/components\/schemas\/([^"]+)"/g)].map((match) => match[1]);
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        version: "1.0.7",
        operation_count: operationIds.length,
        bytes,
        existing_preserved: REQUIRED_EXISTING,
        systems_operations: REQUIRED_SYSTEMS,
        duplicate_operationIds: [],
        unresolved_refs: [],
        path_level_parameters: false,
        generic_sql_exposed: false,
        routes_match_implementation: true,
      },
      null,
      2
    )
  );
}

main();
