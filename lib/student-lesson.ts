import { findLesson } from "./course";
import { SEED } from "./seed";
import { getSupabase } from "./supabase";
import type { Lesson, LessonType } from "./types";

export interface StudentLesson {
  id: string;
  type: LessonType;
  title: string;
  chapterId: string;
  chapterTitle: string;
  duration?: string;
  seconds?: number;
  blurb?: string;
  body?: string[];
  takeaways?: string[];
  due?: string;
  brief?: string;
  next: { id: string; title: string } | null;
  source: "supabase" | "seed";
}

export interface LessonProgress {
  completed: boolean;
  notes: string;
}

function asStringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\||\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return undefined;
}

function chapterTitle(chapterId: string): string {
  const chapter = SEED.chapters.find((c) => c.id === chapterId);
  return chapter ? chapter.title : chapterId;
}

function fromSeed(lessonId: string): StudentLesson | null {
  const hit = findLesson(SEED, lessonId);
  if (!hit || hit.id !== lessonId) return null;
  return packSeed(hit);
}

function packSeed(lesson: Lesson & { chapter: { id: string; title: string } }): StudentLesson {
  const ordered = SEED.chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c })));
  const index = ordered.findIndex((l) => l.id === lesson.id);
  const next = ordered[index + 1];
  return {
    id: lesson.id,
    type: lesson.type,
    title: lesson.title,
    chapterId: lesson.chapter.id,
    chapterTitle: lesson.chapter.title,
    duration: lesson.duration,
    seconds: lesson.seconds,
    blurb: lesson.blurb,
    body: lesson.body,
    takeaways: lesson.takeaways,
    due: lesson.due,
    brief: lesson.brief,
    next: next ? { id: next.id, title: next.title } : null,
    source: "seed",
  };
}

/** Prefer the lessons table; fall back to the seeded course so local still works. */
export async function fetchStudentLesson(lessonId: string): Promise<StudentLesson | null> {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client.from("lessons").select("*").eq("id", lessonId).maybeSingle();
    if (!error && data) {
      const { data: neighbors } = await client
        .from("lessons")
        .select("id, title, chapter_id, position")
        .order("chapter_id", { ascending: true })
        .order("position", { ascending: true });
      const list = neighbors || [];
      const index = list.findIndex((row) => row.id === lessonId);
      const next = index >= 0 ? list[index + 1] : null;
      return {
        id: data.id,
        type: data.type as LessonType,
        title: data.title,
        chapterId: data.chapter_id,
        chapterTitle: chapterTitle(data.chapter_id),
        duration: data.duration || undefined,
        seconds: data.seconds || undefined,
        blurb: data.blurb || undefined,
        body: asStringList(data.body),
        takeaways: asStringList(data.takeaways),
        due: data.due || undefined,
        brief: data.brief || undefined,
        next: next ? { id: next.id, title: next.title } : null,
        source: "supabase",
      };
    }
  }
  return fromSeed(lessonId);
}

export async function fetchLessonProgress(lessonId: string): Promise<{
  userId: string | null;
  email: string | null;
  progress: LessonProgress;
}> {
  const empty = { completed: false, notes: "" };
  const client = getSupabase();
  if (!client) return { userId: null, email: null, progress: empty };

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user || null;
  if (!user) return { userId: null, email: null, progress: empty };

  const { data } = await client
    .from("lesson_progress")
    .select("completed, notes")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email || null,
    progress: {
      completed: Boolean(data?.completed),
      notes: data?.notes || "",
    },
  };
}

export async function saveLessonProgress(lessonId: string, progress: LessonProgress): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { ok: false, error: "Sign in to save your progress." };

  const { error } = await client.from("lesson_progress").upsert({
    user_id: user.id,
    lesson_id: lessonId,
    completed: progress.completed,
    notes: progress.notes,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInStudent(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signUpStudent(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOutStudent(): Promise<void> {
  const client = getSupabase();
  if (client) await client.auth.signOut();
}
