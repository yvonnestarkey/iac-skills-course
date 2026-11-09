import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  clinicResourceHref,
  clipFromDraft,
  clipsForStudyClinicSection,
  emptyClinicDraft,
  inferStudyClinicKind,
  inferStudyClinicSection,
  isRetiredCourseChapter,
  isStudyClinicSectionId,
  slugifyClinicId,
  studyClinicIntro,
  STUDY_CLINIC_SECTIONS,
  withoutRetiredChapters,
  type StudyClinicClip,
} from "./study-clinic";

test("Study Clinic drafts require a title and at least one video URL", () => {
  const draft = emptyClinicDraft();
  draft.title = "Why don't I do questions?";
  draft.videoUrlsText = "https://player.vimeo.com/video/598725555\nhttps://player.vimeo.com/video/598729594";
  const parsed = clipFromDraft(draft);
  assert.ok(parsed.clip);
  assert.equal(parsed.clip?.id, slugifyClinicId(draft.title));
  assert.equal(Array.isArray(parsed.clip?.video_urls) && parsed.clip.video_urls.length, 2);
  assert.equal(clipFromDraft(emptyClinicDraft()).error, "Title is required.");
  const missingVideo = emptyClinicDraft();
  missingVideo.title = "Why don't I do questions?";
  assert.equal(clipFromDraft(missingVideo).error, "Add at least one video URL.");
  const pdf = emptyClinicDraft("auditing");
  pdf.title = "IFRS 15 reminder";
  pdf.kind = "pdf";
  assert.equal(clipFromDraft(pdf).error, "Upload or paste a PDF URL.");
  pdf.resourceUrl = "https://example.com/ifrs-15.pdf";
  assert.equal(clipFromDraft(pdf).clip?.kind, "pdf");
  assert.equal(clipFromDraft(pdf).clip?.section, "auditing");
  const link = emptyClinicDraft("taxation");
  link.title = "SARS guide";
  link.kind = "link";
  link.resourceUrl = "https://example.com/sars";
  link.resourceLabel = "Open SARS guide";
  assert.equal(clipFromDraft(link).clip?.kind, "link");
  assert.equal(clipFromDraft(link).clip?.resource_label, "Open SARS guide");
});

test("the old Common Fixes chapter is retired from the course", () => {
  assert.equal(isRetiredCourseChapter({ id: "ch11", title: "Fixes for Common Student Challenges" }), true);
  assert.equal(isRetiredCourseChapter({ id: "ch-task1", title: "Common Fixes" }), true);
  assert.equal(isRetiredCourseChapter({ id: "ch1", title: "Task 1" }), false);
  assert.deepEqual(
    withoutRetiredChapters([
      { id: "ch1", title: "Task 1" },
      { id: "ch11", title: "Fixes for Common Student Challenges" },
    ]).map((chapter) => chapter.id),
    ["ch1"]
  );
  const sql = readFileSync(resolve("supabase/remove-common-fixes-chapter.sql"), "utf8");
  assert.match(sql, /delete from public.chapters/);
  assert.match(sql, /chapter_id = 'ch11'/);
});

test("Study Clinic is a table, sidebar page, and Tools editor", () => {
  const sql = readFileSync(resolve("supabase/study-clinic.sql"), "utf8");
  const sections = readFileSync(resolve("supabase/study-clinic-sections.sql"), "utf8");
  const resources = readFileSync(resolve("supabase/study-clinic-resources.sql"), "utf8");
  const remove = readFileSync(resolve("supabase/study-clinic-remove-from-lessons.sql"), "utf8");
  const nav = readFileSync(resolve("components/student/StudentCourseNav.tsx"), "utf8");
  const page = readFileSync(resolve("components/student/StudyClinic.tsx"), "utf8");
  const library = readFileSync(resolve("components/student/StudyClinicLibrary.tsx"), "utf8");
  const editor = readFileSync(resolve("components/coach/StudyClinicPageEditor.tsx"), "utf8");
  const form = readFileSync(resolve("components/coach/StudyClinicResourceForm.tsx"), "utf8");
  const tools = readFileSync(resolve("lib/course-tools.ts"), "utf8");
  const manager = readFileSync(resolve("components/coach/StudyClinicManager.tsx"), "utf8");
  assert.match(sql, /create table if not exists public.study_clinic/);
  assert.match(sql, /from public.lessons/);
  assert.match(sections, /add column if not exists section/);
  assert.match(sections, /financial-management/);
  assert.match(resources, /add column if not exists kind/);
  assert.match(resources, /study_clinic_pages/);
  assert.match(remove, /delete from public.lessons/);
  assert.match(nav, /Study Clinic/);
  assert.match(page, /study-clinic-card/);
  assert.match(page, /STUDY_CLINIC_SECTIONS/);
  assert.match(library, /\/api\/study-clinic/);
  assert.match(library, /study-clinic-btn/);
  assert.match(library, /StudyClinicPageEditor/);
  assert.match(editor, /Edit this library/);
  assert.match(form, /Video URLs/);
  assert.match(form, /PDF/);
  assert.match(form, /Link URL/);
  assert.match(form, /Library/);
  assert.match(form, /Save Study Clinic resource/);
  assert.match(form, /Choose PDF/);
  const pdfRoute = readFileSync(resolve("app/api/coach/pdf/route.ts"), "utf8");
  assert.match(pdfRoute, /getServiceSupabase/);
  assert.match(pdfRoute, /course-pdfs/);
  assert.match(tools, /study-clinic/);
  assert.match(manager, /StudyClinicResourceForm/);
});

test("Study Clinic files FinMan clips into Financial Management and the rest into Study Advice", () => {
  assert.equal(isStudyClinicSectionId("study-advice"), true);
  assert.equal(isStudyClinicSectionId("ch11-l2"), false);
  assert.equal(STUDY_CLINIC_SECTIONS.map((section) => section.id).join(","), "financial-reporting,auditing,financial-management,taxation,study-advice");
  assert.equal(inferStudyClinicSection({ id: "ch11-l8", title: '"I struggle with FinMan topics"' }), "financial-management");
  assert.equal(inferStudyClinicSection({ id: "ch11-l2", title: "Why don't I do questions?" }), "study-advice");
  assert.equal(inferStudyClinicSection({ id: "ch11-l2", title: "Why don't I do questions?", section: "taxation" }), "taxation");
  const clips: StudyClinicClip[] = [
    { id: "ch11-l8", title: "I struggle with FinMan topics", duration: null, blurb: null, video_urls: [{ url: "https://player.vimeo.com/video/1" }], position: 7, published: true, section: inferStudyClinicSection({ id: "ch11-l8", title: "I struggle with FinMan topics" }), kind: "video", resource_url: null, resource_label: null },
    { id: "ch11-l2", title: "Why don't I do questions?", duration: null, blurb: null, video_urls: [{ url: "https://player.vimeo.com/video/2" }], position: 1, published: true, section: inferStudyClinicSection({ id: "ch11-l2", title: "Why don't I do questions?" }), kind: "video", resource_url: null, resource_label: null },
    { id: "fr-notes", title: "FR notes", duration: null, blurb: null, video_urls: [], position: 1, published: true, section: "financial-reporting", kind: "pdf", resource_url: "https://example.com/fr.pdf", resource_label: null },
  ];
  assert.equal(inferStudyClinicKind({ resource_url: "https://example.com/guide.pdf" }), "pdf");
  assert.equal(clinicResourceHref(clips[2])?.href, "https://example.com/fr.pdf");
  assert.equal(clinicResourceHref(clips[0])?.href, "/student/study-clinic/ch11-l8");
  assert.equal(studyClinicIntro({ section: "auditing", intro: "", body: "" }, "auditing"), "Resources for this library. Open the one you need.");
  assert.deepEqual(
    clipsForStudyClinicSection(clips, "financial-reporting").map((clip) => clip.id),
    ["fr-notes"]
  );
  assert.deepEqual(
    clipsForStudyClinicSection(clips, "financial-management").map((clip) => clip.id),
    ["ch11-l8"]
  );
  assert.deepEqual(
    clipsForStudyClinicSection(clips, "study-advice").map((clip) => clip.id),
    ["ch11-l2"]
  );
  assert.equal(clipsForStudyClinicSection(clips, "auditing").length, 0);
});
