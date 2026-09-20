import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  getCourseJourney,
  getCourseLessonFull,
  getKnowledgeItem,
  listKnowledgeSources,
  searchKnowledge,
} from "@/lib/knowledge-gateway";

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

async function main() {
  loadEnvLocal();
  const results: Record<string, unknown> = {};

  const sources = await listKnowledgeSources();
  const types = sources.sources.map((item) => item.source_type);
  assert(types.includes("lesson") && types.includes("video_transcript") && types.includes("past_paper"), "sources missing required types");
  const lessonSource = sources.sources.find((item) => item.source_type === "lesson");
  assert((lessonSource?.count || 0) > 0, "live lesson count should not be zero");
  results.listKnowledgeSources = {
    ok: true,
    lesson_count: lessonSource?.count,
    transcript: sources.sources.find((item) => item.source_type === "video_transcript"),
    past_paper_count: sources.sources.find((item) => item.source_type === "past_paper")?.count,
  };

  const lessonSearch = await searchKnowledge({ query: "BMCR", source_type: "lesson", limit: 5 });
  assert(lessonSearch.items.length > 0, "searchKnowledge should find lesson BMCR hits");
  const contextSearch = await searchKnowledge({ query: "North Star", source_type: "project_canon", limit: 3 });
  assert(contextSearch.items.some((item) => item.source_type === "project_canon"), "searchKnowledge should find project canon");
  const paperSearch = await searchKnowledge({ query: "June 2026", source_type: "past_paper", limit: 5 });
  assert(paperSearch.items.length > 0, "searchKnowledge should include local past papers");
  results.searchKnowledge = {
    ok: true,
    lesson_hits: lessonSearch.items.length,
    canon_hits: contextSearch.items.length,
    past_paper_hits: paperSearch.items.length,
  };

  const item = await getKnowledgeItem(contextSearch.items[0].id);
  assert(item?.content && item.content.includes("North Star"), "getKnowledgeItem should return project canon text");
  assert(item.chunk && item.chunk.total >= item.content.length, "getKnowledgeItem should support chunk metadata");
  results.getKnowledgeItem = { ok: true, id: item.id, content_chars: item.chunk?.total };

  const journey = await getCourseJourney();
  assert(journey.lesson_count === (lessonSource?.count || 0), "journey lesson count must match live source count");
  const first = journey.chapters[0]?.lessons[0];
  const lastChapter = journey.chapters[journey.chapters.length - 1];
  const last = lastChapter?.lessons[lastChapter.lessons.length - 1];
  assert(first?.next_lesson, "first lesson should have next");
  assert(last?.previous_lesson, "last lesson should have previous");
  assert(first && !first.previous_lesson, "first lesson should not have previous");
  const multi = journey.chapters.flatMap((chapter) => chapter.lessons).find((lesson) => lesson.videos.length > 1);
  results.getCourseJourney = {
    ok: true,
    chapters: journey.chapter_count,
    lessons: journey.lesson_count,
    first: first ? { id: first.id, next: first.next_lesson?.id } : null,
    last: last ? { id: last.id, previous: last.previous_lesson?.id } : null,
    multi_video_lesson: multi ? { id: multi.id, videos: multi.videos.length } : null,
  };

  const full = await getCourseLessonFull(String(multi?.id || first?.id || "ch15-l3"));
  assert(full, "getCourseLessonFull should return a live lesson");
  assert(Array.isArray(full?.videos), "lesson full should include videos array");
  assert(Array.isArray(full?.transcripts), "lesson full should include transcripts array");
  assert((full?.videos.length || 0) >= 1, "a multi-video lesson should return every associated video");
  const leaked = JSON.stringify(full).match(/assignment-submissions|survey-responses/);
  assert(!leaked, "gateway must not expose student storage paths");
  results.getCourseLessonFull = {
    ok: true,
    id: full?.id,
    video_count: full?.videos.length,
    transcript_count: full?.transcripts.length,
    resource_count: full?.resources.length,
    student_paths_leaked: false,
  };

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
