/**
 * Insert the Task 4 carry-forward checkpoint as the first ch15 lesson.
 * Creates/updates the custom survey, then attaches it to ch15-l0.
 *
 *   npx tsx scripts/apply-task4-checkpoint.ts
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const LESSON_ID = "ch15-l0";
const CHAPTER_ID = "ch15";
const SURVEY_SLUG = "task-4-carry-forward-checkin";
const VIMEO_URL = "https://player.vimeo.com/video/1144779004";
const PHASE1_LESSON_ID = "ch7-l8";

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
    id: "q-tools-used",
    type: "multi_select",
    label: "Which of these have you actually used when doing your own questions outside the course?",
    helperText: "Select everything that is actually true of your own question practice. This is not a test.",
    required: true,
    options: [
      "BMCR / using my performance to decide what I need to work on",
      "Case study planning / making sense of the information before answering",
      "RTFQ / deliberately checking what the required is asking",
      "Discussion question scaffold/process",
      "Changes from feedback I received on my Tasks",
      "Honestly, I’ve mostly gone back to studying/questions the way I normally do",
    ],
    resourceUrl: "",
  },
  {
    id: "q-what-changed",
    type: "long_text",
    label:
      "Think about the last 2–3 questions you did outside this course. If I looked at the way you approached them, what from Tasks 1–3 would I actually be able to SEE has changed?",
    helperText: "",
    required: true,
    options: [] as string[],
    resourceUrl: "",
  },
  {
    id: "q-one-unused",
    type: "long_text",
    label:
      "Now look back at your answers. What is ONE thing from Tasks 1–3 that you understood at the time, but haven’t actually made part of the way you normally do questions?",
    helperText: "",
    required: false,
    options: [] as string[],
    resourceUrl: "",
  },
];

const BODY = [
  "Before we start Task 4, I want to check what has actually happened to the things we’ve worked on so far.",
  "The Tasks in this course aren’t meant to be things you complete and then leave behind. So think about the questions you’ve done OUTSIDE the course since starting Tasks 1–3.",
];

const BRIEF = [
  "Remember this?",
  "I showed you this video back in Phase 1 — before you had actually worked through these Tasks.",
  "At the time, you may have watched it and thought, ‘Yes, that makes sense.’",
  "But now you’ve completed several Tasks, received feedback, and probably done some of your own studying in between.",
  "Watch it again now, with your answers above in mind.",
  "You might understand a little more clearly what I was trying to tell you then.",
].join("\n\n");

const TAKEAWAYS = [
  "That’s what I want you to carry with you into this Task.",
  "You’re building a TOOLBOX.",
  "We’re going to add another tool in Task 4 — but this time, don’t put the others down to pick this one up.",
];

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const phase1 = await client
    .from("lessons")
    .select("id, title, video_urls, type")
    .eq("id", PHASE1_LESSON_ID)
    .maybeSingle();
  if (phase1.error) throw new Error(`ch7-l8: ${phase1.error.message}`);
  if (!phase1.data) throw new Error("ch7-l8 is missing; aborting so it is not recreated here.");
  const phase1Videos = JSON.stringify(phase1.data.video_urls);
  if (!phase1Videos.includes("1144779004")) {
    throw new Error(`ch7-l8 no longer references Vimeo 1144779004: ${phase1Videos}`);
  }

  const existingSurvey = await client.from("custom_surveys").select("*").eq("slug", SURVEY_SLUG).maybeSingle();
  if (existingSurvey.error) throw new Error(`survey lookup: ${existingSurvey.error.message}`);

  const surveyRow = {
    title: "Task 4 — Have you actually used these?",
    description: "Short behavioural check-in before Task 4. Not scored.",
    slug: SURVEY_SLUG,
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
    .select("id, title, position, prereq_lesson_id, survey_id")
    .eq("chapter_id", CHAPTER_ID)
    .order("position", { ascending: true });
  if (current.error) throw new Error(`ch15 lessons: ${current.error.message}`);
  const rows = current.data || [];
  const already = rows.find((row) => row.id === LESSON_ID);

  if (!already) {
    const minPos = Math.min(...rows.map((row) => Number(row.position)));
    if (minPos === 0) {
      for (const row of [...rows].sort((a, b) => Number(b.position) - Number(a.position))) {
        const next = await client
          .from("lessons")
          .update({ position: Number(row.position) + 1 })
          .eq("id", row.id);
        if (next.error) throw new Error(`bump ${row.id}: ${next.error.message}`);
      }
    }
  }

  const firstExisting = rows.find((row) => row.id !== LESSON_ID);
  const lessonPayload = {
    id: LESSON_ID,
    chapter_id: CHAPTER_ID,
    position: 0,
    type: "video",
    title: "Before Task 4 — Have you actually used these?",
    duration: "8 min",
    seconds: 8 * 60,
    video_duration_seconds: 8 * 60,
    estimated_read_minutes: null,
    duration_minutes: 8,
    blurb: "A short check-in before Task 4: what have you actually carried into your own question practice?",
    body: BODY,
    takeaways: TAKEAWAYS,
    brief: BRIEF,
    due: null,
    video_urls: [{ url: VIMEO_URL }],
    pdf_url: null,
    survey_id: surveyId,
    requires_submission: false,
    requires_coach_approval: false,
    prereq_lesson_id: already?.prereq_lesson_id || firstExisting?.prereq_lesson_id || null,
  };

  const saved = already
    ? await client.from("lessons").update(lessonPayload).eq("id", LESSON_ID)
    : await client.from("lessons").insert(lessonPayload);
  if (saved.error) throw new Error(`lesson save: ${saved.error.message}`);

  const verifyPhase1 = await client.from("lessons").select("id, title, video_urls").eq("id", PHASE1_LESSON_ID).maybeSingle();
  if (verifyPhase1.error) throw new Error(verifyPhase1.error.message);
  if (JSON.stringify(verifyPhase1.data?.video_urls) !== phase1Videos) {
    throw new Error("ch7-l8 changed unexpectedly; stopping.");
  }

  const finalLessons = await client
    .from("lessons")
    .select("id, title, position, type, survey_id, video_urls")
    .eq("chapter_id", CHAPTER_ID)
    .order("position", { ascending: true });
  if (finalLessons.error) throw new Error(finalLessons.error.message);

  const collisions = (finalLessons.data || []).filter(
    (row) => row.id !== LESSON_ID && row.survey_id && JSON.stringify(row.video_urls || "").includes("http")
  );

  console.log(JSON.stringify({
    surveyId,
    lessonId: LESSON_ID,
    created: !already,
    ch7l8Unchanged: true,
    vimeoReferenced: VIMEO_URL,
    otherVideoSurveyLessonsInCh15: collisions.map((row) => row.id),
    task4Order: (finalLessons.data || []).map((row) => ({
      position: row.position,
      id: row.id,
      title: row.title,
      type: row.type,
      survey_id: row.survey_id || null,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
