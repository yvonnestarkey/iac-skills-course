/**
 * Split Task 4 “Are you studying towards the exam?” into:
 *   - 3-part exam-environment lesson (ch15-l3)
 *   - standalone Study Cowboy lesson (ch15-l10)
 *   - Common Challenge “I always run out of time” (ch11-l14)
 *
 *   npx tsx scripts/apply-task4-study-split.ts
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const TOWARDS_VIDEOS = [
  { url: "https://player.vimeo.com/video/746464515", heading: "The way we study" },
  { url: "https://player.vimeo.com/video/746590325", heading: "What have we trained our brain to do?" },
  { url: "https://player.vimeo.com/video/746762484", heading: "Do we protect our brain?" },
];

const COWBOY_VIDEO = { url: "https://player.vimeo.com/video/868628532", heading: "Study Cowboy" };

const TIME_VIDEOS = [
  { url: "https://player.vimeo.com/video/868619934", heading: "I can't study unless I have at least an hour" },
  { url: "https://player.vimeo.com/video/880796819", heading: "Time vs Attention management" },
  { url: "https://player.vimeo.com/video/868619858", heading: "Where did the time go?" },
];

const CH15_ORDER = [
  "ch15-l0",
  "ch15-l1",
  "ch15-l2",
  "ch15-l3",
  "ch15-l10",
  "ch15-l4",
  "ch15-l5",
  "ch15-l6",
  "ch15-l7",
  "ch15-l8",
];

async function setPositions(client: any, chapterId: string, ids: string[]) {
  for (let index = 0; index < ids.length; index += 1) {
    const updated = await client.from("lessons").update({ position: 100 + index }).eq("id", ids[index]).eq("chapter_id", chapterId);
    if (updated.error) throw new Error(`temp position ${ids[index]}: ${updated.error.message}`);
  }
  for (let index = 0; index < ids.length; index += 1) {
    const updated = await client.from("lessons").update({ position: index }).eq("id", ids[index]).eq("chapter_id", chapterId);
    if (updated.error) throw new Error(`position ${ids[index]}: ${updated.error.message}`);
  }
}

async function copyTranscripts(client: any, fromLessonId: string, toLessonId: string, vimeoIds: string[]) {
  const existing = await client
    .from("lesson_transcripts")
    .select(
      "vimeo_video_id, source_provider, language, transcript_text, caption_vtt, cues, provenance, retrieved_at, source_updated_at, source_hash, status, error_message"
    )
    .eq("lesson_id", fromLessonId)
    .in("vimeo_video_id", vimeoIds);
  if (existing.error) throw new Error(`transcripts: ${existing.error.message}`);
  for (const row of existing.data || []) {
    const saved = await client.from("lesson_transcripts").upsert(
      { ...row, lesson_id: toLessonId },
      { onConflict: "lesson_id,vimeo_video_id,language" }
    );
    if (saved.error) throw new Error(`copy transcript ${row.vimeo_video_id}: ${saved.error.message}`);
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const towards = await client.from("lessons").select("*").eq("id", "ch15-l3").maybeSingle();
  if (towards.error || !towards.data) throw new Error(towards.error?.message || "ch15-l3 missing");
  const faq = await client.from("lessons").select("id, title, video_urls, prereq_lesson_id").eq("id", "ch11-l11").maybeSingle();
  if (faq.error || !faq.data) throw new Error("ch11-l11 missing; aborting so Common Challenges is not rewritten blindly.");

  const towardsUpdate = await client
    .from("lessons")
    .update({
      title: "L3 - Are you studying TOWARDS your exam?",
      type: "video",
      blurb: "Are you studying the topic? Or are you studying what you'll need to do in the exam with the topic?",
      body: [
        "This lesson has 3 short videos. Watch them in order.",
        "We're going to look at what we are actually training ourselves to do, and whether we are studying towards the performance environment of the exam.",
      ],
      takeaways: [],
      brief: null,
      video_urls: TOWARDS_VIDEOS,
      duration: "12 min",
      seconds: 12 * 60,
      video_duration_seconds: 12 * 60,
      duration_minutes: 12,
    })
    .eq("id", "ch15-l3");
  if (towardsUpdate.error) throw new Error(`ch15-l3: ${towardsUpdate.error.message}`);

  const cowboyExisting = await client.from("lessons").select("id, prereq_lesson_id").eq("id", "ch15-l10").maybeSingle();
  const cowboyPayload = {
    id: "ch15-l10",
    chapter_id: "ch15",
    position: 90,
    type: "video",
    title: "Study Cowboy",
    duration: "10 min",
    seconds: 10 * 60,
    video_duration_seconds: 10 * 60,
    duration_minutes: 10,
    blurb: "Being good at exams and being a good subject-matter expert are not exactly the same thing.",
    body: [
      "Being good at exams and being a good subject-matter expert are not exactly the same thing.",
      "Taking time to work through something properly, investigate it, check it and understand it deeply can be an excellent professional habit.",
      "The problem is that an exam gives you a very different environment: limited time, limited information and limited resources.",
      "This video looks at the kind of person who can thrive in that environment — and why struggling with that environment does NOT automatically mean you are bad at the subject.",
    ],
    takeaways: [],
    brief: null,
    due: null,
    video_urls: [COWBOY_VIDEO],
    pdf_url: null,
    requires_submission: false,
    requires_coach_approval: false,
    prereq_lesson_id: cowboyExisting.data?.prereq_lesson_id || towards.data.prereq_lesson_id || null,
  };
  const cowboySaved = cowboyExisting.data
    ? await client.from("lessons").update(cowboyPayload).eq("id", "ch15-l10")
    : await client.from("lessons").insert(cowboyPayload);
  if (cowboySaved.error) throw new Error(`ch15-l10: ${cowboySaved.error.message}`);

  const timeExisting = await client.from("lessons").select("id").eq("id", "ch11-l14").maybeSingle();
  const index = await client.from("lessons").select("id, body").eq("id", "ch11-l1").maybeSingle();
  if (index.error || !index.data) throw new Error("ch11-l1 missing");
  const indexBody = Array.isArray(index.data.body) ? [...index.data.body] : [];
  if (!indexBody.includes('"I always run out of time"')) {
    const at = indexBody.findIndex((line) => /I need study guidance/i.test(String(line)));
    indexBody.splice(at >= 0 ? at + 1 : indexBody.length, 0, '"I always run out of time"');
    const indexSaved = await client.from("lessons").update({ body: indexBody }).eq("id", "ch11-l1");
    if (indexSaved.error) throw new Error(`ch11-l1: ${indexSaved.error.message}`);
  }

  const timePayload = {
    id: "ch11-l14",
    chapter_id: "ch11",
    position: 11,
    type: "video",
    title: '"I always run out of time"',
    duration: "12 min",
    seconds: 12 * 60,
    video_duration_seconds: 12 * 60,
    duration_minutes: 12,
    blurb: "If you always feel like there is never enough time, these videos are here when you need them.",
    body: [
      "Most students feel that they can only study effectively if they have more than one hour available. This is tricky when you have limited time and need to make every minute count.",
      "Be careful, because part of this thinking is a bit of an excuse not to study. It lets us off the hook for studying because \"I can't be expected to study if I only have half an hour, so therefore it's not my fault that I'm not studying right now\":",
      "Escapism is another challenge. We're tired. It's totally understandable and you DO deserve to breathe and relax. But you chose and committed to a really tough challenge. That exam isn't going to 'understand' that. Are you paying attention to the amount of time you spend on Instagram? TikTok? YouTube? Netflix? It adds up.",
    ],
    takeaways: [],
    brief: null,
    due: null,
    video_urls: TIME_VIDEOS,
    pdf_url: null,
    requires_submission: false,
    requires_coach_approval: false,
    prereq_lesson_id: faq.data.prereq_lesson_id || null,
  };

  if (!timeExisting.data) {
    const ch11 = await client.from("lessons").select("id, position").eq("chapter_id", "ch11").order("position", { ascending: false });
    if (ch11.error) throw new Error(ch11.error.message);
    for (const row of ch11.data || []) {
      if (Number(row.position) < 11) continue;
      const bumped = await client.from("lessons").update({ position: Number(row.position) + 1 }).eq("id", row.id);
      if (bumped.error) throw new Error(`bump ${row.id}: ${bumped.error.message}`);
    }
    const inserted = await client.from("lessons").insert(timePayload);
    if (inserted.error) throw new Error(`ch11-l14 insert: ${inserted.error.message}`);
  } else {
    const updated = await client.from("lessons").update(timePayload).eq("id", "ch11-l14");
    if (updated.error) throw new Error(`ch11-l14 update: ${updated.error.message}`);
  }

  const skills = await client.from("lessons").select("id").eq("id", "ch15-l1").maybeSingle();
  if (!skills.data) {
    const restored = await client.from("lessons").insert({
      id: "ch15-l1",
      chapter_id: "ch15",
      position: 1,
      type: "video",
      title: "L2 - Are you bringing your other Skills with you?",
      duration: "10 min",
      seconds: 10 * 60,
      video_duration_seconds: 10 * 60,
      duration_minutes: 10,
      blurb: null,
      body: [],
      takeaways: [],
      brief: null,
      due: null,
      video_urls: [{ url: "https://player.vimeo.com/video/1033062260" }],
      pdf_url: null,
      requires_submission: false,
      requires_coach_approval: false,
      prereq_lesson_id: towards.data.prereq_lesson_id || null,
    });
    if (restored.error) throw new Error(`restore ch15-l1: ${restored.error.message}`);
  }

  await setPositions(client, "ch15", CH15_ORDER);

  await copyTranscripts(client, "ch15-l3", "ch15-l10", ["868628532"]);
  await copyTranscripts(client, "ch15-l3", "ch11-l14", ["868619934", "880796819", "868619858"]);
  const leftover = await client
    .from("lesson_transcripts")
    .delete()
    .eq("lesson_id", "ch15-l3")
    .in("vimeo_video_id", ["868628532", "868619934", "880796819", "868619858"]);
  if (leftover.error) throw new Error(`remove leftover ch15-l3 transcripts: ${leftover.error.message}`);

  const verifyFaq = await client.from("lessons").select("id, title, video_urls").eq("id", "ch11-l11").maybeSingle();
  const ch15 = await client.from("lessons").select("id, title, position, video_urls").eq("chapter_id", "ch15").order("position");
  const ch11 = await client.from("lessons").select("id, title, position").eq("chapter_id", "ch11").order("position");
  const l3 = await client.from("lessons").select("id, title, video_urls, body").eq("id", "ch15-l3").maybeSingle();

  console.log(JSON.stringify({
    towardsVideos: l3.data?.video_urls,
    cowboyId: "ch15-l10",
    timeChallengeId: "ch11-l14",
    faqUnchanged: JSON.stringify(verifyFaq.data?.video_urls) === JSON.stringify(faq.data.video_urls),
    task4Order: (ch15.data || []).map((row) => ({ position: row.position, id: row.id, title: row.title })),
    commonChallengesOrder: (ch11.data || []).map((row) => ({ position: row.position, id: row.id, title: row.title })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
