"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clipsForStudyClinicSection,
  studyClinicWatchHref,
  type StudyClinicClip,
  type StudyClinicSection,
} from "@/lib/study-clinic";

export default function StudyClinicLibrary({ section }: { section: StudyClinicSection }) {
  const [clips, setClips] = useState<StudyClinicClip[]>([]);
  const [ready, setReady] = useState(false);
  const inSection = useMemo(() => clipsForStudyClinicSection(clips, section.id), [clips, section.id]);

  useEffect(() => {
    fetch("/api/study-clinic")
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => setClips(Array.isArray(payload.clips) ? payload.clips : []))
      .finally(() => setReady(true));
  }, []);

  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/study-clinic">← Study Clinic</Link>
      </p>
      <p className="kicker">Study Clinic</p>
      <h1>{section.title}</h1>
      <p className="lead">Short videos for this library. Open the one you need.</p>
      {!ready ? <p className="muted">Loading Study Clinic…</p> : null}
      {ready && inSection.length ? (
        <nav className="study-clinic-list" aria-label={`${section.title} videos`}>
          {inSection.map((clip) => (
            <Link key={clip.id} className="study-clinic-btn" href={studyClinicWatchHref(clip.id)}>
              <strong>{clip.title}</strong>
              {clip.duration ? <span className="muted small">{clip.duration}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}
      {ready && !inSection.length ? <p className="empty">Resources for this library are coming next.</p> : null}
    </article>
  );
}
