"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COACHING_CONFIG, fetchCoachingPageConfig, type CoachingPageConfig } from "@/lib/coaching";
import {
  fetchLiveSessions,
  formatLiveSessionAt,
  liveSessionIsRecorded,
  type LiveSession,
} from "@/lib/live-sessions";
import InfoTooltip from "@/components/ui/InfoTooltip";

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

function SessionRow({ session }: { session: LiveSession }) {
  const recorded = liveSessionIsRecorded(session);
  const when = formatLiveSessionAt(session.sessionAt);

  return (
    <article className="live-session-row">
      {when ? <p className="live-session-when">{when}</p> : <span className="live-session-when muted">Date TBC</span>}
      <div className="live-session-copy">
        <strong>{session.title}</strong>
        {session.description ? <p>{session.description}</p> : null}
      </div>
      <div className="live-session-actions">
        {recorded ? (
          session.recordingUrl ? (
            <a className="primary live-session-watch" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
              Watch Recording
            </a>
          ) : null
        ) : session.zoomUrl ? (
          <a className="primary" href={session.zoomUrl} target="_blank" rel="noopener noreferrer">
            Join Zoom Meeting
          </a>
        ) : null}
        {session.summaryPdfUrl ? (
          <a className="ghost" href={session.summaryPdfUrl} target="_blank" rel="noopener noreferrer">
            Session Summary (PDF)
          </a>
        ) : null}
        {session.notesPdfUrl ? (
          <a className="ghost" href={session.notesPdfUrl} target="_blank" rel="noopener noreferrer">
            Session Scribbles/Notes (PDF)
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function StudentLiveSessionsPage() {
  const [config, setConfig] = useState<CoachingPageConfig>(DEFAULT_COACHING_CONFIG);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCoachingPageConfig(), fetchLiveSessions()]).then(([nextConfig, nextSessions]) => {
      if (cancelled) return;
      setConfig(nextConfig);
      setSessions(nextSessions);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <p className="student-loading">Loading live sessions…</p>;

  return (
    <article className="lesson-body wide live-sessions-page">
      <section className="live-sessions-header">
        <p className="kicker">Live sessions</p>
        <h1>Live Coaching & Group Sessions</h1>
        <p className="lead">
          Access upcoming Zoom links, past meeting recordings, summaries, and scribbles from the session.
        </p>
        {config.live_calendar_ics_url ? (
          <div className="live-sessions-ics">
            <a
              className="primary coaching-book-btn"
              href={config.live_calendar_ics_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add All Sessions to Calendar (.ics)
            </a>
            <InfoTooltip text="Subscribing adds all live calls directly to your Apple, Google, or Outlook calendar. Any schedule updates or room changes will sync automatically." />
          </div>
        ) : null}
      </section>

      {sessions.length ? (
        <section className="live-session-list" aria-label="Live sessions">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </section>
      ) : (
        <div className="coaching-placeholder" role="status">
          No upcoming live sessions scheduled.
        </div>
      )}
    </article>
  );
}
