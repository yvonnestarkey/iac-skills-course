import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getCourseJourney, getKnowledgeItem, listKnowledgeSources, searchKnowledge } from "@/lib/knowledge-gateway";
import { getSystemsModel, systemsModelConfigured } from "@/lib/systems-model";

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
  const course = sources.sources.find((item) => item.source_type === "course");
  const lesson = sources.sources.find((item) => item.source_type === "lesson");
  const canon = sources.sources.find((item) => item.source_type === "project_canon");
  const working = sources.sources.find((item) => item.source_type === "working_state");
  assert((research?.status?.research_papers || 0) === 101, "research paper chunk count should stay 101");
  assert((research?.status?.competency_framework || 0) === 578, "competency framework count should stay 578");
  assert(research?.count === 679, "research total should stay 679");
  assert((course?.count || 0) === 19, "course chapter count should stay 19");
  assert((lesson?.count || 0) === 145, "lesson count should stay 145");
  assert((canon?.count || 0) >= 1, "project_canon should remain present");
  assert((working?.count || 0) >= 1, "working_state should remain present");

  const journey = await getCourseJourney();
  assert(journey.chapters.length === 19 && journey.lesson_count === 145, "live course journey should stay 19/145");

  const queries = [
    "Tracing the Pipeline Leak",
    "Mindset Meaning System accounting",
    "effort and struggle",
    "failure trigger unmanageable challenge",
    "untested optimism",
  ];
  const results: Record<string, unknown> = {
    research_status: research,
    course: { chapters: course?.count, lessons: lesson?.count },
  };
  const retrievedIds: string[] = [];

  for (const query of queries) {
    const found = await searchKnowledge({ query, source_type: "research", limit: 10 });
    const paperHits = found.items.filter((item) => /Tracing the Pipeline Leak/i.test(item.title) && item.source_type === "research");
    assert(paperHits.length > 0, `searchKnowledge("${query}") should return this paper`);
    retrievedIds.push(...paperHits.map((item) => item.id));
    results[query] = {
      hits: found.items.length,
      paper_hits: paperHits.length,
      first: { id: paperHits[0].id, title: paperHits[0].title, document: paperHits[0].provenance.document },
    };
  }

  const curlyTitle = await searchKnowledge({
    query: "Tracing the Pipeline Leak: A Reverse-Diagnostic of the Accounting Student’s Mindset Meaning System",
    source_type: "research",
    limit: 5,
  });
  assert(
    curlyTitle.items.some((item) => /Tracing the Pipeline Leak/i.test(item.title)),
    "curly-apostrophe exact title should still resolve to this paper"
  );

  const firstId = retrievedIds.find((id) => id) || "";
  const item = await getKnowledgeItem(firstId);
  assert(item, "getKnowledgeItem should return a chunk");
  assert(fromPaper(item), "retrieved content must be from the paper, not the Project Brief");
  assert(item.source_type === "research", "item source_type must be research");

  const laterHit =
    (await searchKnowledge({ query: "failure trigger unmanageable challenge", source_type: "research", limit: 10 })).items.find(
      (entry) => /Tracing the Pipeline Leak/i.test(entry.title)
    ) || null;
  const later = laterHit ? await getKnowledgeItem(laterHit.id) : null;
  assert(later && fromPaper(later), "a later-section query should still resolve through getKnowledgeItem");
  const pages = [item.content, later.content].join("\n").match(/--- Page (\d+) ---/g) || [];
  assert(pages.length >= 1, "retrieved chunks should keep page markers from the source extract");
  assert(item.id !== later.id || /Page 2[0-9]|Page 4[0-9]/i.test(later.content), "chunks from different portions should be retrievable");

  const unrelated = await searchKnowledge({ query: "CA of the Future competency", source_type: "research", limit: 5 });
  assert(unrelated.items.length > 0, "unrelated research search should still return competency/research hits");

  if (await systemsModelConfigured()) {
    const model = await getSystemsModel();
    const recordCount = Object.values(model.records).flat().length + model.superseded.length;
    assert(!model.checkpoint, "systems-model checkpoint should remain empty");
    assert(recordCount === 0, "systems-model records should remain empty");
    results.systems_model = { checkpoint: model.checkpoint, records: recordCount, working_state: model.working_state.version };
  }

  results.getKnowledgeItem = {
    id: item.id,
    title: item.title,
    source_type: item.source_type,
    provenance: item.provenance,
    content_preview: item.content.slice(0, 400),
    from_actual_paper: true,
  };
  results.later_chunk = {
    id: later.id,
    title: later.title,
    page_markers: [...new Set([...(later.content.match(/--- Page \d+ ---/g) || []), ...(item.content.match(/--- Page \d+ ---/g) || [])])],
  };
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
