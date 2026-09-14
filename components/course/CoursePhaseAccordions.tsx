"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { ICONS } from "@/lib/constants";
import {
  chapterProgress,
  findLessonLocation,
  findResumeLesson,
  isChapterUnlocked,
  isPhaseUnlocked,
  phaseUnitProgress,
  splitCoursePhases,
  type CoursePhaseId,
} from "@/lib/course-phases";
import type { OutlineChapter } from "@/lib/student-lesson";

export default function CoursePhaseAccordions({
  chapters,
  completed,
  activeLessonId,
  basePath,
  onNavigate,
  variant = "nav",
}: {
  chapters: OutlineChapter[];
  completed: Record<string, boolean>;
  activeLessonId?: string | null;
  basePath: "/student" | "/learn";
  onNavigate?: () => void;
  variant?: "nav" | "hub";
}) {
  const phases = useMemo(() => splitCoursePhases(chapters), [chapters]);
  const ordered = useMemo(() => phases.flatMap((phase) => phase.chapters), [phases]);
  const resume = findResumeLesson(ordered, completed);
  const active = findLessonLocation(ordered, activeLessonId);
  const focusChapterId = active?.chapter.id || resume?.chapter.id || "";
  const focusPhaseId = useMemo(() => {
    const phase = phases.find((item) => item.chapters.some((chapter) => chapter.id === focusChapterId));
    return phase?.id || phases[0]?.id || "";
  }, [phases, focusChapterId]);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (focusPhaseId && isPhaseUnlocked(phases, focusPhaseId as CoursePhaseId, completed)) {
      setOpenPhases((current) => (current[focusPhaseId] ? current : { ...current, [focusPhaseId]: true }));
    }
    if (focusChapterId && isChapterUnlocked(ordered, focusChapterId, completed)) {
      setOpenChapters((current) => (current[focusChapterId] ? current : { ...current, [focusChapterId]: true }));
    }
  }, [focusPhaseId, focusChapterId, phases, ordered, completed]);

  const togglePhase = (id: CoursePhaseId, locked: boolean) => {
    if (locked) return;
    setOpenPhases((current) => ({ ...current, [id]: !current[id] }));
  };

  const toggleChapter = (id: string, locked: boolean) => {
    if (locked) return;
    setOpenChapters((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <div className={`course-phases course-phases-${variant}`}>
      {phases.map((phase) => {
        const progress = phaseUnitProgress(phase, completed);
        const phaseLocked = !isPhaseUnlocked(phases, phase.id, completed);
        const phaseOpen = !phaseLocked && Boolean(openPhases[phase.id]);
        return (
          <section
            key={phase.id}
            className={`course-phase course-phase-${phase.id} ${phaseOpen ? "open" : "collapsed"} ${
              phaseLocked ? "locked" : ""
            }`}
          >
            <button
              className="phase-toggle"
              type="button"
              aria-expanded={phaseOpen}
              aria-disabled={phaseLocked}
              onClick={() => togglePhase(phase.id, phaseLocked)}
            >
              <span>
                <h2>{phase.title}</h2>
                <span className="phase-badge">
                  {progress.done} of {progress.total} {phase.unit} Completed
                </span>
              </span>
              {phaseLocked ? <Lock size={16} aria-label="Locked" /> : <span className="chapter-caret">{phaseOpen ? "▾" : "▸"}</span>}
            </button>
            {phaseOpen
              ? phase.chapters.map((chapter) => {
                  const stats = chapterProgress(chapter, completed);
                  const chapterLocked = !isChapterUnlocked(ordered, chapter.id, completed);
                  const chapterOpen = !chapterLocked && Boolean(openChapters[chapter.id]);
                  return (
                    <article
                      key={chapter.id}
                      className={`phase-chapter ${chapterOpen ? "open" : "collapsed"} ${chapterLocked ? "locked" : ""}`}
                    >
                      <button
                        className="chapter-toggle"
                        type="button"
                        aria-expanded={chapterOpen}
                        aria-disabled={chapterLocked}
                        onClick={() => toggleChapter(chapter.id, chapterLocked)}
                      >
                        <span>
                          <h3>{chapter.title}</h3>
                          <span className="muted small">
                            {stats.done} of {stats.total} complete
                          </span>
                          {variant === "hub" ? (
                            <span className="micro-bar" aria-hidden="true">
                              <span style={{ width: `${stats.pct}%` }} />
                            </span>
                          ) : null}
                        </span>
                        {chapterLocked ? (
                          <Lock size={15} aria-label="Locked" />
                        ) : (
                          <span className="chapter-caret">{chapterOpen ? "▾" : "▸"}</span>
                        )}
                      </button>
                      {chapterOpen ? (
                        <>
                          {chapter.summary ? <p className="chapter-summary">{chapter.summary}</p> : null}
                          {variant === "hub" ? (
                            <ul className="student-dash-lessons">
                              {chapter.lessons.map((lesson) => {
                                const isDone = Boolean(completed[lesson.id]);
                                return (
                                  <li key={lesson.id}>
                                    <Link href={`${basePath}/${lesson.id}`} onClick={onNavigate}>
                                      <span className="icon">{isDone ? "✓" : ICONS[lesson.type] || "•"}</span>
                                      <span>{lesson.title}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            chapter.lessons.map((lesson) => {
                              const active = lesson.id === activeLessonId;
                              const isDone = Boolean(completed[lesson.id]);
                              return (
                                <Link
                                  key={lesson.id}
                                  href={`${basePath}/${lesson.id}`}
                                  className={`lesson-link ${active ? "active" : ""} ${lesson.type} ${isDone ? "done" : ""}`}
                                  onClick={onNavigate}
                                >
                                  <span className="icon">{isDone ? "✓" : ICONS[lesson.type] || "•"}</span>
                                  <span className="label">
                                    <span className="lesson-title">{lesson.title}</span>
                                    <span className="lesson-meta">{isDone ? "Completed" : lesson.duration || lesson.type}</span>
                                  </span>
                                </Link>
                              );
                            })
                          )}
                        </>
                      ) : null}
                    </article>
                  );
                })
              : null}
          </section>
        );
      })}
    </div>
  );
}
