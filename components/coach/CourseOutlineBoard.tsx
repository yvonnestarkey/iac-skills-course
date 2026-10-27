"use client";

import { useRef, useState } from "react";
import type { ManagedChapter, ManagedLesson } from "@/lib/content";

export default function CourseOutlineBoard({
  chapters,
  busy,
  orderMessage,
  onDuplicate,
  onRemove,
  onEdit,
  onMove,
  onReorder,
}: {
  chapters: ManagedChapter[];
  busy: boolean;
  orderMessage?: { kind: "ok" | "warn"; text: string } | null;
  onDuplicate: (lessonId: string) => void;
  onRemove: (chapterId: string, lessonId: string) => void;
  onEdit: (lesson: ManagedLesson) => void;
  onMove: (lessonId: string, fromChapterId: string, toChapterId: string, toIndex?: number) => void;
  onReorder: (chapterId: string, lessonIds: string[]) => void | Promise<void>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<string | null>(null);

  const setAllChapters = (open: boolean) => {
    listRef.current?.querySelectorAll("details.course-outline-chapter").forEach((node) => {
      (node as HTMLDetailsElement).open = open;
    });
  };

  const shiftLesson = async (chapter: ManagedChapter, index: number, direction: -1 | 1) => {
    const ids = chapter.lessons.map((lesson) => lesson.id);
    const next = index + direction;
    if (next < 0 || next >= ids.length) return;
    const swap = ids[index];
    ids[index] = ids[next];
    ids[next] = swap;
    setPending(chapter.id);
    try {
      await onReorder(chapter.id, ids);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="course-outline-board" ref={listRef}>
      <p className="muted small">
        Chapters start closed. Click a chapter name to see its lessons, then use Up or Down.
      </p>
      {orderMessage ? (
        <div className={orderMessage.kind === "ok" ? "notice" : "waiting"}>{orderMessage.text}</div>
      ) : null}
      <div className="course-outline-toolbar">
        <button className="ghost" type="button" onClick={() => setAllChapters(true)}>
          Expand all
        </button>
        <button className="ghost" type="button" onClick={() => setAllChapters(false)}>
          Collapse all
        </button>
      </div>
      {chapters.map((chapter) => {
        const drafts = chapter.lessons.filter((lesson) => lesson.is_draft).length;
        const saving = pending === chapter.id;
        return (
          <details className="course-outline-chapter" key={chapter.id}>
            <summary className="chapter-toggle course-outline-toggle">
              <span>
                <h3>{chapter.title}</h3>
                <p className="muted small">
                  {chapter.lessons.length} lesson{chapter.lessons.length === 1 ? "" : "s"}
                  {drafts ? ` · ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}
                </p>
              </span>
              <span className="chapter-caret">▸</span>
            </summary>
            <ul className="course-outline-list">
              {chapter.lessons.length ? (
                chapter.lessons.map((lesson, index) => (
                  <li key={lesson.id} className="course-outline-item">
                    <div className="course-outline-copy">
                      <strong>
                        {lesson.title}
                        {lesson.is_draft ? <span className="lesson-draft-word">draft</span> : null}
                      </strong>
                      <span className="muted small">
                        {lesson.type}
                        {lesson.duration ? ` · ${lesson.duration}` : ""}
                        {lesson.banner_image_url ? " · banner" : ""}
                        {lesson.tool ? " · practice tool" : ""}
                      </span>
                    </div>
                    <div className="course-outline-actions">
                      <button
                        className="primary"
                        type="button"
                        disabled={busy || saving || index === 0}
                        onClick={() => void shiftLesson(chapter, index, -1)}
                      >
                        Up
                      </button>
                      <button
                        className="primary"
                        type="button"
                        disabled={busy || saving || index === chapter.lessons.length - 1}
                        onClick={() => void shiftLesson(chapter, index, 1)}
                      >
                        Down
                      </button>
                      <select
                        className="select-line"
                        aria-label={`Move ${lesson.title} to another chapter`}
                        value={chapter.id}
                        disabled={busy || saving}
                        onChange={(event) => {
                          const nextChapter = event.target.value;
                          if (nextChapter === chapter.id) return;
                          onMove(lesson.id, chapter.id, nextChapter);
                        }}
                      >
                        {chapters.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <a className="ghost" href={`/student/${lesson.id}`}>
                        Open
                      </a>
                      <button className="ghost" type="button" disabled={busy || saving} onClick={() => onEdit(lesson)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" disabled={busy || saving} onClick={() => onDuplicate(lesson.id)}>
                        Duplicate
                      </button>
                      <button className="link-btn" type="button" disabled={busy || saving} onClick={() => onRemove(chapter.id, lesson.id)}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="empty">No lessons in this chapter yet.</li>
              )}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
