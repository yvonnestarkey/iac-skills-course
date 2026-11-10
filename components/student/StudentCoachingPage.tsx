"use client";

import { useEffect, useState } from "react";
import {
  COACHING_BOOKING_NOTE,
  DEFAULT_COACHING_CONFIG,
  fetchCoachingPageConfig,
  fetchStudentCoachingSessions,
  markCoachingDeliverablesSeen,
  sessionHasDeliverables,
  type CoachingPageConfig,
  type StudentCoachingSession,
} from "@/lib/coaching";
import { formatSastDateTime } from "@/lib/dates";
import { useStudentSession } from "@/lib/student-session";

function looksLikePdf(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url);
}

function DescriptionBlock({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className="coaching-description">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

function sessionIsReady(session: StudentCoachingSession | null): session is StudentCoachingSession {
  if (!session) return false;
  return session.status === "completed" || sessionHasDeliverables(session);
}

export default function StudentCoachingPage() {
  const { user } = useStudentSession();
  const [config, setConfig] = useState<CoachingPageConfig>(DEFAULT_COACHING_CONFIG);
  const [sessions, setSessions] = useState<StudentCoachingSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([fetchCoachingPageConfig(), fetchStudentCoachingSessions(user.id)]).then(
      ([nextConfig, nextSessions]) => {
        if (cancelled) return;
        setConfig(nextConfig);
        setSessions(nextSessions);
        setReady(true);
        if (nextSessions.some((session) => session.status === "completed" && sessionHasDeliverables(session))) {
          void markCoachingDeliverablesSeen(user.id);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!ready) return <p className="student-loading">Loading coaching…</p>;

  const readySessions = sessions.filter(sessionIsReady);

  return (
    <article className="lesson-body wide coaching-page">
      <section className="coaching-booking">
        {config.banner_image_url ? (
          <div className="coaching-banner-wrap">
            <img className="coaching-banner" src={config.banner_image_url} alt="" />
          </div>
        ) : null}
        <p className="kicker">1-on-1 coaching</p>
        <h1>{config.title}</h1>
        <p className="coaching-booking-note">{COACHING_BOOKING_NOTE}</p>
        <DescriptionBlock text={config.description} />
        {config.calendly_url ? (
          <p className="coaching-cta">
            <a className="primary coaching-book-btn" href={config.calendly_url} target="_blank" rel="noopener noreferrer">
              Book Your 1-on-1 Session
            </a>
          </p>
        ) : null}
      </section>

      <hr className="coaching-divider my-8 border-gray-200" />

      <section className="coaching-recordings">
        <h2>{config.recording_section_title}</h2>
        <DescriptionBlock text={config.recording_section_description} />

        {readySessions.length ? (
          readySessions.map((session) => {
            const sessionWhen = formatSastDateTime(session.sessionAt);
            const summaryHref = session.pdfSummaryUrl || session.firefliesTranscriptUrl;
            return (
              <article key={session.id} className="coaching-session-card">
                {session.title ? <h3>{session.title}</h3> : null}
                {sessionWhen ? <p className="live-session-when coaching-session-when">{sessionWhen}</p> : null}
                <div className="coaching-actions">
                  {session.recordingUrl ? (
                    <a className="primary" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                      {config.recording_button_label}
                    </a>
                  ) : null}
                  {summaryHref ? (
                    <a
                      className="ghost"
                      href={summaryHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={looksLikePdf(summaryHref) ? true : undefined}
                    >
                      {looksLikePdf(summaryHref) ? config.pdf_button_label : "Open meeting notes"}
                    </a>
                  ) : null}
                </div>
                {session.summaryText ? (
                  <div className="coaching-notes">
                    <h3>Summary</h3>
                    <DescriptionBlock text={session.summaryText} />
                  </div>
                ) : null}
                {session.coachNotes ? (
                  <div className="coaching-notes">
                    <h3>Coach notes</h3>
                    <DescriptionBlock text={session.coachNotes} />
                  </div>
                ) : null}
                {session.transcriptText ? (
                  <details className="coaching-transcript">
                    <summary>Transcript</summary>
                    <pre>{session.transcriptText}</pre>
                  </details>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="coaching-placeholder" role="status">
            Your meeting recording and summary will appear here after your scheduled session.
          </div>
        )}
      </section>
    </article>
  );
}
