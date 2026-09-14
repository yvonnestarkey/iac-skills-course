import { getLessonPdfUrl } from "./getLessonPdf";
import { asPdfUrl } from "./lesson-resources";
import { getSupabase } from "./supabase";

export interface PdfUrlAudit {
  lessonId: string;
  title: string;
  pdfUrl: string | null;
  ok: boolean;
  detail: string;
}

export interface CourseAuditReport {
  generatedAt: string;
  pdfUrls: {
    checked: number;
    invalid: PdfUrlAudit[];
    missing: PdfUrlAudit[];
  };
  prereqCycles: string[][];
  rls: {
    lessonsReadable: boolean;
    submissionsLeakedWithoutAuth: boolean;
    progressLeakedWithoutAuth: boolean;
    expected: {
      lessons: string;
      submissions: string;
      progress: string;
    };
    notes: string[];
  };
}

function findPrereqCycles(rows: Array<{ id: string; prereq_lesson_id?: string | null }>): string[][] {
  const next = new Map(rows.map((row) => [row.id, row.prereq_lesson_id || null]));
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (id: string, path: string[]) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      cycles.push([...path.slice(Math.max(0, start)), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const prereq = next.get(id);
    if (prereq && next.has(prereq)) walk(prereq, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };

  [...next.keys()].forEach((id) => walk(id, []));
  return cycles;
}

async function probePdfUrl(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, detail: "URL must be http or https" };
    }
  } catch {
    return { ok: false, detail: "Not a valid URL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (head.ok) return { ok: true, detail: `HEAD ${head.status}` };
    const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-16" }, redirect: "follow", signal: controller.signal });
    if (get.ok || get.status === 206) return { ok: true, detail: `GET ${get.status}` };
    return { ok: false, detail: `HTTP ${get.status || head.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return { ok: false, detail: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function auditCourseData(): Promise<CourseAuditReport> {
  const client = getSupabase();
  const empty: CourseAuditReport = {
    generatedAt: new Date().toISOString(),
    pdfUrls: { checked: 0, invalid: [], missing: [] },
    prereqCycles: [],
    rls: {
      lessonsReadable: false,
      submissionsLeakedWithoutAuth: false,
      progressLeakedWithoutAuth: false,
      expected: {
        lessons: "Students and guests can read lessons.",
        submissions: "Students see only their own rows; coaches/tutors use is_course_staff().",
        progress: "Students see only their own lesson_progress rows.",
      },
      notes: ["Supabase is not configured."],
    },
  };
  if (!client) return empty;

  const lessons = await client.from("lessons").select("id, title, pdf_url, resource_downloads, prereq_lesson_id");
  const rows = lessons.data || [];
  const pdfChecks: PdfUrlAudit[] = [];

  for (const row of rows) {
    const pdfUrl = getLessonPdfUrl({ pdf_url: row.pdf_url, resource_downloads: row.resource_downloads }) || asPdfUrl(row.pdf_url) || null;
    if (!pdfUrl) {
      pdfChecks.push({
        lessonId: row.id,
        title: row.title,
        pdfUrl: null,
        ok: true,
        detail: "No pdf_url (optional)",
      });
      continue;
    }
    const probe = await probePdfUrl(pdfUrl);
    pdfChecks.push({
      lessonId: row.id,
      title: row.title,
      pdfUrl,
      ok: probe.ok,
      detail: probe.detail,
    });
  }

  const submissions = await client.from("student_submissions").select("id, student_id").limit(5);
  const progress = await client.from("lesson_progress").select("user_id, lesson_id").limit(5);
  const notes: string[] = [];
  const submissionsLeaked = !submissions.error && (submissions.data || []).length > 0;
  const progressLeaked = !progress.error && (progress.data || []).length > 0;
  if (submissionsLeaked) notes.push("Anon client can read student_submissions. Tighten RLS so only the owner or is_course_staff() can select.");
  if (progressLeaked) notes.push("Anon client can read lesson_progress. Limit select to the signed-in student or staff.");
  if (lessons.error) notes.push(`Lessons select failed: ${lessons.error.message}`);
  if (!notes.length) notes.push("Live probes used the publishable key (no user JWT). Staff access is defined in SQL via is_course_staff().");

  return {
    generatedAt: new Date().toISOString(),
    pdfUrls: {
      checked: pdfChecks.filter((item) => item.pdfUrl).length,
      invalid: pdfChecks.filter((item) => item.pdfUrl && !item.ok),
      missing: pdfChecks.filter((item) => !item.pdfUrl),
    },
    prereqCycles: findPrereqCycles(rows),
    rls: {
      lessonsReadable: !lessons.error,
      submissionsLeakedWithoutAuth: submissionsLeaked,
      progressLeakedWithoutAuth: progressLeaked,
      expected: empty.rls.expected,
      notes,
    },
  };
}
