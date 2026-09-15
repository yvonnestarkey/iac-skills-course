"use client";

import { useEffect, useState } from "react";
import LessonPdfViewer from "@/components/LessonPdfViewer";
import { embedSrcForVideo } from "@/components/lesson/VideoPlayer";
import {
  DEFAULT_COACHING_CONFIG,
  fetchCoachingPageConfig,
  fetchStudentCoachingSessions,
  markCoachingDeliverablesSeen,
  sessionHasDeliverables,
  type CoachingPageConfig,
  type StudentCoachingSession,
} from "@/lib/coaching";
import { useStudentSession } from "@/lib/student-session";

function formatSessionWhen(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function SessionRecording({ url, title }: { url: string; title: string }) {
  const embedSrc = embedSrcForVideo(url);
  if (embedSrc) {
    return (
      <div className="player coaching-recording">
        <iframe src={embedSrc} width="100%" height="450" allow="autoplay; fullscreen" allowFullScreen title={title} />
      </div>
    );
  }
  return (
    <p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        Open session recording
      </a>
    </p>
  );
}

function CompletedSession({ session }: { session: StudentCoachingSession }) {
  const when = formatSessionWhen(session.sessionAt);
  return (
    <section className="coaching-deliverables">
      <p className="kicker">After your session</p>
      <h2>Your Session Summary & Recording</h2>
      {when ? <p className="muted small">{when}</p> : null}

      {session.firefliesPdfUrl ? (
        <LessonPdfViewer
          pdfUrl={session.firefliesPdfUrl}
          heading="Fireflies summary"
          blurb="Download or read the meeting notes from this session."
          downloadLabel="Download meeting summary"
        />
      ) : null}

      {session.vimeoRecordingUrl ? (
        <div className="coaching-video-block">
          <h3>Session recording</h3>
          <SessionRecording url={session.vimeoRecordingUrl} title="1-on-1 coaching recording" />
        </div>
      ) : null}

      {session.coachNotes ? (
        <div className="coaching-notes">
          <h3>Coach notes</h3>
          <DescriptionBlock text={session.coachNotes} />
        </div>
      ) : null}

      {!sessionHasDeliverables(session) ? (
        <p className="muted">Your coach will add the summary, recording, and notes here after the session.</p>
      ) : null}
    </section>
  );
}

export default function StudentCoachingPage() {
  const { user } = useStudentSession();
  const [config, setConfig] = useState<CoachingPageConfig>(DEFAULT_COACHING_CONFIG);
  const [sessions, setSessions] = useState<StudentCoachingSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([fetchCoachingPageConfig(), fetchStudentCoachingSessions(user.id)]).then(([nextConfig, nextSessions]) => {
      if (cancelled) return;
      setConfig(nextConfig);
      setSessions(nextSessions);
      setReady(true);
      if (nextSessions.some((session) => session.status === "completed" && sessionHasDeliverables(session))) {
        void markCoachingDeliverablesSeen(user.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const completed = sessions.filter((session) => session.status === "completed");

  if (!ready) return <p className="student-loading">Loading coaching…</p>;

  return (
    <article className="lesson-body wide coaching-page">
      <header className="coaching-hero">
        {config.banner_image_url ? (
          <img className="coaching-banner" src={config.banner_image_url} alt="" />
        ) : null}
        <p className="kicker">1-on-1 coaching</p>
        <h1>{config.title}</h1>
        <DescriptionBlock text={config.description} />
      </header>

      {config.calendly_url ? (
        <p className="coaching-cta">
          <a className="primary" href={config.calendly_url} target="_blank" rel="noopener noreferrer">
            Book Your 1-on-1 Session
          </a>
        </p>
      ) : (
        <p className="muted">Booking will open here once your coach adds a Calendly link.</p>
      )}

      {completed.length ? completed.map((session) => <CompletedSession key={session.id} session={session} />) : null}
    </article>
  );
}
