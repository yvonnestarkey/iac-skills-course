"use client";

import { useRef, useState, type DragEvent } from "react";
import { GripVertical } from "lucide-react";
import type { ManagedChapter, ManagedLesson } from "@/lib/content";

function moveId(ids: string[], fromId: string, toIndex: number): string[] {
  const next = ids.filter((id) => id !== fromId);
  const index = Math.max(0, Math.min(toIndex, next.length));
  next.splice(index, 0, fromId);
  return next;
}

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
  const dragRef = useRef<{ lessonId: string; chapterId: string } | null>(null);
  const [dragging, setDragging] = useState<{ lessonId: string; chapterId: string } | null>(null);
  const [over, setOver] = useState<{ chapterId: string; index: number } | null>(null);
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  const isOpen = (chapterId: string) => openChapters[chapterId] === true;

  const toggleChapter = (chapterId: string) => {
    setOpenChapters((current) => ({ ...current, [chapterId]: !current[chapterId] }));
  };

  const setAllChapters = (open: boolean) => {
    setOpenChapters(Object.fromEntries(chapters.map((chapter) => [chapter.id, open])));
  };

  const readDrag = (event?: DragEvent): { lessonId: string; chapterId: string } | null => {
    const raw = event?.dataTransfer.getData("text/plain") || "";
    const [chapterId, lessonId] = raw.split("\t");
    if (chapterId && lessonId) return { chapterId, lessonId };
    return dragRef.current;
  };

  const startDrag = (event: DragEvent, lesson: ManagedLesson, chapterId: string) => {
    event.dataTransfer.setData("text/plain", `${chapterId}\t${lesson.id}`);
    event.dataTransfer.effectAllowed = "move";
    const source = { lessonId: lesson.id, chapterId };
    dragRef.current = source;
    setDragging(source);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
    setOver(null);
  };

  const dropAt = (event: DragEvent, chapterId: string, toIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    const source = readDrag(event);
    if (!source) return;
    if (source.chapterId === chapterId) {
      const ids = (chapters.find((chapter) => chapter.id === chapterId)?.lessons || []).map((lesson) => lesson.id);
      const from = ids.indexOf(source.lessonId);
      if (from < 0 || from === toIndex || from + 1 === toIndex) {
        endDrag();
        return;
      }
      onReorder(chapterId, moveId(ids, source.lessonId, from < toIndex ? toIndex - 1 : toIndex));
    } else {
      onMove(source.lessonId, source.chapterId, chapterId, toIndex);
    }
    endDrag();
  };

  const shiftLesson = (chapter: ManagedChapter, index: number, direction: -1 | 1) => {
    const ids = chapter.lessons.map((lesson) => lesson.id);
    const next = index + direction;
    if (next < 0 || next >= ids.length) return;
    const swap = ids[index];
    ids[index] = ids[next];
    ids[next] = swap;
    onReorder(chapter.id, ids);
  };

  return (
    <div className="course-outline-board">
      <p className="muted small">Chapters start closed. Click a chapter to see its lessons, then use Up or Down to move them.</p>
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
              if (!open) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              if (!open) return;
              dropAt(event, chapter.id, chapter.lessons.length);
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
                      className={`course-outline-item${dragging?.lessonId === lesson.id ? " dragging" : ""}${
                        over?.chapterId === chapter.id && over.index === index ? " drop-target" : ""
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        setOver({ chapterId: chapter.id, index });
                      }}
                      onDrop={(event) => dropAt(event, chapter.id, index)}
                    >
                      <span
                        className="course-outline-handle"
                        aria-hidden="true"
                        draggable
                        onDragStart={(event) => startDrag(event, lesson, chapter.id)}
                        onDragEnd={endDrag}
                      >
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
                      <div className="course-outline-actions" onMouseDown={(event) => event.stopPropagation()}>
                        <button
                          className="primary"
                          type="button"
                          disabled={busy || index === 0}
                          onClick={() => shiftLesson(chapter, index, -1)}
                        >
                          Up
                        </button>
                        <button
                          className="primary"
                          type="button"
                          disabled={busy || index === chapter.lessons.length - 1}
                          onClick={() => shiftLesson(chapter, index, 1)}
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
