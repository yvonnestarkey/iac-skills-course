"use client";

import { useEffect, useState } from "react";
import {
  CSV_COLUMNS,
  CSV_TEMPLATE,
  LESSON_TYPES,
  buildLesson,
  checkLessonsTable,
  csvToDrafts,
  deleteLesson,
  duplicateLesson,
  fetchManagedCourse,
  moveLessonToChapter,
  nextLiveLessonId,
  pullLessons,
  pushLessons,
  saveChapterOrder,
  updateLessonFields,
  uploadLessonBanner,
  uploadLessonPdf,
  type ManagedChapter,
  type ManagedLesson,
  type LessonDraft,
  type ParseResult,
} from "@/lib/content";
import { supabaseConfigured, supabaseProjectRef } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import type { Chapter, Lesson } from "@/lib/types";
import { fetchCustomSurveys, insertIndexAfterLesson, SURVEY_PLACE_END, SURVEY_PLACE_START, type CustomSurvey } from "@/lib/custom-surveys";
import { invalidateCourseOutline } from "@/lib/student-lesson";
import CoachToolPanel from "@/components/coach/CoachToolPanel";
import CourseOutlineBoard from "@/components/coach/CourseOutlineBoard";
import DripMessageFields from "@/components/coach/DripMessageFields";
import RichTextField from "@/components/ui/RichTextField";
import {
  completionDripForLesson,
  deleteCoachDrip,
  dripWriteFromMessage,
  emptyDripWrite,
  listCoachDrips,
  saveCoachDrip,
  type DripWrite,
} from "@/lib/drip-messages";
import { firstLessonWebLink } from "@/lib/getLessonPdf";
import { lessonToolOptions } from "@/lib/reading-drills";

const BLANK = {
  chapter: "",
  type: "video",
  title: "",
  duration: "",
  seconds: "",
  blurb: "",
  body: "",
  takeaways: "",
  due: "",
  brief: "",
  surveyId: "",
  videoUrl: "",
  bannerUrl: "",
  tool: "",
  pdfUrl: "",
  resourceUrl: "",
  resourceLabel: "",
  afterLessonId: SURVEY_PLACE_END,
  isDraft: true,
};

/** New teaching work goes before the chapter's Ask the Coach and survey lessons. */
function insertLesson(chapter: Chapter, lesson: Lesson, index?: number) {
  const existing = chapter.lessons.findIndex((l) => l.id === lesson.id);
  if (existing >= 0) {
    chapter.lessons[existing] = lesson;
    return;
  }
  if (index != null) {
    chapter.lessons.splice(Math.max(0, Math.min(index, chapter.lessons.length)), 0, lesson);
    return;
  }
  const tail = chapter.lessons.findIndex((l) => l.type === "ask" || l.type === "survey");
  if (lesson.type === "ask" || lesson.type === "survey" || tail < 0) chapter.lessons.push(lesson);
  else chapter.lessons.splice(tail, 0, lesson);
}

export default function ContentManager() {
  const { data, mutate } = useStore();
  const [form, setForm] = useState({ ...BLANK, chapter: "" });
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [surveys, setSurveys] = useState<CustomSurvey[]>([]);
  const [board, setBoard] = useState<ManagedChapter[]>([]);
  const [boardReady, setBoardReady] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dripEnabled, setDripEnabled] = useState(false);
  const [dripForm, setDripForm] = useState<DripWrite>(emptyDripWrite());
  const [lessonDripId, setLessonDripId] = useState<string | null>(null);
  const [openTools, setOpenTools] = useState<Partial<Record<"admin" | "lesson" | "csv" | "outline", boolean>>>({});

  const toggleTool = (id: "admin" | "lesson" | "csv" | "outline") => {
    setOpenTools((current) => ({ ...current, [id]: !current[id] }));
  };

  const loadBoard = async () => {
    const result = await fetchManagedCourse();
    if (result.ok && result.data) setBoard(result.data);
    setBoardReady(true);
  };

  useEffect(() => {
    fetchCustomSurveys().then((result) => {
      if (result.ok) setSurveys(result.data);
    });
    void loadBoard();
  }, []);

  useEffect(() => {
    if (!board.length) return;
    setForm((current) => {
      if (current.chapter && board.some((chapter) => chapter.id === current.chapter)) return current;
      return { ...current, chapter: board[0].id };
    });
  }, [board]);

  const set = (next: Partial<typeof BLANK>) => setForm((current) => ({ ...current, ...next }));
  const setDrip = (next: Partial<DripWrite>) => setDripForm((current) => ({ ...current, ...next }));

  const resetDrip = () => {
    setDripEnabled(false);
    setDripForm(emptyDripWrite());
    setLessonDripId(null);
  };

  const persistLessonDrip = async (lessonId: string, lessonTitle: string) => {
    if (!dripEnabled) {
      if (lessonDripId) {
        const removed = await deleteCoachDrip(lessonDripId);
        return removed.ok ? "" : ` ${removed.error || "The lesson saved, but the drip message could not be removed."}`;
      }
      return "";
    }
    const title = dripForm.title.trim() || `After you complete ${lessonTitle}`;
    const body = dripForm.body.trim();
    if (!body) return " The lesson saved, but the drip message needs a body.";
    const saved = await saveCoachDrip({
      ...dripForm,
      id: lessonDripId || undefined,
      title,
      body,
      trigger: "lesson_completed",
      lessonId,
    });
    return saved.ok ? "" : ` ${saved.error || "The lesson saved, but the drip message could not be saved."}`;
  };

  const addDrafts = (drafts: LessonDraft[], insertAt?: number) => {
    mutate((draft) => {
      drafts.forEach((d) => {
        const chapter = draft.chapters.find((c) => c.id === d.chapterId);
        if (chapter) insertLesson(chapter, d.lesson, insertAt);
      });
    });
  };

  const saveToDb = async (drafts: LessonDraft[], startPosition: number) => {
    if (!supabaseConfigured) return " Supabase is not configured.";
    const result = await pushLessons(drafts, startPosition);
    return result.ok ? "" : ` ${result.error}`;
  };

  const addLesson = async () => {
    if (!form.title.trim()) {
      setStatus({ kind: "warn", text: "Give the lesson a title first." });
      return;
    }
    if (form.type === "survey" && !form.surveyId) {
      setStatus({ kind: "warn", text: "Choose a custom survey to attach." });
      return;
    }
    const chapter = board.find((item) => item.id === form.chapter) || board[0];
    if (!chapter) {
      setStatus({ kind: "warn", text: "No live chapters yet. Add a chapter in the course outline first." });
      return;
    }
    const existingIds = board.flatMap((item) => item.lessons.map((lesson) => lesson.id));
    const lesson = buildLesson(nextLiveLessonId(chapter.id, existingIds), {
      type: form.type,
      title: form.title,
      duration: form.duration,
      seconds: form.seconds,
      blurb: form.blurb,
      body: form.body,
      takeaways: form.takeaways,
      due: form.due,
      brief: form.brief,
      surveyId: form.surveyId,
      videoUrl: form.videoUrl,
      bannerUrl: form.bannerUrl,
      tool: form.tool,
      pdfUrl: form.pdfUrl,
      resourceUrl: form.resourceUrl,
      resourceLabel: form.resourceLabel,
      isDraft: form.isDraft ? "true" : "false",
    });
    lesson.is_draft = form.isDraft;
    const siblingIds = chapter.lessons.map((item) => item.id);
    const insertAt = insertIndexAfterLesson(siblingIds, form.afterLessonId);
    const orderedIds = [...siblingIds];
    orderedIds.splice(insertAt, 0, lesson.id);
    setBusy(true);
    addDrafts([{ chapterId: chapter.id, lesson }], insertAt);
    const problem = await saveToDb([{ chapterId: chapter.id, lesson }], insertAt + 1);
    const orderProblem = problem ? { ok: false, error: problem } : await saveChapterOrder(chapter.id, orderedIds);
    invalidateCourseOutline();
    await loadBoard();
    setBusy(false);
    setForm({ ...BLANK, chapter: chapter.id, type: form.type, afterLessonId: SURVEY_PLACE_END });
    setEditingId(null);
    if (problem || !orderProblem.ok) {
      setStatus({
        kind: "warn",
        text: `“${lesson.title}” was not saved to Supabase.${problem}${
          orderProblem.ok ? "" : ` ${orderProblem.error || "Could not save the new lesson order."}`
        }`,
      });
      return;
    }
    const dripProblem = await persistLessonDrip(lesson.id, lesson.title);
    resetDrip();
    setStatus({
      kind: dripProblem ? "warn" : "ok",
      text: form.isDraft
        ? `“${lesson.title}” is saved as a draft. Only Coach View can see it.${dripProblem}`
        : `“${lesson.title}” is now in Supabase and the student sidebar.${dripProblem}`,
    });
  };

  const readFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result));
      setPreview(null);
      setStatus({ kind: "ok", text: `Loaded ${file.name}. Check the preview, then import.` });
    };
    reader.onerror = () => setStatus({ kind: "warn", text: "That file could not be read." });
    reader.readAsText(file);
  };

  const importCsv = async () => {
    const parsed = preview || csvToDrafts(data, csv);
    setPreview(parsed);
    if (!parsed.drafts.length) {
      setStatus({ kind: "warn", text: "Nothing importable in that CSV yet." });
      return;
    }
    setBusy(true);
    addDrafts(parsed.drafts);
    const problem = await saveToDb(parsed.drafts, 100);
    invalidateCourseOutline();
    await loadBoard();
    setBusy(false);
    setCsv("");
    setPreview(null);
    setStatus({
      kind: problem ? "warn" : "ok",
      text: problem
        ? `Imported locally, but Supabase did not update.${problem}`
        : `Imported ${parsed.drafts.length} lesson${parsed.drafts.length === 1 ? "" : "s"} into Supabase.${
            parsed.errors.length ? ` ${parsed.errors.length} row(s) skipped.` : ""
          }`,
    });
  };

  const testConnection = async () => {
    setBusy(true);
    const result = await checkLessonsTable();
    setBusy(false);
    setStatus(
      result.ok
        ? { kind: "ok", text: `Connected. The lessons table holds ${result.data} row(s).` }
        : { kind: "warn", text: `Could not read the lessons table. ${result.error}` }
    );
  };

  const loadFromDb = async () => {
    setBusy(true);
    const result = await pullLessons();
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "warn", text: `Could not load from Supabase. ${result.error}` });
      return;
    }
    const drafts = result.data.filter((d) => data.chapters.some((c) => c.id === d.chapterId));
    addDrafts(drafts);
    await loadBoard();
    setStatus({ kind: "ok", text: `Loaded ${drafts.length} lesson(s) from Supabase into the course.` });
  };

  const removeLesson = async (chapterId: string, lessonId: string) => {
    mutate((draft) => {
      const chapter = draft.chapters.find((c) => c.id === chapterId);
      if (chapter) chapter.lessons = chapter.lessons.filter((l) => l.id !== lessonId);
    });
    if (supabaseConfigured) {
      const removed = await deleteLesson(lessonId);
      if (!removed.ok) {
        setStatus({ kind: "warn", text: removed.error || "Could not remove that lesson from Supabase." });
        await loadBoard();
        return;
      }
    }
    invalidateCourseOutline();
    await loadBoard();
    setStatus({ kind: "ok", text: `Removed ${lessonId} from Supabase.` });
  };

  const duplicate = async (lessonId: string) => {
    setBusy(true);
    const result = await duplicateLesson(lessonId);
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "warn", text: result.error || "Could not duplicate that lesson." });
      return;
    }
    invalidateCourseOutline();
    await loadBoard();
    setStatus({ kind: "ok", text: `Duplicated “${result.data?.title}”. It sits just after the original.` });
  };

  const reorder = async (chapterId: string, lessonIds: string[]) => {
    setBoard((current) =>
      current.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        const map = new Map(chapter.lessons.map((lesson) => [lesson.id, lesson]));
        return { ...chapter, lessons: lessonIds.map((id) => map.get(id)).filter(Boolean) as ManagedLesson[] };
      })
    );
    const result = await saveChapterOrder(chapterId, lessonIds);
    if (!result.ok) {
      setStatus({ kind: "warn", text: result.error || "Could not save the new order." });
      await loadBoard();
      return;
    }
    invalidateCourseOutline();
  };

  const moveLesson = async (lessonId: string, fromChapterId: string, toChapterId: string, toIndex?: number) => {
    const result = await moveLessonToChapter(lessonId, fromChapterId, toChapterId, toIndex);
    if (!result.ok) {
      setStatus({ kind: "warn", text: result.error || "Could not move that lesson." });
      return;
    }
    invalidateCourseOutline();
    await loadBoard();
    setStatus({ kind: "ok", text: "Lesson moved." });
  };

  const startEdit = (lesson: ManagedLesson) => {
    setEditingId(lesson.id);
    setForm({
      chapter: lesson.chapter_id,
      type: lesson.type,
      title: lesson.title,
      duration: lesson.duration || "",
      seconds: lesson.seconds ? String(lesson.seconds) : "",
      blurb: lesson.blurb || "",
      body: Array.isArray(lesson.body) ? lesson.body.join("\n") : String(lesson.body || ""),
      takeaways: Array.isArray(lesson.takeaways) ? lesson.takeaways.join("\n") : String(lesson.takeaways || ""),
      due: lesson.due || "",
      brief: lesson.brief || "",
      surveyId: lesson.survey_id || "",
      videoUrl: lesson.video_url || "",
      bannerUrl: lesson.banner_image_url || "",
      tool: lesson.tool || "",
      pdfUrl: lesson.pdf_url || "",
      resourceUrl: firstLessonWebLink(lesson)?.url || "",
      resourceLabel: firstLessonWebLink(lesson)?.title === "Open link" ? "" : firstLessonWebLink(lesson)?.title || "",
      afterLessonId: SURVEY_PLACE_END,
      isDraft: Boolean(lesson.is_draft),
    });
    resetDrip();
    void listCoachDrips().then((listed) => {
      const existing = completionDripForLesson(listed.data || [], lesson.id);
      if (!existing) return;
      setDripEnabled(true);
      setLessonDripId(existing.id);
      setDripForm(dripWriteFromMessage(existing));
    });
    setStatus({ kind: "ok", text: `Editing “${lesson.title}”.` });
    setOpenTools((current) => ({ ...current, lesson: true }));
    window.setTimeout(() => {
      document.getElementById("builder-lesson-tool")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!form.title.trim()) {
      setStatus({ kind: "warn", text: "Give the lesson a title first." });
      return;
    }
    setBusy(true);
    const result = await updateLessonFields(editingId, {
      chapter_id: form.chapter,
      type: form.type,
      title: form.title.trim(),
      duration: form.duration.trim() || null,
      seconds: form.seconds ? Number(form.seconds) : null,
      blurb: form.blurb.trim() || null,
      body: form.body
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      takeaways: form.takeaways
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      due: form.due.trim() || null,
      brief: form.brief.trim() || null,
      survey_id: form.surveyId || null,
      video_url: form.videoUrl.trim() || null,
      banner_image_url: form.bannerUrl.trim() || null,
      tool: form.tool || null,
      pdf_url: form.pdfUrl.trim() || null,
      resource_downloads: form.resourceUrl.trim()
        ? [{ url: form.resourceUrl.trim(), title: form.resourceLabel.trim() || "Open link" }]
        : null,
      is_draft: form.isDraft,
    });
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "warn", text: result.error || "Could not save that lesson." });
      return;
    }
    invalidateCourseOutline();
    await loadBoard();
    const dripProblem = await persistLessonDrip(editingId, form.title.trim());
    setEditingId(null);
    setForm({ ...BLANK, chapter: form.chapter, type: form.type });
    resetDrip();
    setStatus({
      kind: dripProblem ? "warn" : "ok",
      text: dripProblem
        ? `Lesson saved.${dripProblem}`
        : form.isDraft
          ? "Lesson saved as a draft. Students cannot see it."
          : "Lesson saved and visible to students.",
    });
  };

  const pickBanner = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    const result = await uploadLessonBanner(file);
    setBusy(false);
    if (!result.ok || !result.data) {
      setStatus({ kind: "warn", text: result.error || "Could not upload that image. Paste a public URL instead." });
      return;
    }
    set({ bannerUrl: result.data });
    setStatus({ kind: "ok", text: "Banner image uploaded." });
  };

  const pickPdf = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    const result = await uploadLessonPdf(file);
    setBusy(false);
    if (!result.ok || !result.data) {
      setStatus({ kind: "warn", text: result.error || "Could not upload that PDF. Paste a public URL instead." });
      return;
    }
    set({ pdfUrl: result.data });
    setStatus({ kind: "ok", text: "PDF uploaded." });
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "iac-lesson-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const teachingFields = form.type === "video" || form.type === "reading";
  const workFields = form.type === "assignment" || form.type === "upload";
  const surveyFields = form.type === "survey";

  return (
    <>
      {status ? <div className={status.kind === "ok" ? "notice" : "waiting"}>{status.text}</div> : null}
      <CoachToolPanel
        title="Admin Content Manager"
        description="Test the database, load live lessons, and download the CSV template. New lessons are written to Supabase and show in the student sidebar."
        open={Boolean(openTools.admin)}
        onToggle={() => toggleTool("admin")}
        badge={
          <span className={`badge ${supabaseConfigured ? "ok" : "warn"}`}>
            {supabaseConfigured ? `Supabase · ${supabaseProjectRef}` : "Supabase not configured"}
          </span>
        }
      >
        <div className="actions">
          <button className="ghost" onClick={testConnection} disabled={busy}>
            Test connection
          </button>
          <button className="ghost" onClick={loadFromDb} disabled={busy || !supabaseConfigured}>
            Load lessons from Supabase
          </button>
          <button className="ghost" onClick={downloadTemplate}>
            Download CSV template
          </button>
        </div>
      </CoachToolPanel>

      <CoachToolPanel
        id="builder-lesson-tool"
        title={editingId ? "Edit lesson" : "Add a lesson"}
        description="Create the basic lesson here. New lessons start as drafts so only Coach View can see them. Open the lesson in the course to keep editing."
        open={Boolean(openTools.lesson)}
        onToggle={() => toggleTool("lesson")}
      >
          <div className="plan-field">
            <label htmlFor="cm-chapter">
              <strong>Chapter</strong>
            </label>
            <select
              id="cm-chapter"
              className="select-line"
              value={form.chapter}
              onChange={(event) => set({ chapter: event.target.value, afterLessonId: SURVEY_PLACE_END })}
            >
              {board.length ? (
                board.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))
              ) : (
                <option value="">{boardReady ? "No live chapters yet" : "Loading live chapters…"}</option>
              )}
            </select>
          </div>
          {editingId ? null : (
            <div className="plan-field">
              <label htmlFor="cm-after">
                <strong>After which lesson</strong>
              </label>
              <select
                id="cm-after"
                className="select-line"
                value={form.afterLessonId}
                onChange={(event) => set({ afterLessonId: event.target.value })}
              >
                <option value={SURVEY_PLACE_START}>At the start of the chapter</option>
                {(board.find((chapter) => chapter.id === form.chapter)?.lessons || []).map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    After: {lesson.title}
                  </option>
                ))}
                <option value={SURVEY_PLACE_END}>At the end of the chapter</option>
              </select>
            </div>
          )}
          <div className="plan-field">
            <label htmlFor="cm-type">
              <strong>Lesson type</strong>
            </label>
            <select
              id="cm-type"
              className="select-line"
              value={form.type}
              onChange={(event) => set({ type: event.target.value })}
            >
              {LESSON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="plan-field">
            <label htmlFor="cm-title">
              <strong>Title</strong>
            </label>
            <input
              id="cm-title"
              type="text"
              className="select-line"
              placeholder="Control accounts"
              value={form.title}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>
          {teachingFields ? (
            <>
              <div className="plan-field">
                <label htmlFor="cm-duration">
                  <strong>Duration</strong>
                </label>
                <div className="hours-row">
                  <input
                    id="cm-duration"
                    type="text"
                    placeholder={form.type === "video" ? "9 min" : "6 min read"}
                    value={form.duration}
                    onChange={(event) => set({ duration: event.target.value })}
                  />
                  {form.type === "video" ? (
                    <input
                      type="number"
                      min={30}
                      step={30}
                      placeholder="seconds"
                      value={form.seconds}
                      onChange={(event) => set({ seconds: event.target.value })}
                    />
                  ) : null}
                  <span className="muted small">
                    {form.type === "video" ? "shown on the player, seconds drive the planner estimate" : "read time"}
                  </span>
                </div>
              </div>
              {form.type === "video" ? (
                <div className="plan-field">
                  <label htmlFor="cm-video">
                    <strong>Video URL</strong>
                  </label>
                  <input
                    id="cm-video"
                    type="url"
                    className="select-line"
                    placeholder="https://player.vimeo.com/video/…"
                    value={form.videoUrl}
                    onChange={(event) => set({ videoUrl: event.target.value })}
                  />
                </div>
              ) : null}
              <div className="plan-field">
                <label htmlFor="cm-blurb">
                  <strong>Lead line</strong>
                </label>
                <RichTextField id="cm-blurb" rows={2} value={form.blurb} onChange={(blurb) => set({ blurb })} />
              </div>
              <div className="plan-field">
                <label htmlFor="cm-body">
                  <strong>Body</strong>
                </label>
                <RichTextField
                  id="cm-body"
                  rows={5}
                  value={form.body}
                  onChange={(body) => set({ body })}
                  hint="One paragraph per line. Use the toolbar for bold, underline, and links."
                />
              </div>
              <div className="plan-field">
                <label htmlFor="cm-takeaways">
                  <strong>Takeaways</strong>
                </label>
                <RichTextField
                  id="cm-takeaways"
                  rows={3}
                  value={form.takeaways}
                  onChange={(takeaways) => set({ takeaways })}
                  hint="One per line, optional."
                />
              </div>
            </>
          ) : null}
          {workFields ? (
            <>
              <div className="plan-field">
                <label htmlFor="cm-due">
                  <strong>Due</strong>
                </label>
                <input
                  id="cm-due"
                  type="text"
                  className="select-line"
                  placeholder="Fri 3 Oct"
                  value={form.due}
                  onChange={(event) => set({ due: event.target.value })}
                />
              </div>
              <div className="plan-field">
                <label htmlFor="cm-brief">
                  <strong>Brief</strong>
                </label>
                <RichTextField id="cm-brief" rows={4} value={form.brief} onChange={(brief) => set({ brief })} />
              </div>
            </>
          ) : null}
          {surveyFields ? (
            <div className="plan-field">
              <label htmlFor="cm-survey">
                <strong>Custom survey</strong>
              </label>
              <select
                id="cm-survey"
                className="select-line"
                value={form.surveyId}
                onChange={(event) => {
                  const picked = surveys.find((item) => item.id === event.target.value);
                  set({
                    surveyId: event.target.value,
                    title: form.title.trim() || picked?.title || "",
                    blurb: form.blurb.trim() || picked?.description || "",
                    brief: picked?.slug || "",
                  });
                }}
              >
                <option value="">Select a survey…</option>
                {surveys.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.title}
                  </option>
                ))}
              </select>
              <p className="muted small">Build the form under Custom surveys, then choose which lesson it should follow.</p>
            </div>
          ) : null}
          {!teachingFields && !workFields ? (
            <div className="plan-field">
              <label htmlFor="cm-blurb-alt">
                <strong>Lead line</strong>
              </label>
              <RichTextField id="cm-blurb-alt" rows={3} value={form.blurb} onChange={(blurb) => set({ blurb })} />
            </div>
          ) : null}
          <div className="plan-field">
            <label htmlFor="cm-pdf">
              <strong>PDF</strong>
            </label>
            <input
              id="cm-pdf"
              type="url"
              className="select-line"
              placeholder="https://… (PDF URL, optional)"
              value={form.pdfUrl}
              onChange={(event) => set({ pdfUrl: event.target.value })}
            />
            <input
              className="select-line"
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                void pickPdf(event.target.files && event.target.files[0]);
                event.target.value = "";
              }}
            />
            <p className="muted small">Paste a public PDF URL or upload a file. Students can read and download it on the lesson.</p>
          </div>
          <div className="plan-field">
            <label htmlFor="cm-resource">
              <strong>Link to another URL</strong>
            </label>
            <input
              id="cm-resource"
              type="url"
              className="select-line"
              placeholder="https://…"
              value={form.resourceUrl}
              onChange={(event) => set({ resourceUrl: event.target.value })}
            />
            <input
              className="select-line"
              type="text"
              placeholder="Button label (optional)"
              value={form.resourceLabel}
              onChange={(event) => set({ resourceLabel: event.target.value })}
            />
            <p className="muted small">Shows as a button on the lesson. Use this for another page, form, or external resource.</p>
          </div>
          <div className="plan-field">
            <label htmlFor="cm-tool">
              <strong>Practice tool</strong>
            </label>
            <select id="cm-tool" className="select-line" value={form.tool} onChange={(event) => set({ tool: event.target.value })}>
              <option value="">None</option>
              {lessonToolOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="muted small">
              Shows an interactive tool under the lesson text. Use a Reading lesson for it: your text and video come first, then the tool.
              Finishing the tool marks the lesson complete.
            </p>
          </div>
          <div className="plan-field">
            <label htmlFor="cm-banner">
              <strong>Header banner image</strong>
            </label>
            <input
              id="cm-banner"
              type="url"
              className="select-line"
              placeholder="https://… (optional)"
              value={form.bannerUrl}
              onChange={(event) => set({ bannerUrl: event.target.value })}
            />
            <input
              className="select-line"
              type="file"
              accept="image/*"
              onChange={(event) => {
                void pickBanner(event.target.files && event.target.files[0]);
                event.target.value = "";
              }}
            />
            <p className="muted small">Paste a public URL or upload an image. Leave empty for no banner.</p>
            {form.bannerUrl.trim() ? (
              <img className="lesson-banner-preview" src={form.bannerUrl.trim()} alt="" />
            ) : null}
          </div>
          <div className="plan-field">
            <label className="drip-active">
              <input
                type="checkbox"
                checked={form.isDraft}
                onChange={(event) => set({ isDraft: event.target.checked })}
              />
              <strong>Save as draft</strong>
            </label>
            <p className="muted small">
              Drafts sit in the course for you in Coach View. Students cannot see them until you uncheck this and save.
            </p>
          </div>
          <div className="plan-field drip-lesson-option">
            <label className="drip-active">
              <input
                type="checkbox"
                checked={dripEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setDripEnabled(enabled);
                  if (!enabled) return;
                  setDrip({
                    trigger: "lesson_completed",
                    title: dripForm.title.trim() || (form.title.trim() ? `After you complete ${form.title.trim()}` : ""),
                  });
                }}
              />
              <strong>Add a drip-feed message when students complete this lesson</strong>
            </label>
            {dripEnabled ? (
              <DripMessageFields
                form={dripForm}
                onChange={setDrip}
                lockCategory="progress"
              />
            ) : null}
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                if (editingId) void saveEdit();
                else void addLesson();
              }}
              disabled={busy}
            >
              {busy ? "Saving…" : editingId ? "Save lesson" : "Add lesson"}
            </button>
            {editingId ? (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...BLANK, chapter: form.chapter, type: form.type });
                  resetDrip();
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
      </CoachToolPanel>

      <CoachToolPanel
        title="Import CSV"
        description={`Header row required. Columns: ${CSV_COLUMNS.join(", ")}. Use a pipe (|) to separate paragraphs and takeaways inside one cell.`}
        open={Boolean(openTools.csv)}
        onToggle={() => toggleTool("csv")}
      >
          <label className="dropzone" htmlFor="cm-csv-file">
            <strong>Choose a CSV file</strong>
            <span className="muted small">or paste the rows below</span>
            <input
              id="cm-csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => readFile(event.target.files && event.target.files[0])}
            />
          </label>
          <textarea
            rows={8}
            placeholder={CSV_TEMPLATE}
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setPreview(null);
            }}
          />
          <div className="actions">
            <button className="ghost" onClick={() => setPreview(csvToDrafts(data, csv))} disabled={!csv.trim()}>
              Preview
            </button>
            <button className="primary" onClick={importCsv} disabled={busy || !csv.trim()}>
              Import lessons
            </button>
          </div>
          {preview ? (
            <>
              {preview.errors.length ? (
                <div className="waiting">
                  {preview.errors.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              ) : null}
              {preview.drafts.length ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>New id</th>
                      <th>Chapter</th>
                      <th>Type</th>
                      <th>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.drafts.map((d) => (
                      <tr key={d.lesson.id}>
                        <td className="muted small">{d.lesson.id}</td>
                        <td className="muted small">{d.chapterId}</td>
                        <td className="muted small">{d.lesson.type}</td>
                        <td>
                          <strong>{d.lesson.title}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="empty">No valid rows in that CSV.</p>
              )}
            </>
          ) : null}
      </CoachToolPanel>

      <CoachToolPanel
        title="Course content"
        description="Duplicate a lesson to clone its video, reading, survey, and banner. Drag to reorder, or move it to another chapter."
        open={Boolean(openTools.outline)}
        onToggle={() => toggleTool("outline")}
      >
        {board.length ? (
          <CourseOutlineBoard
            chapters={board}
            busy={busy}
            onDuplicate={(id) => void duplicate(id)}
            onRemove={removeLesson}
            onEdit={startEdit}
            onMove={(lessonId, fromChapterId, toChapterId, toIndex) =>
              void moveLesson(lessonId, fromChapterId, toChapterId, toIndex)
            }
            onReorder={(chapterId, lessonIds) => void reorder(chapterId, lessonIds)}
          />
        ) : (
          <p className="empty">Load lessons from Supabase to duplicate, drag, and edit the live course outline.</p>
        )}
      </CoachToolPanel>
    </>
  );
}
