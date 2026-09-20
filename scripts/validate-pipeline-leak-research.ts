import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getKnowledgeItem, listKnowledgeSources, searchKnowledge } from "@/lib/knowledge-gateway";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
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
    if (!process.env[key]) process.env[key] = value;
  }
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function fromPaper(item: { title: string; content: string; provenance: Record<string, unknown> }): boolean {
  const category = String(item.provenance.category || "");
  const document = String(item.provenance.document || item.title);
  return (
    category === "research" &&
    /Tracing the Pipeline Leak/i.test(document) &&
    !/Project Brief/i.test(item.content) &&
    /pipeline leak|Mindset Meaning System|failure trigger|--- Page \d+ ---|Dweck/i.test(item.content)
  );
}

async function main() {
  loadEnvLocal();
  const sources = await listKnowledgeSources();
  const research = sources.sources.find((item) => item.source_type === "research");
  assert((research?.status?.research_papers || 0) >= 101, "research paper chunks should be listed");

  const queries = ["Tracing the Pipeline Leak", "Mindset Meaning System", "failure-trigger"];
  const results: Record<string, unknown> = { research_status: research };
  let itemId = "";

  for (const query of queries) {
    const found = await searchKnowledge({ query, source_type: "research", limit: 10 });
    const paperHits = found.items.filter((item) => /Tracing the Pipeline Leak/i.test(item.title) && item.source_type === "research");
    assert(paperHits.length > 0, `searchKnowledge("${query}") should return this paper`);
    const firstChunk = paperHits.find((item) => /\(1\)$/.test(item.title)) || paperHits[0];
    if (!itemId) itemId = firstChunk.id;
    results[query] = {
      hits: found.items.length,
      paper_hits: paperHits.length,
      first: paperHits[0],
    };
  }

  const item = await getKnowledgeItem(itemId);
  assert(item, "getKnowledgeItem should return a chunk");
  assert(fromPaper(item), "retrieved content must be from the paper, not the Project Brief");
  assert(item.source_type === "research", "item source_type must be research");
  results.getKnowledgeItem = {
    id: item.id,
    title: item.title,
    source_type: item.source_type,
    provenance: item.provenance,
    content_preview: item.content.slice(0, 400),
    from_actual_paper: true,
  };
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
