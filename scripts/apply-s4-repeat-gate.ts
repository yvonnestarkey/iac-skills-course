/**
 * Turns Phase 1 S4 L1 into the returning-student Yes/No gate.
 *
 *   npx tsx scripts/apply-s4-repeat-gate.ts
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  S4_NO,
  S4_REPEAT_QUESTION_ID,
  S4_REPEAT_SURVEY_SLUG,
  S4_SITTING_OPTIONS,
  S4_SITTING_QUESTION_ID,
  S4_YES,
} from "../lib/s4-repeat-gate";

const ROOT = process.cwd();

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

const QUESTIONS = [
  {
    id: S4_REPEAT_QUESTION_ID,
    type: "radio",
    label: "",
    helperText: "",
    required: true,
    options: [S4_YES, S4_NO],
    resourceUrl: "",
  },
  {
    id: S4_SITTING_QUESTION_ID,
    type: "radio",
    label: "Which IAC exam sitting did you register for this course?",
    helperText: "",
    required: true,
    options: S4_SITTING_OPTIONS,
    resourceUrl: "",
    visibleWhen: { id: S4_REPEAT_QUESTION_ID, equals: S4_YES },
  },
];

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const chapters = await client.from("chapters").select("id, title, position").order("position", { ascending: true });
  if (chapters.error) throw new Error(`chapters: ${chapters.error.message}`);
  const chapter = (chapters.data || []).find((row) => /^S4\b/i.test(String(row.title || "")));
  if (!chapter) throw new Error("Could not find a chapter whose title starts with S4.");

  const existingSurvey = await client.from("custom_surveys").select("*").eq("slug", S4_REPEAT_SURVEY_SLUG).maybeSingle();
  if (existingSurvey.error) throw new Error(`survey lookup: ${existingSurvey.error.message}`);
  const surveyRow = {
    title: "Have you done this course with Yvonne before?",
    description: "",
    slug: S4_REPEAT_SURVEY_SLUG,
    is_active: true,
    is_assignment: false,
    requires_grade: false,
    pdf_url: "",
    questions: QUESTIONS,
    updated_at: new Date().toISOString(),
  };

  let surveyId = existingSurvey.data ? String(existingSurvey.data.id) : "";
  if (surveyId) {
    const updated = await client.from("custom_surveys").update(surveyRow).eq("id", surveyId);
    if (updated.error) throw new Error(`survey update: ${updated.error.message}`);
  } else {
    const inserted = await client.from("custom_surveys").insert(surveyRow).select("id").maybeSingle();
    if (inserted.error || !inserted.data) throw new Error(`survey insert: ${inserted.error?.message || "no id"}`);
    surveyId = String(inserted.data.id);
  }

  const current = await client
    .from("lessons")
    .select("id, title, position, type, survey_id")
    .eq("chapter_id", chapter.id)
    .order("position", { ascending: true });
  if (current.error) throw new Error(`S4 lessons: ${current.error.message}`);
  const rows = current.data || [];
  const first = rows[0];
  if (!first) throw new Error("S4 has no lessons to convert.");

  const lessonPayload: Record<string, unknown> = {
    type: "survey",
    title: "L1 - Have you worked through this IAC Skills Course with Yvonne before?",
    duration: "2 min",
    seconds: 120,
    blurb: "",
    body: [],
    brief: S4_REPEAT_SURVEY_SLUG,
    survey_id: surveyId,
    requires_submission: false,
    requires_coach_approval: false,
    prereq_lesson_id: null,
    is_draft: false,
  };

  let saved = await client.from("lessons").update(lessonPayload).eq("id", first.id);
  if (saved.error && /column|schema cache/i.test(saved.error.message || "")) {
    const retry = { ...lessonPayload };
    const missing = saved.error.message.match(/column ["']?([a-z_]+)/i);
    if (missing?.[1]) delete retry[missing[1]];
    saved = await client.from("lessons").update(retry).eq("id", first.id);
  }
  if (saved.error) throw new Error(`lesson save: ${saved.error.message}`);

  const finalLessons = await client
    .from("lessons")
    .select("id, title, position, type, survey_id")
    .eq("chapter_id", chapter.id)
    .order("position", { ascending: true });
  if (finalLessons.error) throw new Error(finalLessons.error.message);

  console.log(
    JSON.stringify(
      {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        surveyId,
        lessonId: first.id,
        order: (finalLessons.data || []).map((row) => ({
          position: row.position,
          id: row.id,
          title: row.title,
          type: row.type,
          survey_id: row.survey_id || null,
        })),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
