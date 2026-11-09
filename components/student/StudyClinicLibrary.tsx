"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StudyClinicPageEditor from "@/components/coach/StudyClinicPageEditor";
import LinkedText from "@/components/ui/LinkedText";
import { isCoachAccount } from "@/lib/roles";
import { useStudentSession } from "@/lib/student-session";
import {
  clinicResourceHref,
  clipsForStudyClinicSection,
  emptyStudyClinicPage,
  inferStudyClinicKind,
  mergeStudyClinicClips,
  studyClinicIntro,
  studyClinicKindLabel,
  studyClinicPageForSection,
  type StudyClinicClip,
  type StudyClinicPage,
  type StudyClinicSection,
} from "@/lib/study-clinic";

export default function StudyClinicLibrary({ section }: { section: StudyClinicSection }) {
  const { user } = useStudentSession();
  const coach = isCoachAccount(user);
  const [clips, setClips] = useState<StudyClinicClip[]>([]);
  const [page, setPage] = useState<StudyClinicPage>(() => emptyStudyClinicPage(section.id));
  const [ready, setReady] = useState(false);
  const inSection = useMemo(() => clipsForStudyClinicSection(clips, section.id), [clips, section.id]);
  const visible = useMemo(() => (coach ? inSection : inSection.filter((clip) => clip.published)), [coach, inSection]);
  const intro = studyClinicIntro(page, section.id);
  const notes = (page.body || "").trim();

  const load = useCallback(async (extras: StudyClinicClip[] = []) => {
    const response = await fetch("/api/study-clinic", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    const incoming = Array.isArray(payload.clips) ? payload.clips : [];
    setClips((current) => mergeStudyClinicClips([...current, ...extras], incoming, section.id));
    const nextPage = studyClinicPageForSection(Array.isArray(payload.pages) ? payload.pages : [], section.id);
    setPage((current) => {
      if (!nextPage.intro && !nextPage.body && (current.intro || current.body)) return current;
      return nextPage;
    });
    setReady(true);
  }, [section.id]);

  const applySave = useCallback(
    async (next?: { clip?: StudyClinicClip; page?: StudyClinicPage; removedId?: string }) => {
      if (next?.removedId) {
        setClips((current) => current.filter((clip) => clip.id !== next.removedId));
      }
      if (next?.page) setPage(next.page);
      await load(next?.clip ? [next.clip] : []);
    },
    [load]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/study-clinic">← Study Clinic</Link>
      </p>
      <p className="kicker">Study Clinic</p>
      <h1>{section.title}</h1>
      {coach ? <StudyClinicPageEditor section={section} clips={inSection} page={page} onChanged={applySave} /> : null}
      <p className="lead">
        <LinkedText text={intro} />
      </p>
      {notes
        ? notes.split(/\n+/).map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`}>
              <LinkedText text={paragraph} />
            </p>
          ))
        : null}
      {!ready ? <p className="muted">Loading Study Clinic…</p> : null}
      {ready && visible.length ? (
        <nav className="study-clinic-list" aria-label={`${section.title} resources`}>
          {visible.map((clip) => {
            const resource = clinicResourceHref(clip);
            const kind = inferStudyClinicKind(clip);
            const meta = [studyClinicKindLabel(kind), clip.duration, clip.published ? "" : "hidden"]
              .filter(Boolean)
              .join(" · ");
            const label = (
              <>
                <strong>{clip.title}</strong>
                {meta ? <span className="muted small">{meta}</span> : null}
              </>
            );
            if (!resource) {
              return (
                <span key={clip.id} className="study-clinic-btn">
                  {label}
                </span>
              );
            }
            if (resource.external) {
              return (
                <a key={clip.id} className="study-clinic-btn" href={resource.href} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              );
            }
            return (
              <Link key={clip.id} className="study-clinic-btn" href={resource.href}>
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}
      {ready && !visible.length ? <p className="empty">Resources for this library are coming next.</p> : null}
    </article>
  );
}
