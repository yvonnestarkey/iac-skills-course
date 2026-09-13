"use client";

import { useState } from "react";
import {
  CSV_COLUMNS,
  CSV_TEMPLATE,
  LESSON_TYPES,
  buildLesson,
  checkLessonsTable,
  csvToDrafts,
  deleteLesson,
  nextLessonId,
  pullLessons,
  pushLessons,
} from "@/lib/content";
import type { LessonDraft, ParseResult } from "@/lib/content";
import { supabaseConfigured, supabaseProjectRef } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import type { Chapter, CourseData, Lesson } from "@/lib/types";

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
};

/** New teaching work goes before the chapter's Ask the Coach and survey lessons. */
function insertLesson(chapter: Chapter, lesson: Lesson) {
  const existing = chapter.lessons.findIndex((l) => l.id === lesson.id);
  if (existing >= 0) {
    chapter.lessons[existing] = lesson;
    return;
  }
  const tail = chapter.lessons.findIndex((l) => l.type === "ask" || l.type === "survey");
  if (lesson.type === "ask" || lesson.type === "survey" || tail < 0) chapter.lessons.push(lesson);
  else chapter.lessons.splice(tail, 0, lesson);
}

function lessonInUse(data: CourseData, lessonId: string): boolean {
  return data.students.some(
    (s) =>
      (s.completed || []).includes(lessonId) ||
      Boolean((s.submissions || {})[lessonId]) ||
      Boolean((s.uploads || {})[lessonId]) ||
      Boolean((s.surveys || {})[lessonId])
  );
}

export default function ContentManager() {
  const { data, mutate } = useStore();
  const [form, setForm] = useState({ ...BLANK, chapter: data.chapters[0].id });
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [alsoSave, setAlsoSave] = useState(true);
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (next: Partial<typeof BLANK>) => setForm((current) => ({ ...current, ...next }));

  const addDrafts = (drafts: LessonDraft[]) => {
    mutate((draft) => {
      drafts.forEach((d) => {
        const chapter = draft.chapters.find((c) => c.id === d.chapterId);
        if (chapter) insertLesson(chapter, d.lesson);
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
    const chapter = data.chapters.find((c) => c.id === form.chapter) || data.chapters[0];
    const lesson = buildLesson(nextLessonId(data, chapter.id), form);
    setBusy(true);
    addDrafts([{ chapterId: chapter.id, lesson }]);
    const problem = await saveToDb([{ chapterId: chapter.id, lesson }], chapter.lessons.length);
    setBusy(false);
    setForm({ ...BLANK, chapter: chapter.id, type: form.type });
    setStatus({
      kind: problem ? "warn" : "ok",
      text: `“${lesson.title}” added to ${chapter.title} and it is live in the student sidebar.${problem}`,
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
    setStatus({ kind: "ok", text: `Loaded ${drafts.length} lesson(s) from Supabase into the course.` });
  };

  const removeLesson = async (chapterId: string, lessonId: string) => {
    mutate((draft) => {
      const chapter = draft.chapters.find((c) => c.id === chapterId);
      if (chapter) chapter.lessons = chapter.lessons.filter((l) => l.id !== lessonId);
    });
    if (supabaseConfigured) await deleteLesson(lessonId);
    setStatus({ kind: "ok", text: `Removed ${lessonId}.` });
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
          <h2>Add a lesson</h2>
          <div className="plan-field">
            <label htmlFor="cm-chapter">
              <strong>Chapter</strong>
            </label>
            <select
              id="cm-chapter"
              className="select-line"
              value={form.chapter}
              onChange={(event) => set({ chapter: event.target.value })}
            >
              {data.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
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
          <div className="actions">
            <button className="primary" onClick={addLesson} disabled={busy}>
              Add lesson
            </button>
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
              {data.chapters.reduce((sum, c) => sum + c.lessons.length, 0)} lessons across {data.chapters.length}{" "}
              chapters. Lessons with student work cannot be removed.
            </p>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Chapter</th>
              <th>Type</th>
              <th>Title</th>
              <th>Detail</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.chapters.flatMap((chapter) =>
              chapter.lessons.map((lesson) => {
                const used = lessonInUse(data, lesson.id);
                return (
                  <tr key={lesson.id}>
                    <td className="muted small">{lesson.id}</td>
                    <td className="muted small">{chapter.title.split(" · ")[0]}</td>
                    <td className="muted small">{lesson.type}</td>
                    <td>
                      <strong>{lesson.title}</strong>
                    </td>
                    <td className="muted small">{lesson.duration || lesson.due || "—"}</td>
                    <td>
                      {used ? (
                        <span className="muted small">in use</span>
                      ) : (
                        <button className="link-btn" onClick={() => removeLesson(chapter.id, lesson.id)}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
