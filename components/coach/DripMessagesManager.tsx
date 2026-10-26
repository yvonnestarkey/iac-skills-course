"use client";

import { useEffect, useMemo, useState } from "react";
import RichTextField from "@/components/ui/RichTextField";
import { COURSE_COHORTS } from "@/lib/cohorts";
import { fetchChapterLessons, fetchCourseChapters, type ChapterLessonOption, type CourseChapterOption } from "@/lib/custom-surveys";
import {
  dripScopeLabel,
  dripTriggerLabel,
  dripWriteFromMessage,
  emptyDripWrite,
  isTaskChapterOption,
  type DripMessage,
  type DripTrigger,
  type DripWrite,
} from "@/lib/drip-messages";

const TRIGGER_OPTIONS: { id: DripTrigger; label: string }[] = [
  { id: "enrolment_delay", label: "After the student joins / enrols" },
  { id: "fixed_date", label: "On a specific date" },
  { id: "lesson_completed", label: "The day they complete a lesson" },
  { id: "task_completed", label: "The day they complete a task" },
];

function delayParts(days: number | null | undefined): { amount: number; unit: "days" | "weeks" } {
  const value = Math.max(0, Number(days) || 0);
  if (value > 0 && value % 7 === 0) return { amount: value / 7, unit: "weeks" };
  return { amount: value, unit: "days" };
}

export default function DripMessagesManager() {
  const [messages, setMessages] = useState<DripMessage[]>([]);
  const [form, setForm] = useState<DripWrite>(emptyDripWrite());
  const [delayAmount, setDelayAmount] = useState(2);
  const [delayUnit, setDelayUnit] = useState<"days" | "weeks">("weeks");
  const [chapters, setChapters] = useState<CourseChapterOption[]>([]);
  const [lessons, setLessons] = useState<ChapterLessonOption[]>([]);
  const [lessonChapterId, setLessonChapterId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const taskChapters = useMemo(() => chapters.filter((chapter) => isTaskChapterOption(chapter.title)), [chapters]);
  const lessonLabels = useMemo(() => {
    const map = new Map<string, string>();
    lessons.forEach((lesson) => map.set(lesson.id, lesson.title));
    messages.forEach((message) => {
      if (message.lessonId && !map.has(message.lessonId)) map.set(message.lessonId, message.lessonId);
    });
    return map;
  }, [lessons, messages]);
  const taskLabels = useMemo(() => {
    const map = new Map<string, string>();
    chapters.forEach((chapter) => map.set(chapter.id, chapter.title));
    return map;
  }, [chapters]);

  const load = async () => {
    const response = await fetch("/api/coach/drips");
    const payload = (await response.json().catch(() => ({}))) as { data?: DripMessage[]; error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not load drip messages.");
      setReady(true);
      return;
    }
    setMessages(payload.data || []);
    setError("");
    setReady(true);
  };

  useEffect(() => {
    void load();
    void fetchCourseChapters().then((result) => {
      if (!result.ok) return;
      setChapters(result.data);
    });
  }, []);

  const loadLessons = async (chapterId: string) => {
    setLessonChapterId(chapterId);
    if (!chapterId) {
      setLessons([]);
      return;
    }
    const result = await fetchChapterLessons(chapterId);
    setLessons(result.data);
  };

  const set = (next: Partial<DripWrite>) => setForm((current) => ({ ...current, ...next }));

  const startCreate = () => {
    setForm(emptyDripWrite());
    setDelayAmount(2);
    setDelayUnit("weeks");
    setLessonChapterId("");
    setLessons([]);
    setNotice("");
  };

  const startEdit = async (message: DripMessage) => {
    const next = dripWriteFromMessage(message);
    setForm(next);
    const parts = delayParts(next.delayDays);
    setDelayAmount(parts.amount);
    setDelayUnit(parts.unit);
    setNotice(`Editing “${message.title}”.`);
    if (message.trigger === "lesson_completed" && message.lessonId) {
      const listed = await fetchCourseChapters();
      if (listed.ok) {
        setChapters(listed.data);
        for (const chapter of listed.data) {
          const chapterLessons = await fetchChapterLessons(chapter.id);
          if (chapterLessons.data.some((lesson) => lesson.id === message.lessonId)) {
            setLessonChapterId(chapter.id);
            setLessons(chapterLessons.data);
            break;
          }
        }
      }
    }
  };

  const save = async () => {
    setBusy(true);
    setNotice("");
    const delayDays = delayUnit === "weeks" ? delayAmount * 7 : delayAmount;
    const response = await fetch("/api/coach/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        message: {
          ...form,
          delayDays: form.trigger === "enrolment_delay" ? delayDays : form.delayDays,
        },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setNotice(payload.error || "Could not save that drip message.");
      return;
    }
    setNotice(form.id ? "Drip message updated." : "Drip message saved. It will send when the trigger is due.");
    startCreate();
    await load();
  };

  const toggle = async (message: DripMessage) => {
    const response = await fetch("/api/coach/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id: message.id, isActive: !message.isActive }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setNotice(payload.error || "Could not update that drip message.");
      return;
    }
    await load();
  };

  const remove = async (message: DripMessage) => {
    if (!window.confirm(`Delete “${message.title}”? Students who already received it keep their copy.`)) return;
    const response = await fetch("/api/coach/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: message.id }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setNotice(payload.error || "Could not delete that drip message.");
      return;
    }
    if (form.id === message.id) startCreate();
    await load();
  };

  const deliverDue = async () => {
    setBusy(true);
    const response = await fetch("/api/coach/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deliver" }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; inserted?: number };
    setBusy(false);
    if (!response.ok) {
      setNotice(payload.error || "Could not deliver due drip messages.");
      return;
    }
    setNotice(
      payload.inserted
        ? `Delivered ${payload.inserted} due message${payload.inserted === 1 ? "" : "s"}.`
        : "No due drip messages to deliver right now."
    );
    await load();
  };

  const editing = Boolean(form.id);

  return (
    <div className="coach-drip-page">
      <p className="kicker">Coach tools</p>
      <h1>Drip-feed messages</h1>
      <p className="muted">
        Automate student notifications after they join, on a calendar date, or the day they complete a lesson or task.
        Static messages stay on for the next cohort. Cohort-specific ones only go to that sitting.
      </p>

      {error ? <div className="waiting">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <section className="card">
        <h2>{editing ? "Edit drip message" : "Add a drip message"}</h2>
        <div className="plan-field">
          <label htmlFor="drip-title">
            <strong>Title</strong>
          </label>
          <input
            id="drip-title"
            className="select-line"
            type="text"
            value={form.title}
            onChange={(event) => set({ title: event.target.value })}
            placeholder="Two weeks in — how is Task 1 going?"
          />
        </div>
        <div className="plan-field">
          <label htmlFor="drip-body">
            <strong>Message</strong>
          </label>
          <RichTextField
            id="drip-body"
            rows={6}
            value={form.body}
            onChange={(body) => set({ body })}
            placeholder="This lands in the student's notifications inbox, and they get an email too."
          />
        </div>
        <div className="plan-field">
          <label htmlFor="drip-trigger">
            <strong>When should it send?</strong>
          </label>
          <select
            id="drip-trigger"
            className="select-line"
            value={form.trigger}
            onChange={(event) => set({ trigger: event.target.value as DripTrigger })}
          >
            {TRIGGER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {form.trigger === "enrolment_delay" ? (
          <div className="hours-row">
            <div className="plan-field">
              <label htmlFor="drip-delay">
                <strong>Send after</strong>
              </label>
              <input
                id="drip-delay"
                className="select-line"
                type="number"
                min={0}
                value={delayAmount}
                onChange={(event) => setDelayAmount(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            <div className="plan-field">
              <label htmlFor="drip-delay-unit">
                <strong>Unit</strong>
              </label>
              <select
                id="drip-delay-unit"
                className="select-line"
                value={delayUnit}
                onChange={(event) => setDelayUnit(event.target.value === "weeks" ? "weeks" : "days")}
              >
                <option value="days">Days after enrolment</option>
                <option value="weeks">Weeks after enrolment</option>
              </select>
            </div>
            <p className="muted small" style={{ alignSelf: "end" }}>
              Use 0 for the day they join.
            </p>
          </div>
        ) : null}

        {form.trigger === "fixed_date" ? (
          <div className="plan-field">
            <label htmlFor="drip-date">
              <strong>Send on (SAST)</strong>
            </label>
            <input
              id="drip-date"
              type="date"
              value={form.sendOn || ""}
              onChange={(event) => set({ sendOn: event.target.value })}
            />
          </div>
        ) : null}

        {form.trigger === "lesson_completed" ? (
          <div className="hours-row">
            <div className="plan-field">
              <label htmlFor="drip-lesson-chapter">
                <strong>Chapter</strong>
              </label>
              <select
                id="drip-lesson-chapter"
                className="select-line"
                value={lessonChapterId}
                onChange={(event) => {
                  set({ lessonId: "" });
                  void loadLessons(event.target.value);
                }}
              >
                <option value="">Choose a chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="plan-field">
              <label htmlFor="drip-lesson">
                <strong>Lesson</strong>
              </label>
              <select
                id="drip-lesson"
                className="select-line"
                value={form.lessonId || ""}
                onChange={(event) => set({ lessonId: event.target.value })}
                disabled={!lessonChapterId}
              >
                <option value="">{lessonChapterId ? "Choose a lesson" : "Choose a chapter first"}</option>
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {form.trigger === "task_completed" ? (
          <div className="plan-field">
            <label htmlFor="drip-task">
              <strong>Task</strong>
            </label>
            <select
              id="drip-task"
              className="select-line"
              value={form.taskId || ""}
              onChange={(event) => set({ taskId: event.target.value })}
            >
              <option value="">Choose a task</option>
              {taskChapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
            <p className="muted small">Sends the day they mark every lesson in that task complete.</p>
          </div>
        ) : null}

        <div className="hours-row">
          <div className="plan-field">
            <label htmlFor="drip-scope">
              <strong>Who receives it</strong>
            </label>
            <select
              id="drip-scope"
              className="select-line"
              value={form.scope}
              onChange={(event) => set({ scope: event.target.value === "cohort" ? "cohort" : "static" })}
            >
              <option value="static">All current and future cohorts (static)</option>
              <option value="cohort">One cohort only</option>
            </select>
          </div>
          {form.scope === "cohort" ? (
            <div className="plan-field">
              <label htmlFor="drip-cohort">
                <strong>Cohort</strong>
              </label>
              <select
                id="drip-cohort"
                className="select-line"
                value={form.cohortId || ""}
                onChange={(event) => set({ cohortId: event.target.value })}
              >
                {COURSE_COHORTS.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <label className="muted small" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={form.isActive !== false}
            onChange={(event) => set({ isActive: event.target.checked })}
          />
          Active — send this automatically when the trigger is due
        </label>

        <div className="actions" style={{ marginTop: 16 }}>
          <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : editing ? "Save changes" : "Save drip message"}
          </button>
          {editing ? (
            <button className="ghost" type="button" disabled={busy} onClick={startCreate}>
              Cancel
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="work-head">
          <h2>Saved drip messages</h2>
          <button className="ghost" type="button" disabled={busy} onClick={() => void deliverDue()}>
            Deliver due messages now
          </button>
        </div>
        {!ready ? <p className="empty">Loading drip messages…</p> : null}
        {ready && !messages.length && !error ? (
          <p className="empty">No drip messages yet. Add one above and it will keep running for future students.</p>
        ) : null}
        {messages.length ? (
          <div className="work-list">
            {messages.map((message) => (
              <article className="work-item" key={message.id}>
                <div className="work-head">
                  <strong>{message.title}</strong>
                  <span className={`badge ${message.isActive ? "ok" : ""}`}>{message.isActive ? "Active" : "Paused"}</span>
                </div>
                <p className="muted small">
                  {dripTriggerLabel(message, {
                    lessonTitle: message.lessonId ? lessonLabels.get(message.lessonId) : undefined,
                    taskTitle: message.taskId ? taskLabels.get(message.taskId) : undefined,
                  })}
                  {" · "}
                  {dripScopeLabel(message)}
                  {" · "}
                  {message.deliveryCount} sent
                </p>
                <div className="actions">
                  <button className="ghost" type="button" onClick={() => void startEdit(message)}>
                    Edit
                  </button>
                  <button className="ghost" type="button" onClick={() => void toggle(message)}>
                    {message.isActive ? "Pause" : "Activate"}
                  </button>
                  <button className="ghost" type="button" onClick={() => void remove(message)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
