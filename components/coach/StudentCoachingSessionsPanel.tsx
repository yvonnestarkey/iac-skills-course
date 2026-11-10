"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";
import { fetchStudentCoachingSessions, type StudentCoachingSession } from "@/lib/coaching";

export default function StudentCoachingSessionsPanel({ studentId }: { studentId: string }) {
  const [sessions, setSessions] = useState<StudentCoachingSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStudentCoachingSessions(studentId).then((rows) => {
      if (cancelled) return;
      setSessions(rows);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!ready) return null;

  return (
    <section className="card">
      <h2>1-on-1 coaching</h2>
      <p className="muted small">Fireflies transcripts and summaries land here after a call.</p>
      {sessions.length ? (
        <div className="work-list">
          {sessions.map((session) => (
            <article key={session.id} className="coaching-session-card">
              <p>
                <strong>{session.title || "1-on-1 coaching"}</strong>
                {session.sessionAt ? <span className="muted"> · {formatSastDateTime(session.sessionAt)}</span> : null}
              </p>
              {session.summaryText ? <p className="coaching-summary">{session.summaryText}</p> : null}
              <p className="coaching-actions">
                {session.recordingUrl ? (
                  <a className="primary" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                    Watch recording
                  </a>
                ) : null}
                {session.firefliesTranscriptUrl ? (
                  <a className="ghost" href={session.firefliesTranscriptUrl} target="_blank" rel="noopener noreferrer">
                    Open in Fireflies
                  </a>
                ) : null}
              </p>
              {session.transcriptText ? (
                <details className="coaching-transcript">
                  <summary>Transcript</summary>
                  <pre>{session.transcriptText}</pre>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">No coaching sessions imported yet.</p>
      )}
    </section>
  );
}
