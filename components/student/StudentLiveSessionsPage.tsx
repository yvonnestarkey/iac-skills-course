"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_COACHING_CONFIG, fetchCoachingPageConfig, type CoachingPageConfig } from "@/lib/coaching";
import {
  canAccessAllLiveSessionLinks,
  fetchLiveSessions,
  formatLiveSessionAt,
  liveSessionIsRecorded,
  sanitizeLiveSessionsForAccess,
  type LiveSession,
} from "@/lib/live-sessions";
import InfoTooltip from "@/components/ui/InfoTooltip";
import PurchaseCta from "@/components/commerce/PurchaseCta";
import { useStudentSession } from "@/lib/student-session";
import LinkedText from "@/components/ui/LinkedText";

function SessionRow({ session, fullAccess }: { session: LiveSession; fullAccess: boolean }) {
  const recorded = liveSessionIsRecorded(session);
  const when = formatLiveSessionAt(session.sessionAt);
  const locked = !fullAccess && !session.recordingUrl && !session.zoomUrl;

  return (
    <article className="live-session-row">
      {when ? <p className="live-session-when">{when}</p> : <span className="live-session-when muted">Date TBC</span>}
      <div className="live-session-copy">
        <strong>{session.title}</strong>
        {session.description ? (
          <p>
            <LinkedText text={session.description} />
          </p>
        ) : null}
        {locked ? <p>Unlock the full course to join live Zoom sessions and later recordings.</p> : null}
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
  const { ready: sessionReady, entitlement } = useStudentSession();
  const [config, setConfig] = useState<CoachingPageConfig>(DEFAULT_COACHING_CONFIG);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [ready, setReady] = useState(false);
  const fullAccess = canAccessAllLiveSessionLinks(entitlement);
  const visibleSessions = useMemo(
    () => sanitizeLiveSessionsForAccess(sessions, entitlement),
    [sessions, entitlement]
  );

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

  if (!ready || !sessionReady) return <p className="student-loading">Loading live sessions…</p>;

  return (
    <article className="lesson-body wide live-sessions-page">
      <section className="live-sessions-header">
        <p className="kicker">Live sessions</p>
        <h1>Live Coaching & Group Sessions</h1>
        <p className="lead">
          {fullAccess
            ? "Access upcoming Zoom links, past meeting recordings, summaries, and scribbles from the session."
            : "Free preview includes the first live session recording. Unlock the full course for Zoom links and later sessions."}
        </p>
        {fullAccess && config.live_calendar_ics_url ? (
          <div className="live-sessions-ics">
            <a
              className="primary coaching-book-btn"
              href={config.live_calendar_ics_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add All Sessions to Calendar (.ics)
            </a>
            <InfoTooltip contentKey="live_calendar_subscription" />
          </div>
        ) : null}
      </section>

      {visibleSessions.length ? (
        <section className="live-session-list" aria-label="Live sessions">
          {visibleSessions.map((session) => (
            <SessionRow key={session.id} session={session} fullAccess={fullAccess} />
          ))}
        </section>
      ) : (
        <div className="coaching-placeholder" role="status">
          No upcoming live sessions scheduled.
        </div>
      )}
      {fullAccess ? null : <PurchaseCta compact />}
    </article>
  );
}
