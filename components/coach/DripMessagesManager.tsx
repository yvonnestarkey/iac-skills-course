"use client";

import { useEffect, useMemo, useState } from "react";
import DripMessageFields, { loadChapterLessonsForDrip } from "@/components/coach/DripMessageFields";
import { fetchCourseChapters, type ChapterLessonOption, type CourseChapterOption } from "@/lib/custom-surveys";
import {
  DRIP_CATEGORIES,
  dripCategory,
  dripCategoryLabel,
  dripScopeLabel,
  dripTriggerLabel,
  dripWriteFromMessage,
  emptyDripWrite,
  type DripCategory,
  type DripMessage,
  type DripWrite,
} from "@/lib/drip-messages";

export default function DripMessagesManager() {
  const [messages, setMessages] = useState<DripMessage[]>([]);
  const [form, setForm] = useState<DripWrite>(emptyDripWrite());
  const [chapters, setChapters] = useState<CourseChapterOption[]>([]);
  const [lessons, setLessons] = useState<ChapterLessonOption[]>([]);
  const [lessonChapterId, setLessonChapterId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

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
  const grouped = useMemo(() => {
    const buckets: Record<DripCategory, DripMessage[]> = { enrolment: [], date: [], progress: [] };
    messages.forEach((message) => buckets[dripCategory(message.trigger)].push(message));
    return buckets;
  }, [messages]);

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
      if (result.ok) setChapters(result.data);
    });
  }, []);

  const loadLessons = async (chapterId: string) => {
    setLessonChapterId(chapterId);
    setLessons(await loadChapterLessonsForDrip(chapterId));
  };

  const set = (next: Partial<DripWrite>) => setForm((current) => ({ ...current, ...next }));

  const startCreate = () => {
    setForm(emptyDripWrite());
    setLessonChapterId("");
    setLessons([]);
    setNotice("");
  };

  const startEdit = async (message: DripMessage) => {
    setForm(dripWriteFromMessage(message));
    setNotice(`Editing “${message.title}”.`);
    if (message.trigger === "lesson_completed" && message.lessonId) {
      const listed = await fetchCourseChapters();
      if (listed.ok) {
        setChapters(listed.data);
        for (const chapter of listed.data) {
          const chapterLessons = await loadChapterLessonsForDrip(chapter.id);
          if (chapterLessons.some((lesson) => lesson.id === message.lessonId)) {
            setLessonChapterId(chapter.id);
            setLessons(chapterLessons);
            break;
          }
        }
      }
    }
  };

  const save = async () => {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/coach/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", message: form }),
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
        Enrolment, a specific date, or course progress. Current-cohort messages stay on this sitting; current and future
        ones keep running for the next cohort as well.
      </p>

      {error ? <div className="waiting">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <section className="card">
        <h2>{editing ? "Edit drip message" : "Add a drip message"}</h2>
        <DripMessageFields
          form={form}
          onChange={set}
          chapters={chapters}
          lessons={lessons}
          lessonChapterId={lessonChapterId}
          onLessons={(chapterId) => void loadLessons(chapterId)}
        />
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
        {DRIP_CATEGORIES.map((category) => {
          const rows = grouped[category];
          if (!rows.length) return null;
          return (
            <div className="drip-group" key={category}>
              <h3>{dripCategoryLabel(category)}</h3>
              <div className="work-list">
                {rows.map((message) => (
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
            </div>
          );
        })}
      </section>
    </div>
  );
}
