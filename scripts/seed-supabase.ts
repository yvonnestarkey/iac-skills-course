/**
 * Load iac-skills-course.json into Supabase chapters + lessons.
 *
 * Run the chapters SQL once first:
 *   supabase/chapters.sql  (paste into the Supabase SQL editor)
 *
 * Then:
 *   npx tsx scripts/seed-supabase.ts
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { defaultMinutesForType } from "../lib/lesson-duration";
import { parseLessonVideos } from "../lib/lesson-videos";

const ROOT = process.cwd();
const JSON_FILE = path.join(ROOT, "iac-skills-course.json");
const ALLOWED_TYPES = new Set(["video", "reading", "assignment", "upload", "download", "ask", "survey"]);

interface ScrapedLesson {
  id: string;
  type: string;
  title: string;
  videoUrls?: unknown;
  body?: string[];
  blurb?: string;
  takeaways?: string[];
  brief?: string;
  thinkificUrl?: string;
  pdf_url?: string;
}

interface ScrapedChapter {
  id: string;
  title: string;
  summary?: string;
  lessons: ScrapedLesson[];
}

interface CourseFile {
  className?: string;
  chapters: ScrapedChapter[];
}

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
    if (!process.env[key]) process.env[key] = value;
  }
}

function uniqueVideos(urls: unknown) {
  return parseLessonVideos(urls);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  if (!existsSync(JSON_FILE)) {
    throw new Error(`Missing ${JSON_FILE}. Run the Thinkific scrape first.`);
  }

  const course = JSON.parse(readFileSync(JSON_FILE, "utf8")) as CourseFile;
  const chapters = course.chapters || [];
  if (!chapters.length) throw new Error("iac-skills-course.json has no chapters.");

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const chapterRows = chapters.map((chapter, position) => ({
    id: chapter.id,
    title: chapter.title,
    summary: chapter.summary || "",
    position,
  }));

  const lessonRows = chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson, position) => {
      const type = ALLOWED_TYPES.has(lesson.type) ? lesson.type : "reading";
      const body = (lesson.body || []).filter(Boolean);
      const videoUrls = uniqueVideos(lesson.videoUrls);
      const durationMinutes = defaultMinutesForType(type);
      return {
        id: lesson.id,
        chapter_id: chapter.id,
        position,
        type,
        title: lesson.title,
        duration: `${durationMinutes} min`,
        seconds: type === "video" ? durationMinutes * 60 : null,
        video_duration_seconds: type === "video" ? durationMinutes * 60 : null,
        estimated_read_minutes: type === "reading" ? durationMinutes : null,
        duration_minutes: durationMinutes,
        blurb: lesson.blurb || body[0] || null,
        body,
        takeaways: lesson.takeaways || [],
        due: null as string | null,
        brief: lesson.brief || null,
        video_urls: videoUrls,
        thinkific_url: lesson.thinkificUrl || null,
        pdf_url: lesson.pdf_url?.trim() || null,
      };
    })
  );

  console.log(`Seeding ${chapterRows.length} chapters and ${lessonRows.length} lessons…`);

  const chapterResult = await client.from("chapters").upsert(chapterRows, { onConflict: "id" });
  if (chapterResult.error) {
    throw new Error(
      `chapters: ${chapterResult.error.message}. Run supabase/chapters.sql in the Supabase SQL editor first.`
    );
  }

  const lessonResult = await client.from("lessons").upsert(lessonRows, { onConflict: "id" });
  if (lessonResult.error) {
    const stripped = lessonRows.map(
      ({
        video_urls: _v,
        thinkific_url: _t,
        video_duration_seconds: _vd,
        estimated_read_minutes: _er,
        duration_minutes: _dm,
        pdf_url: _pdf,
        ...row
      }) => row
    );
    const retry = await client.from("lessons").upsert(stripped, { onConflict: "id" });
    if (retry.error) throw new Error(`lessons: ${retry.error.message}`);
    console.log("Lessons saved without extra columns. Run supabase/chapters.sql and supabase/lesson-duration.sql.");
  }

  console.log(`Done. ${course.className || "Course"} is in Supabase.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
