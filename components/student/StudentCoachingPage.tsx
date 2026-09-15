"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_COACHING_CONFIG,
  fetchCoachingPageConfig,
  fetchLatestStudentCoachingSession,
  markCoachingDeliverablesSeen,
  sessionHasDeliverables,
  type CoachingPageConfig,
  type StudentCoachingSession,
} from "@/lib/coaching";
import { formatSastDateTime } from "@/lib/dates";
import { useStudentSession } from "@/lib/student-session";

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
  const [session, setSession] = useState<StudentCoachingSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([fetchCoachingPageConfig(), fetchLatestStudentCoachingSession(user.id)]).then(
      ([nextConfig, nextSession]) => {
        if (cancelled) return;
        setConfig(nextConfig);
        setSession(nextSession);
        setReady(true);
        if (nextSession && nextSession.status === "completed" && sessionHasDeliverables(nextSession)) {
          void markCoachingDeliverablesSeen(user.id);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!ready) return <p className="student-loading">Loading coaching…</p>;

  const showDeliverables = sessionIsReady(session);
  const sessionWhen = formatSastDateTime(session?.sessionAt);

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
        {sessionWhen ? <p className="live-session-when coaching-session-when">{sessionWhen}</p> : null}
        <DescriptionBlock text={config.recording_section_description} />

        {showDeliverables ? (
          <>
            <div className="coaching-actions">
              {session.recordingUrl ? (
                <a className="primary" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                  {config.recording_button_label}
                </a>
              ) : null}
              {session.pdfSummaryUrl ? (
                <a
                  className="ghost"
                  href={session.pdfSummaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  {config.pdf_button_label}
                </a>
              ) : null}
            </div>
            {session.coachNotes ? (
              <div className="coaching-notes">
                <h3>Coach notes</h3>
                <DescriptionBlock text={session.coachNotes} />
              </div>
            ) : null}
          </>
        ) : (
          <div className="coaching-placeholder" role="status">
            Your meeting recording and PDF summary will appear here after your scheduled session.
          </div>
        )}
      </section>
    </article>
  );
}
