import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/knowledge-gateway-db";
import {
  downloadVimeoVtt,
  listVimeoTextTracks,
  parseVttCues,
  pickEnglishTrack,
  trackDownloadUrl,
  transcriptFromCues,
  vimeoConfigured,
  type CaptionCue,
} from "@/lib/vimeo-captions";

export type TranscriptStatus = "pending" | "imported" | "no_captions" | "inaccessible" | "error" | "ambiguous";

export interface LessonTranscript {
  id: string;
  lesson_id: string;
  vimeo_video_id: string;
  source_provider: string;
  language: string;
  transcript_text: string;
  caption_vtt: string | null;
  cues: CaptionCue[];
  provenance: Record<string, unknown>;
  retrieved_at: string | null;
  source_updated_at: string | null;
  source_hash: string | null;
  status: TranscriptStatus;
  error_message: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TranscriptSyncReport {
  total_vimeo_ids: number;
  videos_matched: number;
  caption_tracks_found: number;
  transcripts_imported: number;
  videos_with_no_captions: string[];
  inaccessible_videos: string[];
  ambiguous_mappings: string[];
  errors: { vimeo_video_id: string; lesson_id: string; error: string }[];
  skipped_unchanged: number;
  token_configured: boolean;
}

function asRow(row: Record<string, unknown>): LessonTranscript {
  return {
    id: String(row.id),
    lesson_id: String(row.lesson_id || ""),
    vimeo_video_id: String(row.vimeo_video_id || ""),
    source_provider: String(row.source_provider || "vimeo"),
    language: String(row.language || "en"),
    transcript_text: String(row.transcript_text || ""),
    caption_vtt: row.caption_vtt ? String(row.caption_vtt) : null,
    cues: Array.isArray(row.cues) ? (row.cues as CaptionCue[]) : [],
    provenance: row.provenance && typeof row.provenance === "object" ? (row.provenance as Record<string, unknown>) : {},
    retrieved_at: row.retrieved_at ? String(row.retrieved_at) : null,
    source_updated_at: row.source_updated_at ? String(row.source_updated_at) : null,
    source_hash: row.source_hash ? String(row.source_hash) : null,
    status: (String(row.status || "pending") as TranscriptStatus) || "pending",
    error_message: row.error_message ? String(row.error_message) : null,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function fetchLessonTranscripts(lessonId?: string): Promise<LessonTranscript[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];
  let query = client.from("lesson_transcripts").select("*").order("created_at", { ascending: true });
  if (lessonId) query = query.eq("lesson_id", lessonId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => asRow(row as Record<string, unknown>));
}

async function upsertTranscript(row: Record<string, unknown>): Promise<LessonTranscript | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  const { data, error } = await client
    .from("lesson_transcripts")
    .upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: "lesson_id,vimeo_video_id,language" }
    )
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return asRow(data as Record<string, unknown>);
}

export async function syncLessonTranscripts(
  videos: { lessonId: string; vimeoId: string }[]
): Promise<TranscriptSyncReport> {
  const report: TranscriptSyncReport = {
    total_vimeo_ids: videos.length,
    videos_matched: 0,
    caption_tracks_found: 0,
    transcripts_imported: 0,
    videos_with_no_captions: [],
    inaccessible_videos: [],
    ambiguous_mappings: [],
    errors: [],
    skipped_unchanged: 0,
    token_configured: vimeoConfigured(),
  };

  if (!report.token_configured) {
    report.errors.push({
      vimeo_video_id: "",
      lesson_id: "",
      error: "VIMEO_ACCESS_TOKEN is not configured.",
    });
    return report;
  }

  const existing = await fetchLessonTranscripts();
  const byKey = new Map(existing.map((row) => [`${row.lesson_id}:${row.vimeo_video_id}:en`, row]));

  for (const video of videos) {
    const listed = await listVimeoTextTracks(video.vimeoId);
    if (!listed.ok) {
      const status: TranscriptStatus = listed.status === 404 || listed.status === 403 ? "inaccessible" : "error";
      if (status === "inaccessible") report.inaccessible_videos.push(video.vimeoId);
      else report.errors.push({ vimeo_video_id: video.vimeoId, lesson_id: video.lessonId, error: listed.error || "Vimeo error" });
      await upsertTranscript({
        lesson_id: video.lessonId,
        vimeo_video_id: video.vimeoId,
        source_provider: "vimeo",
        language: "en",
        transcript_text: "",
        status,
        error_message: listed.error || null,
        retrieved_at: new Date().toISOString(),
        provenance: { http_status: listed.status },
      });
      continue;
    }

    report.videos_matched += 1;
    if (!listed.tracks.length) {
      report.videos_with_no_captions.push(video.vimeoId);
      await upsertTranscript({
        lesson_id: video.lessonId,
        vimeo_video_id: video.vimeoId,
        source_provider: "vimeo",
        language: "en",
        transcript_text: "",
        status: "no_captions",
        retrieved_at: new Date().toISOString(),
        provenance: { tracks: 0 },
      });
      continue;
    }

    report.caption_tracks_found += listed.tracks.length;
    const englishTracks = listed.tracks.filter((track) => /^en/i.test(String(track.language || "")));
    if (englishTracks.length > 1) {
      report.ambiguous_mappings.push(`${video.lessonId}:${video.vimeoId}`);
    }
    const track = pickEnglishTrack(listed.tracks);
    const downloadUrl = trackDownloadUrl(track);
    if (!downloadUrl) {
      report.videos_with_no_captions.push(video.vimeoId);
      await upsertTranscript({
        lesson_id: video.lessonId,
        vimeo_video_id: video.vimeoId,
        source_provider: "vimeo",
        language: "en",
        transcript_text: "",
        status: "no_captions",
        retrieved_at: new Date().toISOString(),
        provenance: { tracks: listed.tracks.length, reason: "no_download_link" },
      });
      continue;
    }

    const downloaded = await downloadVimeoVtt(downloadUrl);
    if (!downloaded.ok || !downloaded.vtt) {
      report.errors.push({
        vimeo_video_id: video.vimeoId,
        lesson_id: video.lessonId,
        error: downloaded.error || "Could not download VTT.",
      });
      await upsertTranscript({
        lesson_id: video.lessonId,
        vimeo_video_id: video.vimeoId,
        source_provider: "vimeo",
        language: String(track.language || "en"),
        transcript_text: "",
        status: "error",
        error_message: downloaded.error || null,
        retrieved_at: new Date().toISOString(),
      });
      continue;
    }

    const hash = createHash("sha256").update(downloaded.vtt).digest("hex");
    const prior = byKey.get(`${video.lessonId}:${video.vimeoId}:en`);
    if (prior?.source_hash === hash && prior.status === "imported") {
      report.skipped_unchanged += 1;
      continue;
    }

    const cues = parseVttCues(downloaded.vtt);
    const transcript_text = transcriptFromCues(cues) || downloaded.vtt;
    await upsertTranscript({
      lesson_id: video.lessonId,
      vimeo_video_id: video.vimeoId,
      source_provider: "vimeo",
      language: String(track.language || "en").slice(0, 8) || "en",
      transcript_text,
      caption_vtt: downloaded.vtt,
      cues,
      source_hash: hash,
      status: "imported",
      error_message: null,
      retrieved_at: new Date().toISOString(),
      provenance: {
        track_id: track.id ?? null,
        track_name: track.name ?? null,
        track_language: track.language ?? null,
        track_type: track.type ?? null,
        imported_via: "vimeo_texttracks",
      },
      source_updated_at: track.modified_on || null,
    });
    report.transcripts_imported += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return report;
}

export async function importManualVtt(input: {
  lessonId: string;
  vimeoId: string;
  vtt: string;
  language?: string;
}): Promise<LessonTranscript | null> {
  const cues = parseVttCues(input.vtt);
  return upsertTranscript({
    lesson_id: input.lessonId,
    vimeo_video_id: input.vimeoId,
    source_provider: "manual_vtt",
    language: input.language || "en",
    transcript_text: transcriptFromCues(cues) || input.vtt,
    caption_vtt: input.vtt,
    cues,
    source_hash: createHash("sha256").update(input.vtt).digest("hex"),
    status: "imported",
    retrieved_at: new Date().toISOString(),
    provenance: { imported_via: "manual_vtt" },
  });
}
