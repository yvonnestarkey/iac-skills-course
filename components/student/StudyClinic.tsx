"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StudyClinicClip } from "@/lib/study-clinic";

export default function StudyClinic() {
  const [clips, setClips] = useState<StudyClinicClip[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/study-clinic")
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => setClips(Array.isArray(payload.clips) ? payload.clips : []))
      .finally(() => setReady(true));
  }, []);

  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/dashboard">← Student dashboard</Link>
      </p>
      <p className="kicker">Study Clinic</p>
      <h1>Common Fixes</h1>
      <p className="lead">Short videos for the study problems that get in the way. Open the one you need.</p>
      {!ready ? <p className="muted">Loading Study Clinic…</p> : null}
      {ready && clips.length ? (
        <nav className="study-clinic-list" aria-label="Study Clinic videos">
          {clips.map((clip) => (
            <Link key={clip.id} className="study-clinic-btn" href={`/student/study-clinic/${clip.id}`}>
              <strong>{clip.title}</strong>
              {clip.duration ? <span className="muted small">{clip.duration}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}
      {ready && !clips.length ? <p className="empty">No Study Clinic videos are published yet.</p> : null}
    </article>
  );
}
