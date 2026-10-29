/**
 * Load a Thinkific export JSON into Supabase chapters + lessons.
 *
 * Run supabase/chapters.sql (and supabase/multi-course.sql for other courses) first.
 *
 * IAC Skills (default):
 *   npx tsx scripts/seed-supabase.ts
 *
 * Another course:
 *   npx tsx scripts/seed-supabase.ts --course=mindset-masterclass --file=mindset-masterclass.json
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LMS_COURSE_ID, getLmsCourse } from "../lib/lms-catalog";
import { defaultMinutesForType } from "../lib/lesson-duration";
import { parseLessonVideos } from "../lib/lesson-videos";

const ROOT = process.cwd();

function argValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

function namespacedId(courseId: string, id: string): string {
  if (courseId === DEFAULT_LMS_COURSE_ID) return id;
  if (id.startsWith(`${courseId}-`)) return id;
  return `${courseId}-${id}`.slice(0, 80);
}
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const courseId = getLmsCourse(argValue("--course") || DEFAULT_LMS_COURSE_ID)?.id || DEFAULT_LMS_COURSE_ID;
  const jsonFile = path.resolve(ROOT, argValue("--file") || `${courseId}-course.json`);
  if (!existsSync(jsonFile) && courseId === DEFAULT_LMS_COURSE_ID && existsSync(path.join(ROOT, "iac-skills-course.json"))) {
    // existing default filename
  }
  const jsonPath =
    existsSync(jsonFile) ? jsonFile : courseId === DEFAULT_LMS_COURSE_ID ? path.join(ROOT, "iac-skills-course.json") : jsonFile;
  if (!existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath}. Scrape Thinkific with --out=${path.basename(jsonPath)} first.`);
  }

  const course = JSON.parse(readFileSync(jsonPath, "utf8")) as CourseFile;
  const chapters = course.chapters || [];
  if (!chapters.length) throw new Error(`${path.basename(jsonPath)} has no chapters.`);

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const chapterRows = chapters.map((chapter, position) => ({
    id: namespacedId(courseId, chapter.id),
    title: chapter.title,
    summary: chapter.summary || "",
    position,
    course_id: courseId,
  }));

  const lessonRows = chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson, position) => {
      const type = ALLOWED_TYPES.has(lesson.type) ? lesson.type : "reading";
      const body = (lesson.body || []).filter(Boolean);
      const videoUrls = uniqueVideos(lesson.videoUrls);
      const durationMinutes = defaultMinutesForType(type);
      return {
        id: namespacedId(courseId, lesson.id),
        chapter_id: namespacedId(courseId, chapter.id),
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
    const withoutCourse = chapterRows.map(({ course_id: _courseId, ...row }) => row);
    const retryChapters = await client.from("chapters").upsert(withoutCourse, { onConflict: "id" });
    if (retryChapters.error) {
      throw new Error(
        `chapters: ${chapterResult.error.message}. Run supabase/chapters.sql and supabase/multi-course.sql in the Supabase SQL editor first.`
      );
    }
    if (courseId !== DEFAULT_LMS_COURSE_ID) {
      console.log("Chapters saved without course_id. Run supabase/multi-course.sql before importing other courses.");
    }
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
