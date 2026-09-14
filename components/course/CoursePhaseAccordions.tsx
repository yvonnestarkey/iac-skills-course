"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { ICONS } from "@/lib/constants";
import { catalogFromOutline, checkLessonAccess } from "@/lib/accessControl";
import type { StudentSubmission } from "@/lib/student-submissions";
import {
  chapterProgress,
  findLessonLocation,
  isChapterUnlocked,
  isPhaseUnlocked,
  phaseUnitProgress,
  splitCoursePhases,
  type CoursePhaseId,
} from "@/lib/course-phases";
import { durationBadge } from "@/lib/lesson-duration";
import type { OutlineChapter, OutlineLesson } from "@/lib/student-lesson";

function LessonEntry({
  lesson,
  locked,
  active,
  done,
  href,
  variant,
  onNavigate,
}: {
  lesson: OutlineLesson;
  locked: boolean;
  active: boolean;
  done: boolean;
  href: string;
  variant: "nav" | "hub";
  onNavigate?: () => void;
}) {
  const badge = durationBadge(lesson);
  const icon = done && !locked ? "✓" : ICONS[lesson.type] || "•";
  const title = (
    <span className="lesson-title">
      {locked ? <Lock size={12} className="lesson-lock" aria-label="Locked" /> : null}
      {lesson.title}
      <span className="duration-badge">{badge}</span>
    </span>
  );
  const body =
    variant === "hub" ? (
      <>
        <span className="icon">{icon}</span>
        {title}
      </>
    ) : (
      <>
        <span className="icon">{icon}</span>
        <span className="label">
          {title}
          {done && !locked ? <span className="lesson-meta">Completed</span> : null}
        </span>
      </>
    );

  if (locked) {
    return (
      <span className={`lesson-link lesson-preview locked ${lesson.type}`} aria-disabled="true">
        {body}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`lesson-link ${active ? "active" : ""} ${lesson.type} ${done ? "done" : ""}`}
      onClick={onNavigate}
    >
      {body}
    </Link>
  );
}

export default function CoursePhaseAccordions({
  chapters,
  completed,
  activeLessonId,
  basePath,
  onNavigate,
  variant = "nav",
  submissions = {},
  unlocked = false,
}: {
  chapters: OutlineChapter[];
  completed: Record<string, boolean>;
  activeLessonId?: string | null;
  basePath: "/student" | "/learn" | "/coach/preview";
  onNavigate?: () => void;
  variant?: "nav" | "hub";
  submissions?: Record<string, StudentSubmission | undefined>;
  unlocked?: boolean;
}) {
  const phases = useMemo(() => splitCoursePhases(chapters), [chapters]);
  const ordered = useMemo(() => phases.flatMap((phase) => phase.chapters), [phases]);
  const catalog = useMemo(() => catalogFromOutline(chapters), [chapters]);
  const active = findLessonLocation(ordered, activeLessonId);
  const focusChapterId = active?.chapter.id || "";
  const focusPhaseId = useMemo(() => {
    if (!focusChapterId) return "";
    const phase = phases.find((item) => item.chapters.some((chapter) => chapter.id === focusChapterId));
    return phase?.id || "";
  }, [phases, focusChapterId]);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeLessonId || !focusPhaseId) return;
    setOpenPhases((current) => (current[focusPhaseId] ? current : { ...current, [focusPhaseId]: true }));
    if (focusChapterId) {
      setOpenChapters((current) => (current[focusChapterId] ? current : { ...current, [focusChapterId]: true }));
    }
  }, [activeLessonId, focusPhaseId, focusChapterId]);

  const togglePhase = (id: CoursePhaseId) => {
    setOpenPhases((current) => ({ ...current, [id]: !current[id] }));
  };

  const toggleChapter = (id: string) => {
    setOpenChapters((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <div className={`course-phases course-phases-${variant}`}>
      {phases.map((phase) => {
        const progress = phaseUnitProgress(phase, completed);
        const phaseLocked = !unlocked && !isPhaseUnlocked(phases, phase.id, completed);
        const phaseOpen = Boolean(openPhases[phase.id]);
        return (
          <section
            key={phase.id}
            className={`course-phase course-phase-${phase.id} ${phaseOpen ? "open" : "collapsed"} ${
              phaseLocked ? "locked" : ""
            }`}
          >
            <button className="phase-toggle" type="button" aria-expanded={phaseOpen} onClick={() => togglePhase(phase.id)}>
              <span>
                <h2>
                  {phaseLocked ? <Lock size={14} className="phase-lock" aria-label="Locked" /> : null}
                  {phase.title}
                </h2>
                <span className="phase-badge">
                  {progress.done} of {progress.total} {phase.unit} Completed
                </span>
              </span>
              <span className="chapter-caret">{phaseOpen ? "▾" : "▸"}</span>
            </button>
            {phaseOpen
              ? phase.chapters.map((chapter) => {
                  const stats = chapterProgress(chapter, completed);
                  const chapterLocked = !unlocked && !isChapterUnlocked(ordered, chapter.id, completed);
                  const chapterOpen = Boolean(openChapters[chapter.id]);
                  return (
                    <article
                      key={chapter.id}
                      className={`phase-chapter ${chapterOpen ? "open" : "collapsed"} ${chapterLocked ? "locked" : ""}`}
                    >
                      <button
                        className="chapter-toggle"
                        type="button"
                        aria-expanded={chapterOpen}
                        onClick={() => toggleChapter(chapter.id)}
                      >
                        <span>
                          <h3>
                            {chapterLocked ? <Lock size={13} className="phase-lock" aria-label="Locked" /> : null}
                            {chapter.title}
                          </h3>
                          <span className="muted small">
                            {stats.done} of {stats.total} complete
                          </span>
                          {variant === "hub" ? (
                            <span className="micro-bar" aria-hidden="true">
                              <span style={{ width: `${stats.pct}%` }} />
                            </span>
                          ) : null}
                        </span>
                        <span className="chapter-caret">{chapterOpen ? "▾" : "▸"}</span>
                      </button>
                      {chapterOpen ? (
                        <>
                          {chapter.summary ? <p className="chapter-summary">{chapter.summary}</p> : null}
                          {variant === "hub" ? (
                            <ul className="student-dash-lessons">
                              {chapter.lessons.map((lesson) => (
                                <li key={lesson.id}>
                                  <LessonEntry
                                    lesson={lesson}
                                    locked={
                                      !unlocked &&
                                      (chapterLocked || checkLessonAccess(lesson, catalog, submissions).isLocked)
                                    }
                                    active={lesson.id === activeLessonId}
                                    done={Boolean(completed[lesson.id])}
                                    href={`${basePath}/${lesson.id}`}
                                    variant="hub"
                                    onNavigate={onNavigate}
                                  />
                                </li>
                              ))}
                            </ul>
                          ) : (
                            chapter.lessons.map((lesson) => (
                              <LessonEntry
                                key={lesson.id}
                                lesson={lesson}
                                locked={
                                  !unlocked &&
                                  (chapterLocked || checkLessonAccess(lesson, catalog, submissions).isLocked)
                                }
                                active={lesson.id === activeLessonId}
                                done={Boolean(completed[lesson.id])}
                                href={`${basePath}/${lesson.id}`}
                                variant="nav"
                                onNavigate={onNavigate}
                              />
                            ))
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
