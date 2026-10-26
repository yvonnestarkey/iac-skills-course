"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import type { ManagedChapter, ManagedLesson } from "@/lib/content";

export default function CourseOutlineBoard({
  chapters,
  busy,
  onDuplicate,
  onRemove,
  onEdit,
  onMove,
  onReorder,
}: {
  chapters: ManagedChapter[];
  busy: boolean;
  onDuplicate: (lessonId: string) => void;
  onRemove: (chapterId: string, lessonId: string) => void;
  onEdit: (lesson: ManagedLesson) => void;
  onMove: (lessonId: string, fromChapterId: string, toChapterId: string, toIndex?: number) => void;
  onReorder: (chapterId: string, lessonIds: string[]) => void;
}) {
  const [dragging, setDragging] = useState<{ lessonId: string; chapterId: string } | null>(null);
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  const isOpen = (chapterId: string) => Boolean(openChapters[chapterId]);

  const toggleChapter = (chapterId: string) => {
    setOpenChapters((current) => ({ ...current, [chapterId]: !current[chapterId] }));
  };

  const setAllChapters = (open: boolean) => {
    setOpenChapters(Object.fromEntries(chapters.map((chapter) => [chapter.id, open])));
  };

  const dropOnLesson = (chapterId: string, targetId: string) => {
    if (!dragging || dragging.lessonId === targetId) return;
    if (dragging.chapterId === chapterId) {
      const ids = (chapters.find((chapter) => chapter.id === chapterId)?.lessons || []).map((lesson) => lesson.id);
      const from = ids.indexOf(dragging.lessonId);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(from, 1);
      ids.splice(to, 0, dragging.lessonId);
      onReorder(chapterId, ids);
    } else {
      const toIds = (chapters.find((chapter) => chapter.id === chapterId)?.lessons || []).map((lesson) => lesson.id);
      const toIndex = Math.max(0, toIds.indexOf(targetId));
      onMove(dragging.lessonId, dragging.chapterId, chapterId, toIndex);
    }
    setDragging(null);
  };

  return (
    <div className="course-outline-board">
      <div className="course-outline-toolbar">
        <button className="ghost" type="button" onClick={() => setAllChapters(true)}>
          Expand all
        </button>
        <button className="ghost" type="button" onClick={() => setAllChapters(false)}>
          Collapse all
        </button>
      </div>
      {chapters.map((chapter) => {
        const open = isOpen(chapter.id);
        const drafts = chapter.lessons.filter((lesson) => lesson.is_draft).length;
        return (
        <section
          className={`course-outline-chapter ${open ? "open" : "collapsed"}`}
          key={chapter.id}
          onDragOver={(event) => {
            event.preventDefault();
            if (!open) setOpenChapters((current) => ({ ...current, [chapter.id]: true }));
          }}
          onDrop={() => {
            if (!dragging || dragging.chapterId === chapter.id) return;
            onMove(dragging.lessonId, dragging.chapterId, chapter.id);
            setDragging(null);
          }}
        >
          <button
            className="chapter-toggle course-outline-toggle"
            type="button"
            aria-expanded={open}
            onClick={() => toggleChapter(chapter.id)}
          >
            <span>
              <h3>{chapter.title}</h3>
              <p className="muted small">
                {chapter.lessons.length} lesson{chapter.lessons.length === 1 ? "" : "s"}
                {drafts ? ` · ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}
              </p>
            </span>
            <span className="chapter-caret">{open ? "▾" : "▸"}</span>
          </button>
          {open ? (
          <ul className="course-outline-list">
            {chapter.lessons.length ? (
              chapter.lessons.map((lesson, index) => (
                <li
                  key={lesson.id}
                  className={`course-outline-item ${dragging?.lessonId === lesson.id ? "dragging" : ""}`}
                  draggable
                  onDragStart={() => setDragging({ lessonId: lesson.id, chapterId: chapter.id })}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dropOnLesson(chapter.id, lesson.id);
                  }}
                >
                  <span className="course-outline-handle" aria-hidden="true">
                    <GripVertical size={16} />
                  </span>
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
                    <button className="ghost" type="button" disabled={busy || index === 0} onClick={() => {
                      const ids = chapter.lessons.map((item) => item.id);
                      ids.splice(index, 1);
                      ids.splice(index - 1, 0, lesson.id);
                      onReorder(chapter.id, ids);
                    }}>
                      Up
                    </button>
                    <button
                      className="ghost"
                      type="button"
                      disabled={busy || index === chapter.lessons.length - 1}
                      onClick={() => {
                        const ids = chapter.lessons.map((item) => item.id);
                        ids.splice(index, 1);
                        ids.splice(index + 1, 0, lesson.id);
                        onReorder(chapter.id, ids);
                      }}
                    >
                      Down
                    </button>
                    <select
                      className="select-line"
                      aria-label={`Move ${lesson.title} to another chapter`}
                      value={chapter.id}
                      disabled={busy}
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
                    <button className="ghost" type="button" disabled={busy} onClick={() => onEdit(lesson)}>
                      Edit
                    </button>
                    <button className="ghost" type="button" disabled={busy} onClick={() => onDuplicate(lesson.id)}>
                      Duplicate
                    </button>
                    <button className="link-btn" type="button" disabled={busy} onClick={() => onRemove(chapter.id, lesson.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))
            ) : (
              <li className="empty">No lessons in this chapter yet. Drop a lesson here to move it in.</li>
            )}
          </ul>
          ) : null}
        </section>
        );
      })}
    </div>
  );
}
