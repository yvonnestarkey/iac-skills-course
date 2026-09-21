import { parseLessonVideos } from "@/lib/lesson-videos";

export const CHECKPOINT_NOTES_PREFIX = "checkpoint-v1:";

export interface LessonCheckpointState {
  submitted: boolean;
  answers: Record<string, string>;
}

export function isProgressiveCheckpoint(lesson: {
  type?: string | null;
  survey_id?: string | null;
  video_url?: string;
  videos?: { url: string }[];
}): boolean {
  const videos = lesson.videos?.length ? lesson.videos : parseLessonVideos(lesson.video_url);
  return lesson.type === "video" && Boolean(lesson.survey_id) && videos.length > 0;
}

export function parseCheckpointNotes(notes: string): LessonCheckpointState | null {
  const raw = notes.startsWith(CHECKPOINT_NOTES_PREFIX) ? notes.slice(CHECKPOINT_NOTES_PREFIX.length) : notes.trim();
  if (!raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LessonCheckpointState>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      submitted: Boolean(parsed.submitted),
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
    };
  } catch {
    return null;
  }
}

export function serializeCheckpointNotes(state: LessonCheckpointState): string {
  return `${CHECKPOINT_NOTES_PREFIX}${JSON.stringify(state)}`;
}
