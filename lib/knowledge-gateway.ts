import { listPreviewLessonIds } from "@/lib/commerce";
import { isTaskChapter } from "@/lib/course-phases";
import { fetchLessonTranscripts, type LessonTranscript } from "@/lib/lesson-transcripts";
import { parseLessonVideos, videoIdentity } from "@/lib/lesson-videos";
import { getLessonPdfUrl } from "@/lib/getLessonPdf";
import { getSupabaseAdmin } from "@/lib/knowledge-gateway-db";
import { PAST_PAPER_SITTINGS, pastPaperDisplayName } from "@/lib/past-papers";

export const SOURCE_TYPES = [
  "course",
  "lesson",
  "video_transcript",
  "worksheet",
  "resource",
  "research",
  "past_paper",
  "mark_plan",
  "examiner_commentary",
  "yvonne_feedback",
  "coaching_transcript",
  "methodology",
  "project_canon",
  "working_state",
  "historical_evidence",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
export type KnowledgeLayer = "source" | "distilled" | "working_state";

export interface KnowledgeRef {
  id: string;
  source_type: SourceType;
  title: string;
  layer: KnowledgeLayer;
  provenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
  relationships: { id: string; relation: string }[];
}

export interface KnowledgeItem extends KnowledgeRef {
  content: string;
  chunk?: { offset: number; limit: number; total: number; has_more: boolean };
}

export interface KnowledgeSourceSummary {
  source_type: SourceType;
  layer: KnowledgeLayer;
  count: number;
  status?: Record<string, number>;
  notes?: string;
}

const STUDENT_STORAGE = /assignment-submissions|survey-responses/i;
const DEFAULT_CHUNK = 12000;

function encodeId(type: string, ...parts: string[]): string {
  return [type, ...parts.map((part) => encodeURIComponent(part))].join(":");
}

export function parseKnowledgeId(id: string): { type: string; parts: string[] } | null {
  const [type, ...rest] = id.split(":");
  if (!type || !rest.length) return null;
  return { type, parts: rest.map((part) => decodeURIComponent(part)) };
}

function layerForSource(type: SourceType): KnowledgeLayer {
  if (type === "working_state") return "working_state";
  if (type === "methodology" || type === "project_canon") return "distilled";
  return "source";
}

function kbSourceType(category: string): SourceType {
  if (category === "examiner_report") return "examiner_commentary";
  if (category === "mark_plan") return "mark_plan";
  if (category === "competency_framework" || category === "research") return "research";
  return "research";
}

function kbCategoriesFor(sourceType?: SourceType): string[] | null {
  if (sourceType === "examiner_commentary") return ["examiner_report"];
  if (sourceType === "mark_plan") return ["mark_plan"];
  if (sourceType === "research") return ["research", "competency_framework"];
  if (!sourceType) return null;
  return [];
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchVariants(query: string): string[] {
  const raw = query.trim();
  if (!raw) return [];
  const ascii = raw.replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"');
  const spaced = normalizeSearchText(ascii);
  return [...new Set([raw, ascii, spaced].map((item) => item.trim()).filter(Boolean))];
}

const SEARCH_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "are",
  "was",
  "were",
  "into",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "or",
  "as",
  "is",
  "it",
]);

function significantTokens(query: string): string[] {
  return [
    ...new Set(
      normalizeSearchText(query)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token))
    ),
  ];
}

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim();
}

function quoteIlikeValue(value: string): string {
  const clean = sanitizeIlike(value);
  if (!clean) return "";
  return `"%${clean.replace(/"/g, '""')}%"`;
}

function kbIlikeOr(needles: string[]): string {
  return needles
    .flatMap((needle) => {
      const quoted = quoteIlikeValue(needle);
      return quoted ? [`content.ilike.${quoted}`, `document_title.ilike.${quoted}`] : [];
    })
    .join(",");
}

function kbRowHaystack(row: Record<string, unknown>): string {
  return normalizeSearchText(`${row.document_title || ""}\n${row.content || ""}`).toLowerCase();
}

function kbSearchScore(row: Record<string, unknown>, query: string, tokens: string[]): number {
  const hay = kbRowHaystack(row);
  let score = String(row.category || "") === "research" ? 20 : 0;
  for (const variant of searchVariants(query)) {
    const needle = normalizeSearchText(variant).toLowerCase();
    if (needle && hay.includes(needle)) score += 50;
  }
  for (const token of tokens) {
    if (hay.includes(token)) score += 8;
  }
  return score;
}

function asParagraphs(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item || "")).filter(Boolean).join("\n\n");
  return typeof value === "string" ? value : "";
}

function teachingResourceUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (STUDENT_STORAGE.test(url)) return null;
  return url;
}

function listTeachingResources(pdfUrl: unknown, downloads: unknown): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  const primary = teachingResourceUrl(getLessonPdfUrl({ pdf_url: pdfUrl, resource_downloads: downloads }));
  if (primary) out.push({ title: "Lesson PDF", url: primary });
  const list = Array.isArray(downloads) ? downloads : [];
  list.forEach((item, index) => {
    const raw =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? String(
              (item as Record<string, unknown>).file_url ||
                (item as Record<string, unknown>).url ||
                (item as Record<string, unknown>).href ||
                ""
            )
          : "";
    const url = teachingResourceUrl(raw);
    if (!url || out.some((entry) => entry.url === url)) return;
    const title =
      item && typeof item === "object"
        ? String((item as Record<string, unknown>).name || (item as Record<string, unknown>).title || `Resource ${index + 1}`)
        : `Resource ${index + 1}`;
    out.push({ title, url });
  });
  return out;
}

function taskFromChapter(title: string): string | null {
  const numbered = title.match(/Task\s+\d+/i);
  if (numbered) return numbered[0];
  if (isTaskChapter(title)) return title.split("-")[0].trim();
  const section = title.match(/^S\d+/i);
  return section ? section[0] : null;
}

function vimeoIdFromVideo(url: string): string | null {
  const identity = videoIdentity(url);
  return identity.startsWith("vimeo:") ? identity.slice(6) : null;
}

function chunkContent(content: string, offset = 0, limit = DEFAULT_CHUNK) {
  const start = Math.max(0, offset);
  const size = Math.min(Math.max(limit, 200), 20000);
  return {
    content: content.slice(start, start + size),
    chunk: {
      offset: start,
      limit: size,
      total: content.length,
      has_more: start + size < content.length,
    },
  };
}

function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const needles = searchVariants(query)
    .map((item) => normalizeSearchText(item).toLowerCase())
    .filter(Boolean);
  if (!needles.length) return true;
  return needles.some((needle) =>
    fields.some((field) => normalizeSearchText(field || "").toLowerCase().includes(needle))
  );
}

type LessonRow = Record<string, unknown>;
type ChapterRow = { id: string; title: string; summary?: string | null; position: number };

async function loadChapters(): Promise<ChapterRow[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];
  const { data } = await client.from("chapters").select("id, title, summary, position").order("position", { ascending: true });
  return (data || []) as ChapterRow[];
}

async function loadLessons(): Promise<LessonRow[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];
  const { data } = await client
    .from("lessons")
    .select(
      "id, chapter_id, position, type, title, blurb, body, takeaways, brief, video_urls, pdf_url, resource_downloads, prereq_lesson_id, requires_submission, requires_coach_approval, unlock_at"
    )
    .order("position", { ascending: true });
  return (data || []) as LessonRow[];
}

function orderedLessons(chapters: ChapterRow[], lessons: LessonRow[]): LessonRow[] {
  const chapterRank = new Map(chapters.map((chapter, index) => [chapter.id, chapter.position ?? index]));
  return [...lessons].sort((a, b) => {
    const aRank = chapterRank.get(String(a.chapter_id)) ?? 9999;
    const bRank = chapterRank.get(String(b.chapter_id)) ?? 9999;
    if (aRank !== bRank) return aRank - bRank;
    return Number(a.position || 0) - Number(b.position || 0);
  });
}

function lessonVideos(row: LessonRow) {
  return parseLessonVideos(row.video_urls).map((video) => ({
    url: video.url,
    heading: video.heading || null,
    after: video.after || null,
    vimeo_id: vimeoIdFromVideo(video.url),
  }));
}

export async function listCourseVimeoVideos(): Promise<{ lessonId: string; vimeoId: string }[]> {
  const lessons = await loadLessons();
  const out: { lessonId: string; vimeoId: string }[] = [];
  const seen = new Set<string>();
  for (const lesson of lessons) {
    for (const video of lessonVideos(lesson)) {
      if (!video.vimeo_id) continue;
      const key = `${lesson.id}:${video.vimeo_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ lessonId: String(lesson.id), vimeoId: video.vimeo_id });
    }
  }
  return out;
}

export async function listKnowledgeSources(): Promise<{ sources: KnowledgeSourceSummary[] }> {
  const client = getSupabaseAdmin();
  const [chapters, lessons, transcripts] = await Promise.all([loadChapters(), loadLessons(), fetchLessonTranscripts()]);
  const kbCounts: Record<string, number> = {};
  if (client) {
    for (const category of ["research", "competency_framework", "examiner_report", "mark_plan"]) {
      const { count } = await client.from("knowledge_base").select("id", { count: "exact", head: true }).eq("category", category);
      kbCounts[category] = count || 0;
    }
  }
  const contexts = client
    ? ((await client.from("mindset_sandbox_context").select("context_type, status").eq("status", "current")).data || [])
    : [];
  const insights = client ? (await client.from("coaching_insights").select("id")).data || [] : [];
  const transcriptStatus: Record<string, number> = {};
  for (const row of transcripts) {
    transcriptStatus[row.status] = (transcriptStatus[row.status] || 0) + 1;
  }
  const imported = transcripts.filter((row) => row.status === "imported").length;
  const teachingResources = lessons.reduce((sum, lesson) => sum + listTeachingResources(lesson.pdf_url, lesson.resource_downloads).length, 0);

  const sources: KnowledgeSourceSummary[] = [
    { source_type: "course", layer: "source", count: chapters.length, notes: "Live chapters in student order" },
    { source_type: "lesson", layer: "source", count: lessons.length, notes: "Live lessons; count is not hard-coded" },
    {
      source_type: "video_transcript",
      layer: "source",
      count: imported,
      status: transcriptStatus,
      notes: imported ? "Imported Vimeo caption source text" : "Transcript model ready; sync when VIMEO_ACCESS_TOKEN is set",
    },
    { source_type: "resource", layer: "source", count: teachingResources, notes: "Approved teaching PDF/resource URLs only" },
    { source_type: "worksheet", layer: "source", count: 0, notes: "No extracted worksheet text yet; discovery via lesson resources" },
    {
      source_type: "research",
      layer: "source",
      count: (kbCounts.research || 0) + (kbCounts.competency_framework || 0),
      status: { research_papers: kbCounts.research || 0, competency_framework: kbCounts.competency_framework || 0 },
      notes: "Ingested research papers plus competency-framework source text",
    },
    { source_type: "examiner_commentary", layer: "source", count: kbCounts.examiner_report || 0 },
    { source_type: "mark_plan", layer: "source", count: kbCounts.mark_plan || 0 },
    {
      source_type: "past_paper",
      layer: "source",
      count: PAST_PAPER_SITTINGS.reduce((sum, sitting) => sum + sitting.papers.length, 0),
      notes: "Approved local past-paper registry",
    },
    { source_type: "methodology", layer: "distilled", count: insights.length },
    {
      source_type: "project_canon",
      layer: "distilled",
      count: contexts.filter((row) => (row as { context_type?: string }).context_type === "project_canon").length,
    },
    {
      source_type: "working_state",
      layer: "working_state",
      count: contexts.filter((row) => (row as { context_type?: string }).context_type === "working_state").length,
    },
    { source_type: "yvonne_feedback", layer: "source", count: 0, notes: "Deferred; student-linked feedback is not in this gateway" },
    { source_type: "coaching_transcript", layer: "source", count: 0, notes: "No Fireflies/coaching transcript archive yet" },
    { source_type: "historical_evidence", layer: "source", count: 0, notes: "Reserved for later pseudonymised research views" },
  ];
  return { sources };
}

function kbDocumentStem(title: string): string {
  return String(title || "").replace(/\s+\(\d+\)$/, "").trim();
}

function kbRef(row: Record<string, unknown>): KnowledgeRef {
  const title = String(row.document_title || "Knowledge item");
  const stem = kbDocumentStem(title);
  return {
    id: encodeId("kb", String(row.id)),
    source_type: kbSourceType(String(row.category || "")),
    title,
    layer: "source",
    provenance: {
      table: "knowledge_base",
      category: row.category,
      document: stem,
      ingested_at: row.created_at || null,
    },
    metadata: { category: row.category, document: stem },
    relationships: stem ? [{ id: encodeId("kb-doc", stem), relation: "document" }] : [],
  };
}

function lessonRef(row: LessonRow, chapter?: ChapterRow): KnowledgeRef {
  const videos = lessonVideos(row);
  return {
    id: encodeId("lesson", String(row.id)),
    source_type: "lesson",
    title: String(row.title || row.id),
    layer: "source",
    provenance: { table: "lessons", lesson_id: row.id },
    metadata: {
      chapter_id: row.chapter_id,
      chapter_title: chapter?.title || null,
      position: row.position,
      lesson_type: row.type,
      task: chapter ? taskFromChapter(chapter.title) : null,
      video_count: videos.length,
    },
    relationships: [
      ...(chapter ? [{ id: encodeId("chapter", chapter.id), relation: "chapter" }] : []),
      ...videos
        .filter((video) => video.vimeo_id)
        .map((video) => ({ id: encodeId("transcript", String(row.id), video.vimeo_id!), relation: "video" })),
    ],
  };
}

export async function searchKnowledge(input: {
  query: string;
  source_type?: string;
  chapter_id?: string;
  lesson_id?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: KnowledgeRef[]; next_cursor: string | null }> {
  const query = input.query.trim();
  if (!query) return { items: [], next_cursor: null };
  const limit = Math.min(Math.max(input.limit || 20, 1), 50);
  const sourceType = SOURCE_TYPES.includes(input.source_type as SourceType) ? (input.source_type as SourceType) : undefined;
  const hits: KnowledgeRef[] = [];
  const client = getSupabaseAdmin();
  const [chapters, lessons, transcripts] = await Promise.all([loadChapters(), loadLessons(), fetchLessonTranscripts()]);
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  if (!sourceType || sourceType === "lesson" || sourceType === "course") {
    for (const lesson of lessons) {
      if (input.chapter_id && String(lesson.chapter_id) !== input.chapter_id) continue;
      if (input.lesson_id && String(lesson.id) !== input.lesson_id) continue;
      if (!matchesQuery(query, String(lesson.title || ""), String(lesson.blurb || ""), asParagraphs(lesson.body), String(lesson.brief || ""))) {
        continue;
      }
      hits.push(lessonRef(lesson, chapterById.get(String(lesson.chapter_id))));
    }
  }

  if (!sourceType || sourceType === "video_transcript") {
    for (const row of transcripts) {
      if (row.status !== "imported") continue;
      if (input.lesson_id && row.lesson_id !== input.lesson_id) continue;
      if (!matchesQuery(query, row.transcript_text, row.vimeo_video_id, row.lesson_id)) continue;
      hits.push({
        id: encodeId("transcript", row.id),
        source_type: "video_transcript",
        title: `Transcript · ${row.lesson_id} · ${row.vimeo_video_id}`,
        layer: "source",
        provenance: { table: "lesson_transcripts", lesson_id: row.lesson_id, vimeo_video_id: row.vimeo_video_id },
        metadata: { language: row.language, status: row.status },
        relationships: [{ id: encodeId("lesson", row.lesson_id), relation: "lesson" }],
      });
    }
  }

  if (!sourceType || ["research", "examiner_commentary", "mark_plan"].includes(sourceType)) {
    if (client) {
      const categories = kbCategoriesFor(sourceType);
      const variants = searchVariants(query).map(sanitizeIlike).filter(Boolean);
      const tokens = significantTokens(query);
      const fetchLimit = Math.min(Math.max(limit * 3, 30), 100);
      const select = "id, document_title, category, content, created_at";
      const rows: Record<string, unknown>[] = [];

      const scoped = () => {
        let tableQuery = client.from("knowledge_base").select(select);
        if (categories?.length) tableQuery = tableQuery.in("category", categories);
        return tableQuery;
      };

      const phraseOr = kbIlikeOr(variants);
      if (phraseOr) {
        const table = await scoped().or(phraseOr).limit(fetchLimit);
        if (!table.error && table.data) rows.push(...(table.data as Record<string, unknown>[]));
      }

      if (rows.length < limit && tokens.length >= 2) {
        let tokenQuery = scoped();
        for (const token of tokens) {
          const tokenOr = kbIlikeOr([token]);
          if (tokenOr) tokenQuery = tokenQuery.or(tokenOr);
        }
        const table = await tokenQuery.limit(fetchLimit);
        if (!table.error && table.data) rows.push(...(table.data as Record<string, unknown>[]));
      }

      if (rows.length < limit && tokens.length >= 3) {
        const researchFirst = categories?.includes("research") ? ["research"] : categories;
        const majorityOr = kbIlikeOr(tokens);
        if (majorityOr && researchFirst?.length) {
          let majorityQuery = client.from("knowledge_base").select(select).in("category", researchFirst).or(majorityOr);
          const table = await majorityQuery.limit(fetchLimit);
          const minHits = Math.max(2, tokens.length - 1);
          for (const row of (table.data || []) as Record<string, unknown>[]) {
            const hay = kbRowHaystack(row);
            const matched = tokens.filter((token) => hay.includes(token)).length;
            if (matched >= minHits) rows.push(row);
          }
        }
      }

      const rpc = await client.rpc("search_knowledge_base", {
        p_query: query,
        p_category: categories?.length === 1 ? categories[0] : null,
        p_limit: fetchLimit,
      });
      if (!rpc.error && rpc.data) rows.push(...(rpc.data as Record<string, unknown>[]));

      const ranked = [...rows].sort((a, b) => kbSearchScore(b, query, tokens) - kbSearchScore(a, query, tokens));
      const seen = new Set<string>();
      for (const row of ranked) {
        const rowId = String(row.id || "");
        if (!rowId || seen.has(rowId)) continue;
        const type = kbSourceType(String(row.category || ""));
        if (sourceType && type !== sourceType) continue;
        seen.add(rowId);
        hits.push(kbRef(row));
      }
    }
  }

  if (!sourceType || sourceType === "project_canon" || sourceType === "working_state") {
    if (client) {
      const { data } = await client.from("mindset_sandbox_context").select("id, context_type, title, content, version").eq("status", "current");
      for (const row of (data || []) as Record<string, unknown>[]) {
        const type = String(row.context_type) as SourceType;
        if (sourceType && type !== sourceType) continue;
        if (!matchesQuery(query, String(row.title || ""), String(row.content || ""))) continue;
        hits.push({
          id: encodeId("context", String(row.context_type)),
          source_type: type,
          title: String(row.title || row.context_type),
          layer: layerForSource(type),
          provenance: { table: "mindset_sandbox_context", context_type: row.context_type, version: row.version },
          metadata: { version: row.version },
          relationships: [],
        });
      }
    }
  }

  if (!sourceType || sourceType === "methodology") {
    if (client) {
      const { data } = await client.from("coaching_insights").select("id, title, tool_code, coaching_rule, category");
      for (const row of (data || []) as Record<string, unknown>[]) {
        if (!matchesQuery(query, String(row.title || ""), String(row.tool_code || ""), String(row.coaching_rule || ""))) continue;
        hits.push({
          id: encodeId("insight", String(row.id)),
          source_type: "methodology",
          title: String(row.title || row.tool_code || "Coaching insight"),
          layer: "distilled",
          provenance: { table: "coaching_insights", tool_code: row.tool_code },
          metadata: { tool_code: row.tool_code, category: row.category },
          relationships: [],
        });
      }
    }
  }

  if (!sourceType || sourceType === "past_paper") {
    for (const sitting of PAST_PAPER_SITTINGS) {
      for (const paper of sitting.papers) {
        const hay = [sitting.label, paper.title, paper.code, ...paper.questions.map((question) => `${question.code} ${question.title}`)].join(" ");
        if (!matchesQuery(query, hay)) continue;
        hits.push({
          id: encodeId("past_paper", sitting.id, paper.id),
          source_type: "past_paper",
          title: pastPaperDisplayName(sitting, paper),
          layer: "source",
          provenance: { origin: "local_past_paper_registry", sitting_id: sitting.id, paper_id: paper.id },
          metadata: { sitting_id: sitting.id, paper_code: paper.code, total_marks: paper.total_marks },
          relationships: [],
        });
      }
    }
  }

  const offset = input.cursor ? Number(input.cursor) || 0 : 0;
  const page = hits.slice(offset, offset + limit);
  return { items: page, next_cursor: offset + limit < hits.length ? String(offset + limit) : null };
}

export async function getKnowledgeItem(
  id: string,
  offset = 0,
  limit = DEFAULT_CHUNK
): Promise<KnowledgeItem | null> {
  const parsed = parseKnowledgeId(id);
  if (!parsed) return null;
  const client = getSupabaseAdmin();
  const [chapters, lessons, transcripts] = await Promise.all([loadChapters(), loadLessons(), fetchLessonTranscripts()]);
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  if (parsed.type === "lesson") {
    const row = lessons.find((lesson) => String(lesson.id) === parsed.parts[0]);
    if (!row) return null;
    const ref = lessonRef(row, chapterById.get(String(row.chapter_id)));
    const content = [String(row.blurb || ""), asParagraphs(row.body), String(row.brief || ""), asParagraphs(row.takeaways)]
      .filter(Boolean)
      .join("\n\n");
    const chunked = chunkContent(content, offset, limit);
    return { ...ref, ...chunked };
  }

  if (parsed.type === "chapter") {
    const chapter = chapters.find((item) => item.id === parsed.parts[0]);
    if (!chapter) return null;
    const content = [chapter.title, chapter.summary || ""].filter(Boolean).join("\n\n");
    return {
      id,
      source_type: "course",
      title: chapter.title,
      layer: "source",
      provenance: { table: "chapters" },
      metadata: { position: chapter.position },
      relationships: lessons
        .filter((lesson) => String(lesson.chapter_id) === chapter.id)
        .map((lesson) => ({ id: encodeId("lesson", String(lesson.id)), relation: "lesson" })),
      ...chunkContent(content, offset, limit),
    };
  }

  if (parsed.type === "transcript") {
    const row =
      transcripts.find((item) => item.id === parsed.parts[0]) ||
      transcripts.find((item) => item.lesson_id === parsed.parts[0] && item.vimeo_video_id === parsed.parts[1]);
    if (!row) return null;
    return {
      id: encodeId("transcript", row.id),
      source_type: "video_transcript",
      title: `Transcript · ${row.lesson_id} · ${row.vimeo_video_id}`,
      layer: "source",
      provenance: {
        table: "lesson_transcripts",
        lesson_id: row.lesson_id,
        vimeo_video_id: row.vimeo_video_id,
        source_hash: row.source_hash,
        retrieved_at: row.retrieved_at,
      },
      metadata: { language: row.language, status: row.status, cue_count: row.cues.length },
      relationships: [{ id: encodeId("lesson", row.lesson_id), relation: "lesson" }],
      ...chunkContent(row.transcript_text, offset, limit),
    };
  }

  if (parsed.type === "kb" && client) {
    const { data } = await client
      .from("knowledge_base")
      .select("id, document_title, category, content, created_at")
      .eq("id", parsed.parts[0])
      .maybeSingle();
    if (!data) return null;
    return { ...kbRef(data as Record<string, unknown>), ...chunkContent(String(data.content || ""), offset, limit) };
  }

  if (parsed.type === "context" && client) {
    const { data } = await client
      .from("mindset_sandbox_context")
      .select("context_type, title, version, source_filename, updated_at, content")
      .eq("context_type", parsed.parts[0])
      .eq("status", "current")
      .maybeSingle();
    if (!data) return null;
    const type = String(data.context_type) as SourceType;
    return {
      id,
      source_type: type,
      title: String(data.title || data.context_type),
      layer: layerForSource(type),
      provenance: { table: "mindset_sandbox_context", source_filename: data.source_filename, version: data.version },
      metadata: { version: data.version, updated_at: data.updated_at },
      relationships: [],
      ...chunkContent(String(data.content || ""), offset, limit),
    };
  }

  if (parsed.type === "insight" && client) {
    const { data } = await client.from("coaching_insights").select("*").eq("id", parsed.parts[0]).maybeSingle();
    if (!data) return null;
    const content = [data.title, data.tool_code, data.coaching_rule, data.diagnostic_routine, data.diagnostic_outcome]
      .map((value) => (value == null ? "" : String(value)))
      .filter(Boolean)
      .join("\n\n");
    return {
      id,
      source_type: "methodology",
      title: String(data.title || data.tool_code || "Coaching insight"),
      layer: "distilled",
      provenance: { table: "coaching_insights" },
      metadata: { tool_code: data.tool_code, category: data.category },
      relationships: [],
      ...chunkContent(content, offset, limit),
    };
  }

  if (parsed.type === "past_paper") {
    const sitting = PAST_PAPER_SITTINGS.find((item) => item.id === parsed.parts[0]);
    const paper = sitting?.papers.find((item) => item.id === parsed.parts[1]);
    if (!sitting || !paper) return null;
    const content = [
      pastPaperDisplayName(sitting, paper),
      `Total marks: ${paper.total_marks}`,
      `Direct ${paper.buried_treasure.direct_available} · Indirect ${paper.buried_treasure.indirect_available} · Thinking ${paper.buried_treasure.thinking_available}`,
      ...paper.questions.map(
        (question) =>
          `${question.code} ${question.title} (${question.marks}) Direct ${question.direct_available} Indirect ${question.indirect_available} Thinking ${question.thinking_available}`
      ),
    ].join("\n");
    return {
      id,
      source_type: "past_paper",
      title: pastPaperDisplayName(sitting, paper),
      layer: "source",
      provenance: { origin: "local_past_paper_registry" },
      metadata: { sitting_id: sitting.id, paper_id: paper.id, paper_code: paper.code },
      relationships: [],
      ...chunkContent(content, offset, limit),
    };
  }

  return null;
}

export async function getCourseJourney() {
  const [chapters, lessons, transcripts, previewIds] = await Promise.all([
    loadChapters(),
    loadLessons(),
    fetchLessonTranscripts(),
    listPreviewLessonIds(),
  ]);
  const preview = new Set(previewIds);
  const ordered = orderedLessons(chapters, lessons);
  const transcriptsByLesson = new Map<string, LessonTranscript[]>();
  for (const row of transcripts) {
    const list = transcriptsByLesson.get(row.lesson_id) || [];
    list.push(row);
    transcriptsByLesson.set(row.lesson_id, list);
  }

  return {
    chapter_count: chapters.length,
    lesson_count: ordered.length,
    chapters: chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary || "",
      position: chapter.position,
      task: taskFromChapter(chapter.title),
      lessons: ordered
        .filter((lesson) => String(lesson.chapter_id) === chapter.id)
        .map((lesson, index, list) => {
          const globalIndex = ordered.findIndex((item) => item.id === lesson.id);
          const prev = globalIndex > 0 ? ordered[globalIndex - 1] : null;
          const next = globalIndex >= 0 ? ordered[globalIndex + 1] : null;
          const videos = lessonVideos(lesson);
          const lessonTranscripts = transcriptsByLesson.get(String(lesson.id)) || [];
          return {
            id: lesson.id,
            chapter_id: lesson.chapter_id,
            chapter_title: chapter.title,
            position: lesson.position,
            sequence: globalIndex + 1,
            lesson_type: lesson.type,
            title: lesson.title,
            body: asParagraphs(lesson.body),
            takeaways: Array.isArray(lesson.takeaways) ? lesson.takeaways : [],
            brief: lesson.brief || null,
            blurb: lesson.blurb || null,
            task: taskFromChapter(chapter.title),
            prereq_lesson_id: lesson.prereq_lesson_id || null,
            requires_submission: lesson.requires_submission === true,
            requires_coach_approval: lesson.requires_coach_approval === true,
            unlock_at: lesson.unlock_at || null,
            previous_lesson: prev ? { id: prev.id, title: prev.title } : null,
            next_lesson: next ? { id: next.id, title: next.title } : null,
            videos: videos.map((video) => {
              const transcript = lessonTranscripts.find((item) => item.vimeo_video_id === video.vimeo_id);
              return {
                ...video,
                transcript_available: transcript?.status === "imported",
                transcript_status: transcript?.status || "pending",
                transcript_id: transcript ? encodeId("transcript", transcript.id) : video.vimeo_id ? encodeId("transcript", String(lesson.id), video.vimeo_id) : null,
              };
            }),
            resources: preview.has(String(lesson.id)) ? listTeachingResources(lesson.pdf_url, lesson.resource_downloads) : [],
            in_chapter_index: index + 1,
            in_chapter_count: list.length,
          };
        }),
    })),
  };
}

export async function getCourseLessonFull(lessonId: string) {
  const [chapters, lessons, transcripts, previewIds] = await Promise.all([
    loadChapters(),
    loadLessons(),
    fetchLessonTranscripts(),
    listPreviewLessonIds(),
  ]);
  const ordered = orderedLessons(chapters, lessons);
  const row = ordered.find((lesson) => String(lesson.id) === lessonId);
  if (!row) return null;
  const chapter = chapters.find((item) => item.id === String(row.chapter_id));
  const index = ordered.findIndex((item) => item.id === row.id);
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 ? ordered[index + 1] : null;
  const videos = lessonVideos(row);
  const lessonTranscripts = transcripts.filter((item) => item.lesson_id === String(row.id));
  return {
    id: row.id,
    source_type: "lesson",
    title: row.title,
    chapter: chapter ? { id: chapter.id, title: chapter.title, position: chapter.position, task: taskFromChapter(chapter.title) } : null,
    position: row.position,
    sequence: index + 1,
    lesson_count: ordered.length,
    lesson_type: row.type,
    blurb: row.blurb || null,
    body: asParagraphs(row.body),
    takeaways: Array.isArray(row.takeaways) ? row.takeaways : [],
    brief: row.brief || null,
    task: chapter ? taskFromChapter(chapter.title) : null,
    prereq_lesson_id: row.prereq_lesson_id || null,
    requires_submission: row.requires_submission === true,
    requires_coach_approval: row.requires_coach_approval === true,
    previous_lesson: prev ? { id: prev.id, title: prev.title } : null,
    next_lesson: next ? { id: next.id, title: next.title } : null,
    videos: videos.map((video) => {
      const transcript = lessonTranscripts.find((item) => item.vimeo_video_id === video.vimeo_id && item.status === "imported");
      return {
        ...video,
        transcript_id: transcript ? encodeId("transcript", transcript.id) : null,
        transcript_status: transcript?.status || lessonTranscripts.find((item) => item.vimeo_video_id === video.vimeo_id)?.status || "pending",
        transcript_text: transcript?.transcript_text || null,
        caption_cues: transcript?.cues || [],
      };
    }),
    resources: previewIds.includes(lessonId) ? listTeachingResources(row.pdf_url, row.resource_downloads) : [],
    transcripts: lessonTranscripts
      .filter((item) => item.status === "imported")
      .map((item) => ({
        id: encodeId("transcript", item.id),
        vimeo_video_id: item.vimeo_video_id,
        language: item.language,
        transcript_text: item.transcript_text,
        cue_count: item.cues.length,
        retrieved_at: item.retrieved_at,
      })),
  };
}
