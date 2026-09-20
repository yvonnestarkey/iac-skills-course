/**
 * Bulk-sync English Vimeo caption tracks for every course video.
 *
 *   npx tsx scripts/sync-vimeo-transcripts.ts
 *
 * Needs VIMEO_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Never commit the token. Paste supabase/lesson-transcripts.sql first.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { listCourseVimeoVideos } from "@/lib/knowledge-gateway";
import { syncLessonTranscripts } from "@/lib/lesson-transcripts";

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

async function main() {
  loadEnvLocal();
  const videos = await listCourseVimeoVideos();
  console.log(`Found ${videos.length} lesson/Vimeo pairs.`);
  const report = await syncLessonTranscripts(videos);
  console.log(JSON.stringify(report, null, 2));
  if (!report.token_configured) {
    console.error("Set VIMEO_ACCESS_TOKEN in .env.local (and Vercel) before syncing.");
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
