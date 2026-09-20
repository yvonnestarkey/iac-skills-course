/**
 * Fallback only: import one local VTT when Vimeo has no caption track.
 *
 *   npx tsx scripts/import-manual-vtt.ts --lesson ch15-l3 --vimeo 123456789 --file ./captions.vtt
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { importManualVtt } from "@/lib/lesson-transcripts";

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

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  loadEnvLocal();
  const lessonId = arg("lesson");
  const vimeoId = arg("vimeo");
  const file = arg("file");
  if (!lessonId || !vimeoId || !file) {
    throw new Error("Usage: --lesson <id> --vimeo <id> --file <path.vtt>");
  }
  const vtt = readFileSync(path.resolve(file), "utf8");
  const row = await importManualVtt({ lessonId, vimeoId, vtt });
  if (!row) throw new Error("Import failed. Paste supabase/lesson-transcripts.sql and use the service-role key.");
  console.log(JSON.stringify({ id: row.id, lesson_id: row.lesson_id, vimeo_video_id: row.vimeo_video_id, status: row.status }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
