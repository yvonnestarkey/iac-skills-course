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
import CourseOutlineBoard from "@/components/coach/CourseOutlineBoard";

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
  afterLessonId: SURVEY_PLACE_END,
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
  const [alsoSave, setAlsoSave] = useState(true);
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [surveys, setSurveys] = useState<CustomSurvey[]>([]);
  const [board, setBoard] = useState<ManagedChapter[]>([]);
  const [boardReady, setBoardReady] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const addDrafts = (drafts: LessonDraft[], insertAt?: number) => {
    mutate((draft) => {
      drafts.forEach((d) => {
        const chapter = draft.chapters.find((c) => c.id === d.chapterId);
        if (chapter) insertLesson(chapter, d.lesson, insertAt);
      });
    });
  };

  const saveToDb = async (drafts: LessonDraft[], startPosition: number) => {
    if (!alsoSave || !supabaseConfigured) return "";
    const result = await pushLessons(drafts, startPosition);
    return result.ok ? "" : ` Supabase said: ${result.error}`;
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
    const lesson = buildLesson(nextLiveLessonId(chapter.id, existingIds), form);
    const siblingIds = chapter.lessons.map((item) => item.id);
    const insertAt = insertIndexAfterLesson(siblingIds, form.afterLessonId);
    const orderedIds = [...siblingIds];
    orderedIds.splice(insertAt, 0, lesson.id);
    setBusy(true);
    addDrafts([{ chapterId: chapter.id, lesson }], insertAt);
    const problem = await saveToDb([{ chapterId: chapter.id, lesson }], insertAt + 1);
    const orderProblem = alsoSave && supabaseConfigured ? await saveChapterOrder(chapter.id, orderedIds) : { ok: true, error: "" };
    invalidateCourseOutline();
    await loadBoard();
    setBusy(false);
    setForm({ ...BLANK, chapter: chapter.id, type: form.type, afterLessonId: SURVEY_PLACE_END });
    setEditingId(null);
    setStatus({
      kind: problem || !orderProblem.ok ? "warn" : "ok",
      text: `“${lesson.title}” added to ${chapter.title} and it is live in the student sidebar.${problem}${
        orderProblem.ok ? "" : ` ${orderProblem.error || "Could not save the new lesson order."}`
      }`,
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
      text: `Imported ${parsed.drafts.length} lesson${parsed.drafts.length === 1 ? "" : "s"}.${
        parsed.errors.length ? ` ${parsed.errors.length} row(s) skipped.` : ""
      }${problem}`,
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
    if (supabaseConfigured) await deleteLesson(lessonId);
    invalidateCourseOutline();
    await loadBoard();
    setStatus({ kind: "ok", text: `Removed ${lessonId}.` });
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
      afterLessonId: SURVEY_PLACE_END,
    });
    setStatus({ kind: "ok", text: `Editing “${lesson.title}”.` });
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
    });
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "warn", text: result.error || "Could not save that lesson." });
      return;
    }
    invalidateCourseOutline();
    await loadBoard();
    setEditingId(null);
    setForm({ ...BLANK, chapter: form.chapter, type: form.type });
    setStatus({ kind: "ok", text: "Lesson saved." });
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
      <section className="card">
        <div className="panel-head">
          <div>
            <h2>Admin Content Manager</h2>
            <p className="muted small">
              Add lessons by hand or import a CSV. Anything you add appears in the student sidebar straight away.
            </p>
          </div>
          <span className={`badge ${supabaseConfigured ? "ok" : "warn"}`}>
            {supabaseConfigured ? `Supabase · ${supabaseProjectRef}` : "Supabase not configured"}
          </span>
        </div>
        {status ? <div className={status.kind === "ok" ? "notice" : "waiting"}>{status.text}</div> : null}
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
          <label className="role-chip">
            <input
              type="checkbox"
              checked={alsoSave}
              onChange={(event) => setAlsoSave(event.target.checked)}
              disabled={!supabaseConfigured}
            />{" "}
            Also save to Supabase
          </label>
        </div>
      </section>

      <div className="profile-grid">
        <section className="card">
          <h2>{editingId ? "Edit lesson" : "Add a lesson"}</h2>
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
                <textarea
                  id="cm-blurb"
                  rows={2}
                  value={form.blurb}
                  onChange={(event) => set({ blurb: event.target.value })}
                />
              </div>
              <div className="plan-field">
                <label htmlFor="cm-body">
                  <strong>Body</strong>
                </label>
                <p className="muted small">One paragraph per line.</p>
                <textarea
                  id="cm-body"
                  rows={5}
                  value={form.body}
                  onChange={(event) => set({ body: event.target.value })}
                />
              </div>
              <div className="plan-field">
                <label htmlFor="cm-takeaways">
                  <strong>Takeaways</strong>
                </label>
                <p className="muted small">One per line, optional.</p>
                <textarea
                  id="cm-takeaways"
                  rows={3}
                  value={form.takeaways}
                  onChange={(event) => set({ takeaways: event.target.value })}
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
                <textarea
                  id="cm-brief"
                  rows={4}
                  value={form.brief}
                  onChange={(event) => set({ brief: event.target.value })}
                />
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
              <textarea
                id="cm-blurb-alt"
                rows={3}
                value={form.blurb}
                onChange={(event) => set({ blurb: event.target.value })}
              />
            </div>
          ) : null}
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
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </section>

        <section className="card">
          <h2>Import CSV</h2>
          <p className="muted small">
            Header row required. Columns: {CSV_COLUMNS.join(", ")}. Use a pipe (|) to separate paragraphs and
            takeaways inside one cell.
          </p>
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
        </section>
      </div>

      <section className="card">
        <div className="panel-head">
          <div>
            <h2>Course content</h2>
            <p className="muted small">
              Duplicate a lesson to clone its video, reading, survey, and banner. Drag to reorder, or move it to another
              chapter.
            </p>
          </div>
        </div>
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
      </section>
    </>
  );
}
